import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import engine, Base, get_db
from .models import Meeting, Decision, Task, Conflict
from .llm import MODEL_NAME
from .schemas import (
    MeetingAnalyzeRequest,
    MeetingAnalyzeResponse,
    MeetingConfirmRequest,
    MeetingOut,
    MeetingListItem,
    DecisionOut,
    TaskOut,
    ConflictOut,
    TaskUpdate,
)
from .services.meeting_service import analyze_meeting

# Create SQLite tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Nirnay - Meeting-to-Execution Agent",
    description="Meeting ke faisle, kaam mein badlo.",
    version="1.0.0",
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    """Returns service health and the currently configured Groq model name."""
    return {
        "status": "ok",
        "app": "Nirnay",
        "version": "1.0.0",
        "model": MODEL_NAME,
    }


@app.post("/api/reset")
def reset_database(db: Session = Depends(get_db)):
    """Deletes all meetings, decisions, tasks, and conflicts from the database."""
    db.query(Conflict).delete()
    db.query(Decision).delete()
    db.query(Task).delete()
    db.query(Meeting).delete()
    db.commit()
    return {"status": "ok", "message": "All database records have been reset."}


@app.get("/api/seed/demo-meetings")
def get_demo_meetings():
    """Returns the 3 demo meetings from backend/seed/ to populate the frontend form."""
    seed_dir = Path(__file__).parent / "seed"
    meetings_data = [
        {
            "id": 1,
            "title": "Meeting 1: Launch Timeline & Core Milestones",
            "meeting_date": "2026-12-01",
            "file": "meeting_1.txt",
        },
        {
            "id": 2,
            "title": "Meeting 2: Progress Sync & Pricing Revision",
            "meeting_date": "2026-12-10",
            "file": "meeting_2.txt",
        },
        {
            "id": 3,
            "title": "Meeting 3: Scope Review & Launch Postponement",
            "meeting_date": "2026-12-18",
            "file": "meeting_3.txt",
        },
    ]

    demos = []
    for item in meetings_data:
        file_path = seed_dir / item["file"]
        transcript_text = file_path.read_text(encoding="utf-8") if file_path.exists() else ""
        demos.append({
            "id": item["id"],
            "title": item["title"],
            "meeting_date": item["meeting_date"],
            "transcript": transcript_text,
        })

    return demos


@app.post("/api/meetings/analyze", response_model=MeetingAnalyzeResponse)
def analyze_meeting_endpoint(request: MeetingAnalyzeRequest, db: Session = Depends(get_db)):
    """
    Step 1: Extract decisions, tasks, task_updates, and detect conflicts using cross-meeting memory.
    DO NOT save anything to database yet. Return proposal.
    """
    if not request.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript cannot be empty.",
        )
    try:
        proposal = analyze_meeting(
            db=db,
            title=request.title.strip(),
            meeting_date=request.meeting_date.strip(),
            transcript=request.transcript.strip(),
        )
        return proposal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during analysis: {str(e)}",
        )


