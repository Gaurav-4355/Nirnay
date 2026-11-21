import re
import json
from typing import Dict, Any, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from pydantic import ValidationError

from ..prompts import EXTRACTION_SYSTEM_PROMPT, build_extraction_user_prompt
from ..llm import call_groq_json
from ..models import Task, Decision, Meeting, Conflict
from ..schemas import (
    LLMExtractionResult,
    MeetingAnalyzeResponse,
    MeetingConfirmRequest,
    ProposalDecision,
    ProposalTask,
    ProposalTaskUpdate,
)
from .quote_matcher import find_quote_span
from .conflicts import detect_conflicts
from .outbox_service import queue_tracker_create, queue_tracker_update

STOP_WORDS = {
    "a", "an", "the", "and", "or", "for", "to", "in", "on", "at", "by", "of", "with",
    "is", "are", "aur", "ki", "ka", "ke", "ko", "se", "tak", "mein", "par", "hai", "hain",
    "task", "deliver", "complete", "finish", "setup", "kar", "karna", "karni", "karunga", "karenge"
}


def extract_transcript_speakers(transcript: str) -> Set[str]:
    """
    Extracts speaker names from transcript lines starting with 'SpeakerName:' or 'Speaker Name:'.
    Returns a set of lowercase speaker names.
    """
    speakers = set()
    for line in (transcript or "").splitlines():
        line = line.strip()
        m = re.match(r"^([A-Za-z0-9_\-\s]{1,40}):", line)
        if m:
            spk = m.group(1).strip()
            if spk:
                speakers.add(spk.lower())
    return speakers


def check_owner_guard(
    raw_owner: Optional[str],
    task_title: str,
    speakers: Set[str],
    existing_clar_question: Optional[str] = None,
) -> Tuple[Optional[str], bool, Optional[str]]:
    """
    Checks task owner against transcript speakers.
    Returns (cleaned_owner, needs_clarification, clarification_question).
    If owner is not in speakers (case-insensitive), sets owner to None,
    needs_clarification to True, and adds a clarification question.
    """
    if not raw_owner or raw_owner.strip().lower() in ("null", "none", "unassigned", "unclear"):
        clar_q = existing_clar_question or f"Who will take ownership of '{task_title}'?"
        return None, True, clar_q

    clean_owner = raw_owner.strip()
    owner_lower = clean_owner.lower()

    if speakers:
        is_speaker = any(
            owner_lower == s or owner_lower in s.split() or s in owner_lower.split()
            for s in speakers
        )
        if not is_speaker:
            clar_q = existing_clar_question or f"Who will take ownership of '{task_title}'? '{clean_owner}' is not a recognized speaker."
            return None, True, clar_q

    return clean_owner, False, existing_clar_question


def _tokenize_title(title: str) -> Set[str]:
    words = re.findall(r"\w+", (title or "").lower())
    return {w for w in words if len(w) > 2 and w not in STOP_WORDS}


def apply_duplicate_guard(
    tasks: List[ProposalTask],
    task_updates: List[ProposalTaskUpdate],
) -> List[ProposalTask]:
    """
    If the same output has both a task_update for an existing task AND a new task
    with the same owner and the same deadline as that update's new_deadline
    and overlapping title words, drop the duplicate new task.
    """
    if not task_updates or not tasks:
        return tasks

    filtered_tasks = []
    dropped_indices = set()

    for idx, t in enumerate(tasks):
        is_dup = False
        t_owner = (t.owner or "").strip().lower()
        t_deadline = (t.deadline or "").strip()
        t_words = _tokenize_title(t.title)

        for tu in task_updates:
            tu_owner = (tu.owner or "").strip().lower()
            tu_new_deadline = (tu.new_deadline or "").strip()

            if t_owner and tu_owner and t_owner == tu_owner:
                if tu_new_deadline and t_deadline == tu_new_deadline:
                    tu_words = _tokenize_title(tu.task_title)
                    if t_words and tu_words and (t_words & tu_words):
                        is_dup = True
                        dropped_indices.add(idx)
                        break

        if not is_dup:
            filtered_tasks.append(t)

    # Remap dependencies if any dropped task was referenced
    if dropped_indices:
        index_map = {}
        new_i = 0
        for old_i in range(len(tasks)):
            if old_i in dropped_indices:
                index_map[old_i] = None
            else:
                index_map[old_i] = new_i
                new_i += 1

        for t in filtered_tasks:
            if t.depends_on_new_task_index is not None:
                mapped = index_map.get(t.depends_on_new_task_index)
                if mapped is not None:
                    t.depends_on_new_task_index = mapped
                else:
                    # Depended on the dropped duplicate! Link to the update's existing task
                    dropped_old_idx = t.depends_on_new_task_index
                    dropped_task = tasks[dropped_old_idx]
                    for tu in task_updates:
                        if (
                            (tu.owner or "").strip().lower() == (dropped_task.owner or "").strip().lower()
                            and (tu.new_deadline or "").strip() == (dropped_task.deadline or "").strip()
                        ):
                            t.depends_on_existing_task_id = tu.task_id
                            t.depends_on_title = tu.task_title
                            t.depends_on_new_task_index = None
                            break
                    if t.depends_on_new_task_index is not None:
                        t.depends_on_new_task_index = None

    return filtered_tasks


