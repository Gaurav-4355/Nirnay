import json
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from pydantic import ValidationError

from ..prompts import EXTRACTION_SYSTEM_PROMPT, build_extraction_user_prompt
from ..llm import call_groq_json
from ..models import Task, Decision
from ..schemas import (
    LLMExtractionResult,
    MeetingAnalyzeResponse,
    ProposalDecision,
    ProposalTask,
    ProposalTaskUpdate,
)
from .quote_matcher import find_quote_span
from .conflicts import detect_conflicts


def analyze_meeting(
    db: Session, title: str, meeting_date: str, transcript: str
) -> MeetingAnalyzeResponse:
    # 1. Load existing open tasks and active decisions from DB
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

        # Owner validation
        if not t.owner or t.owner.strip().lower() in ("null", "none", "unassigned", "unclear"):
            owner = None
            needs_clar = True
            if not clar_question:
                clar_question = f"Who will take ownership of '{t.title}'?"
        else:
            owner = t.owner.strip()

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