@app.post("/api/meetings/confirm", response_model=MeetingOut)
def confirm_meeting_endpoint(request: MeetingConfirmRequest, db: Session = Depends(get_db)):
    """
    Step 2: Save the meeting, apply task updates, resolve decision conflicts,
    save new tasks in two passes for dependencies, and store conflict records.
    """
    if not request.title.strip() or not request.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title and transcript are required.",
        )

    # 1. Create Meeting
    db_meeting = Meeting(
        title=request.title.strip(),
        meeting_date=request.meeting_date.strip(),
        transcript=request.transcript.strip(),
    )
    db.add(db_meeting)
    db.flush()

    # 2. Apply task_updates
    for tu in request.task_updates:
        # Check if included
        if getattr(tu, "included", True):
            existing_task = db.query(Task).filter(Task.id == tu.task_id).first()
            if existing_task:
                if tu.new_status:
                    existing_task.status = tu.new_status
                if tu.new_deadline:
                    existing_task.deadline = tu.new_deadline
                existing_task.status_evidence = tu.evidence_quote
                existing_task.updated_in_meeting_id = db_meeting.id

    # 3. Conflict resolution map (keyed by topic)
    resolutions_by_topic: Dict[str, str] = {}
    resolutions_by_old_id: Dict[int, str] = {}
    for cr in request.conflict_resolutions:
        res = cr.get("resolution")
        topic = cr.get("topic")
        old_id = cr.get("old_decision_id")
        if topic:
            resolutions_by_topic[topic.strip().lower()] = res
        if old_id:
            resolutions_by_old_id[old_id] = res

    # 4. Save Decisions
    created_decisions = []
    for d in request.decisions:
        topic_key = d.topic.strip().lower()
        res = resolutions_by_topic.get(topic_key)

        # Default decision status
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
        created_decisions.append(db_decision)

        # If kept_new, supersede the old active decision
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
    # Pass 1: create tasks and assign existing dependencies
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

    # Pass 2: resolve depends_on_new_task_index
    for idx, t in enumerate(request.tasks):
        if t.depends_on_new_task_index is not None and 0 <= t.depends_on_new_task_index < len(created_tasks):
            created_tasks[idx].depends_on_task_id = created_tasks[t.depends_on_new_task_index].id

    # 6. Save Conflicts
    for idx, c in enumerate(request.conflicts):
        # Find matching resolution
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


@app.get("/api/meetings", response_model=List[MeetingListItem])
def list_meetings(db: Session = Depends(get_db)):
    """List all meetings with counts of decisions, tasks, and conflicts."""
    meetings = db.query(Meeting).order_by(Meeting.created_at.desc()).all()
    results = []
    for m in meetings:
        results.append(
            MeetingListItem(
                id=m.id,
                title=m.title,
                meeting_date=m.meeting_date,
                created_at=m.created_at,
                decisions_count=len(m.decisions),
                tasks_count=len(m.tasks),
                conflicts_count=len(m.conflicts),
            )
        )
    return results


@app.get("/api/meetings/{meeting_id}", response_model=MeetingOut)
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@app.get("/api/decisions")
def list_decisions(db: Session = Depends(get_db)):
    """List all decisions with meeting context and superseded tracking."""
    decisions = (
        db.query(Decision, Meeting)
        .join(Meeting, Decision.meeting_id == Meeting.id)
        .order_by(Meeting.meeting_date.desc(), Decision.id.asc())
        .all()
    )
    results = []
    for d, m in decisions:
        superseded_val = None
        superseded_title = None
        if d.superseded_by_id:
            rep = db.query(Decision, Meeting).join(Meeting, Decision.meeting_id == Meeting.id).filter(Decision.id == d.superseded_by_id).first()
            if rep:
                superseded_val = rep[0].value
                superseded_title = rep[1].title

        results.append({
            "id": d.id,
            "meeting_id": d.meeting_id,
            "meeting_title": m.title,
            "meeting_date": m.meeting_date,
            "topic": d.topic,
            "text": d.text,
            "value": d.value,
            "evidence_quote": d.evidence_quote,
            "confidence": d.confidence,
            "status": d.status,
            "superseded_by_id": d.superseded_by_id,
            "superseded_by_value": superseded_val,
            "superseded_by_meeting_title": superseded_title,
        })
    return results