def analyze_meeting(
    db: Session,
    title: str,
    meeting_date: str,
    transcript: str,
    ignore_demo_fallback: bool = False,
) -> MeetingAnalyzeResponse:
    # 1. Load existing open tasks and active decisions from DB
    speakers = extract_transcript_speakers(transcript)
    open_tasks_db = (
        db.query(Task)
        .filter(Task.status.in_(["pending", "blocked"]))
        .all()
    )
    open_tasks = [
        {
            "id": t.id,
            "title": t.title,
            "owner": t.owner,
            "deadline": t.deadline,
            "status": t.status,
        }
        for t in open_tasks_db
    ]
    open_tasks_by_id = {t.id: t for t in open_tasks_db}

    active_decisions_db = (
        db.query(Decision)
        .filter(Decision.status == "active")
        .all()
    )
    active_decisions = [
        {
            "topic": d.topic,
            "value": d.value,
            "text": d.text,
        }
        for d in active_decisions_db
    ]

    # 2. Build user prompt with memory context
    user_prompt = build_extraction_user_prompt(
        title=title,
        meeting_date=meeting_date,
        transcript=transcript,
        open_tasks=open_tasks,
        active_decisions=active_decisions,
    )

    # 3. Call Groq LLM (single call)
    raw_response, cached_demo = call_groq_json(
        EXTRACTION_SYSTEM_PROMPT,
        user_prompt,
        transcript=transcript,
        open_tasks=open_tasks,
        ignore_demo_fallback=ignore_demo_fallback,
    )

    # 4. Validate output with Pydantic; retry once if invalid JSON structure
    try:
        validated = LLMExtractionResult.model_validate(raw_response)
    except ValidationError:
        raw_response, cached_demo = call_groq_json(
            EXTRACTION_SYSTEM_PROMPT,
            user_prompt + "\n\nCRITICAL: Ensure the response strictly matches the required JSON structure.",
            transcript=transcript,
            open_tasks=open_tasks,
            ignore_demo_fallback=ignore_demo_fallback,
        )
        validated = LLMExtractionResult.model_validate(raw_response)

    # 5. Process Decisions
    decisions: List[ProposalDecision] = []
    for d in validated.decisions:
        q_start, q_end, matched_quote, multiplier, matched = find_quote_span(
            transcript, d.evidence_quote
        )
        conf = round(d.confidence * multiplier, 2)
        if not matched:
            conf = 0.3

        decisions.append(
            ProposalDecision(
                topic=d.topic.strip().lower(),
                text=d.text.strip(),
                value=d.value.strip(),
                evidence_quote=matched_quote or d.evidence_quote,
                confidence=conf,
                status="active",
                quote_start=q_start,
                quote_end=q_end,
            )
        )

    # 6. Process Tasks
    tasks: List[ProposalTask] = []
    for idx, t in enumerate(validated.tasks):
        q_start, q_end, matched_quote, multiplier, matched = find_quote_span(
            transcript, t.evidence_quote
        )
        conf = round(t.confidence * multiplier, 2)
        needs_clar = t.needs_clarification
        clar_question = t.clarification_question

        if not matched:
            conf = 0.3
            needs_clar = True
            if not clar_question:
                clar_question = "Evidence quote was not found directly in transcript; please verify details."

        # Owner validation & speaker guard (converts invented owners to null with clarification)
        owner, owner_needs_clar, clar_question = check_owner_guard(
            t.owner, t.title, speakers, clar_question
        )
        if owner_needs_clar:
            needs_clar = True

        # Deadline validation
        deadline = t.deadline.strip() if t.deadline else None
        if not deadline or deadline.lower() in ("null", "none"):
            deadline = None
            if not owner or needs_clar:
                needs_clar = True
                if not clar_question:
                    clar_question = f"When is '{t.title}' expected to be completed?"

        # Validate dependency references
        dep_existing_id = t.depends_on_existing_task_id
        if dep_existing_id is not None and dep_existing_id not in open_tasks_by_id:
            dep_existing_id = None

        dep_new_idx = t.depends_on_new_task_index
        if dep_new_idx is not None and (dep_new_idx < 0 or dep_new_idx >= len(validated.tasks) or dep_new_idx == idx):
            dep_new_idx = None

        # Resolve display title
        dep_title = None
        if dep_existing_id and dep_existing_id in open_tasks_by_id:
            dep_title = open_tasks_by_id[dep_existing_id].title
        elif dep_new_idx is not None and 0 <= dep_new_idx < len(validated.tasks):
            dep_title = validated.tasks[dep_new_idx].title

        tasks.append(
            ProposalTask(
                title=t.title.strip(),
                owner=owner,
                deadline=deadline,
                status="pending",
                evidence_quote=matched_quote or t.evidence_quote,
                confidence=conf,
                needs_clarification=needs_clar,
                clarification_question=clar_question,
                depends_on_existing_task_id=dep_existing_id,
                depends_on_new_task_index=dep_new_idx,
                depends_on_title=dep_title,
                quote_start=q_start,
                quote_end=q_end,
            )
        )

    # 7. Process Task Updates
    task_updates: List[ProposalTaskUpdate] = []
    for tu in validated.task_updates:
        # Drop any task_update whose task_id is not in open_tasks_by_id
        if tu.task_id not in open_tasks_by_id:
            continue

        orig_task = open_tasks_by_id[tu.task_id]
        q_start, q_end, matched_quote, multiplier, matched = find_quote_span(
            transcript, tu.evidence_quote
        )
        conf = round(tu.confidence * multiplier, 2)

        # Normalize new_status
        new_status = tu.new_status.strip().lower() if tu.new_status else None
        if new_status and new_status not in ("done", "blocked", "pending"):
            new_status = None

        new_deadline = tu.new_deadline.strip() if tu.new_deadline else None
        if new_deadline and new_deadline.lower() in ("null", "none"):
            new_deadline = None

        task_updates.append(
            ProposalTaskUpdate(
                task_id=tu.task_id,
                task_title=orig_task.title,
                owner=orig_task.owner,
                old_status=orig_task.status,
                new_status=new_status,
                old_deadline=orig_task.deadline,
                new_deadline=new_deadline,
                evidence_quote=matched_quote or tu.evidence_quote,
                confidence=conf,
                quote_start=q_start,
                quote_end=q_end,
                included=True,
            )
        )

    # Apply duplicate guard (drops duplicate new tasks when an update already exists)
    tasks = apply_duplicate_guard(tasks, task_updates)

    # 8. Detect Conflicts (plain Python, no LLM)
    conflicts = detect_conflicts(
        db=db,
        decisions=decisions,
        tasks=tasks,
        task_updates=task_updates,
    )

    return MeetingAnalyzeResponse(
        title=title,
        meeting_date=meeting_date,
        transcript=transcript,
        decisions=decisions,
        tasks=tasks,
        task_updates=task_updates,
        conflicts=conflicts,
        cached_demo=cached_demo,
    )


def save_confirmed_meeting(
    db: Session,
    request: MeetingConfirmRequest,
    queue_outbox: bool = True,
) -> Meeting:
    """
    Saves a confirmed meeting, applies task updates, resolves decision conflicts,
    saves new tasks (with dependency resolution), stores conflicts, and optionally
    queues outbox items. Works with ANY SQLAlchemy session (production or in-memory eval).
    """
    # 1. Create Meeting
    db_meeting = Meeting(
        title=request.title.strip(),
        meeting_date=request.meeting_date.strip(),
        transcript=request.transcript.strip(),
    )
    db.add(db_meeting)
    db.flush()

    # 2. Apply task_updates & queue tracker_update if applicable
    for tu in request.task_updates:
        if getattr(tu, "included", True):
            existing_task = db.query(Task).filter(Task.id == tu.task_id).first()
            if existing_task:
                status_changed = bool(tu.new_status and tu.new_status != existing_task.status)
                deadline_changed = bool(tu.new_deadline and tu.new_deadline != existing_task.deadline)

                if tu.new_status:
                    existing_task.status = tu.new_status
                if tu.new_deadline:
                    existing_task.deadline = tu.new_deadline
                existing_task.status_evidence = tu.evidence_quote
                existing_task.updated_in_meeting_id = db_meeting.id

                # Queue tracker_update in outbox
                if queue_outbox and (status_changed or deadline_changed):
                    queue_tracker_update(
                        db=db,
                        task=existing_task,
                        new_status=tu.new_status,
                        new_deadline=tu.new_deadline,
                        evidence=tu.evidence_quote,
                    )

    # 3. Conflict resolution map (keyed by topic)
    resolutions_by_topic: Dict[str, str] = {}
    for cr in request.conflict_resolutions:
        res = cr.get("resolution")
        topic = cr.get("topic")
        if topic:
            resolutions_by_topic[topic.strip().lower()] = res

    # 4. Save Decisions
    for d in request.decisions:
        topic_key = d.topic.strip().lower()
        res = resolutions_by_topic.get(topic_key)

        status_to_set = "active"
        if res == "kept_old":
            status_to_set = "superseded"

        db_decision = Decision(
            meeting_id=db_meeting.id,
            topic=topic_key,
            text=d.text.strip(),
            value=d.value.strip(),
            evidence_quote=d.evidence_quote.strip(),
            confidence=d.confidence,
            status=status_to_set,
        )
        db.add(db_decision)
        db.flush()

        if res == "kept_new":
            old_decision = (
                db.query(Decision)
                .filter(
                    Decision.topic == topic_key,
                    Decision.status == "active",
                    Decision.id != db_decision.id,
                )
                .first()
            )
            if old_decision:
                old_decision.status = "superseded"
                old_decision.superseded_by_id = db_decision.id

    # 5. Save new tasks (Two-pass for dependencies)
    created_tasks: List[Task] = []
    for t in request.tasks:
        db_task = Task(
            meeting_id=db_meeting.id,
            title=t.title.strip(),
            owner=t.owner.strip() if t.owner else None,
            deadline=t.deadline.strip() if t.deadline else None,
            status=t.status or "pending",
            evidence_quote=t.evidence_quote.strip(),
            confidence=t.confidence,
            needs_clarification=t.needs_clarification,
            clarification_question=t.clarification_question.strip() if t.clarification_question else None,
            depends_on_task_id=t.depends_on_existing_task_id or t.depends_on_task_id,
        )
        db.add(db_task)
        created_tasks.append(db_task)

    db.flush()

    for idx, t in enumerate(request.tasks):
        if t.depends_on_new_task_index is not None and 0 <= t.depends_on_new_task_index < len(created_tasks):
            created_tasks[idx].depends_on_task_id = created_tasks[t.depends_on_new_task_index].id

    # Queue tracker_create outbox items for all newly confirmed tasks
    if queue_outbox:
        for new_task in created_tasks:
            queue_tracker_create(db, new_task, db_meeting)

    # 6. Save Conflicts
    for idx, c in enumerate(request.conflicts):
        res = None
        for cr in request.conflict_resolutions:
            if cr.get("conflict_index") == idx:
                res = cr.get("resolution")
                break
            if cr.get("topic") and c.type == "decision_conflict" and cr.get("topic") in c.title.lower():
                res = cr.get("resolution")
                break
        if not res and c.resolution:
            res = c.resolution

        db_conflict = Conflict(
            meeting_id=db_meeting.id,
            type=c.type,
            title=c.title,
            description=c.description,
            resolution=res,
        )
        db.add(db_conflict)

    db.commit()
    db.refresh(db_meeting)
    return db_meeting