@app.get("/api/tasks", response_model=List[TaskOut])
def list_tasks(owner: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """List tasks with optional ?owner= filter and dependency titles."""
    query = (
        db.query(Task, Meeting)
        .join(Meeting, Task.meeting_id == Meeting.id)
    )
    if owner and owner.strip():
        query = query.filter(Task.owner.ilike(f"%{owner.strip()}%"))

    tasks_with_meetings = query.order_by(Task.deadline.asc().nullslast(), Task.id.asc()).all()

    # Preload all task titles for dependency display
    all_task_titles = {t[0].id: t[0].title for t in tasks_with_meetings}
    all_meeting_titles = {m.id: m.title for m in db.query(Meeting).all()}

    results = []
    for t, m in tasks_with_meetings:
        dep_title = all_task_titles.get(t.depends_on_task_id) if t.depends_on_task_id else None
        if not dep_title and t.depends_on_task_id:
            dep_obj = db.query(Task).filter(Task.id == t.depends_on_task_id).first()
            if dep_obj:
                dep_title = dep_obj.title

        upd_title = all_meeting_titles.get(t.updated_in_meeting_id) if t.updated_in_meeting_id else None

        results.append(
            TaskOut(
                id=t.id,
                meeting_id=t.meeting_id,
                title=t.title,
                owner=t.owner,
                deadline=t.deadline,
                status=t.status,
                evidence_quote=t.evidence_quote,
                confidence=t.confidence,
                needs_clarification=t.needs_clarification,
                clarification_question=t.clarification_question,
                depends_on_task_id=t.depends_on_task_id,
                depends_on_title=dep_title,
                status_evidence=t.status_evidence,
                updated_in_meeting_id=t.updated_in_meeting_id,
                updated_in_meeting_title=upd_title,
                meeting_title=m.title,
                meeting_date=m.meeting_date,
            )
        )
    return results


@app.get("/api/conflicts", response_model=List[ConflictOut])
def list_conflicts(db: Session = Depends(get_db)):
    """List all stored conflicts, newest first."""
    conflicts_with_meetings = (
        db.query(Conflict, Meeting)
        .join(Meeting, Conflict.meeting_id == Meeting.id)
        .order_by(Conflict.created_at.desc(), Conflict.id.desc())
        .all()
    )
    results = []
    for c, m in conflicts_with_meetings:
        results.append(
            ConflictOut(
                id=c.id,
                meeting_id=c.meeting_id,
                type=c.type,
                title=c.title,
                description=c.description,
                resolution=c.resolution,
                created_at=c.created_at,
                meeting_title=m.title,
                meeting_date=m.meeting_date,
            )
        )
    return results


@app.patch("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, updates: TaskUpdate, db: Session = Depends(get_db)):
    """Update status, owner, or deadline of a task manually."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if updates.status is not None:
        if updates.status not in ("pending", "done", "blocked"):
            raise HTTPException(status_code=400, detail="Invalid task status")
        task.status = updates.status

    if updates.owner is not None:
        task.owner = updates.owner.strip() if updates.owner.strip() else None
        if task.owner and task.needs_clarification and task.deadline:
            task.needs_clarification = False

    if updates.deadline is not None:
        task.deadline = updates.deadline.strip() if updates.deadline.strip() else None
        if task.deadline and task.owner and task.needs_clarification:
            task.needs_clarification = False

    db.commit()
    db.refresh(task)

    meeting = db.query(Meeting).filter(Meeting.id == task.meeting_id).first()
    dep_obj = db.query(Task).filter(Task.id == task.depends_on_task_id).first() if task.depends_on_task_id else None
    upd_m = db.query(Meeting).filter(Meeting.id == task.updated_in_meeting_id).first() if task.updated_in_meeting_id else None

    return TaskOut(
        id=task.id,
        meeting_id=task.meeting_id,
        title=task.title,
        owner=task.owner,
        deadline=task.deadline,
        status=task.status,
        evidence_quote=task.evidence_quote,
        confidence=task.confidence,
        needs_clarification=task.needs_clarification,
        clarification_question=task.clarification_question,
        depends_on_task_id=task.depends_on_task_id,
        depends_on_title=dep_obj.title if dep_obj else None,
        status_evidence=task.status_evidence,
        updated_in_meeting_id=task.updated_in_meeting_id,
        updated_in_meeting_title=upd_m.title if upd_m else None,
        meeting_title=meeting.title if meeting else None,
        meeting_date=meeting.meeting_date if meeting else None,
    )
