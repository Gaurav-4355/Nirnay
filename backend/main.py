import os
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import engine, Base, get_db
from .models import Meeting, Decision, Task
from .schemas import (
    MeetingAnalyzeRequest,
    MeetingAnalyzeResponse,
    MeetingConfirmRequest,
    MeetingOut,
    MeetingListItem,
    DecisionOut,
    TaskOut,
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

# Enable CORS for frontend Vite server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Nirnay", "version": "1.0.0"}


@app.get("/api/seed/demo-meetings")
def get_demo_meetings():
    """
    Returns the 3 demo meetings from backend/seed/ to populate the frontend form.
    """
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
        if file_path.exists():
            transcript_text = file_path.read_text(encoding="utf-8")
        else:
            transcript_text = ""
        demos.append({
            "id": item["id"],
            "title": item["title"],
            "meeting_date": item["meeting_date"],
            "transcript": transcript_text,
        })

    return demos


@app.post("/api/meetings/analyze", response_model=MeetingAnalyzeResponse)
def analyze_meeting_endpoint(request: MeetingAnalyzeRequest):
    """
    Core flow step 1: Send transcript to Groq, extract decisions and tasks.
    DO NOT save anything to database yet. Return proposal.
    """
    if not request.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript cannot be empty.",
        )
    try:
        proposal = analyze_meeting(
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
    Core flow step 2: Save the meeting, decisions, and tasks into the database.
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
    db.flush()  # assign db_meeting.id

    # 2. Add Decisions
    for d in request.decisions:
        db_decision = Decision(
            meeting_id=db_meeting.id,
            topic=d.topic.strip().lower(),
            text=d.text.strip(),
            value=d.value.strip(),
            evidence_quote=d.evidence_quote.strip(),
            confidence=d.confidence,
            status=d.status or "active",
        )
        db.add(db_decision)

    # 3. Add Tasks
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
            depends_on_task_id=t.depends_on_task_id,
        )
        db.add(db_task)

    db.commit()
    db.refresh(db_meeting)
    return db_meeting


@app.get("/api/meetings", response_model=List[MeetingListItem])
def list_meetings(db: Session = Depends(get_db)):
    """
    List all meetings with counts of decisions and tasks.
    """
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
    """
    List all decisions with meeting context.
    """
    decisions = (
        db.query(Decision, Meeting)
        .join(Meeting, Decision.meeting_id == Meeting.id)
        .order_by(Meeting.meeting_date.desc(), Decision.id.asc())
        .all()
    )
    results = []
    for d, m in decisions:
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
        })
    return results


@app.get("/api/tasks", response_model=List[TaskOut])
def list_tasks(owner: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    List tasks with optional ?owner= filter.
    """
    query = (
        db.query(Task, Meeting)
        .join(Meeting, Task.meeting_id == Meeting.id)
    )
    if owner and owner.strip():
        query = query.filter(Task.owner.ilike(f"%{owner.strip()}%"))

    tasks_with_meetings = query.order_by(Task.deadline.asc().nullslast(), Task.id.asc()).all()

    results = []
    for t, m in tasks_with_meetings:
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
                meeting_title=m.title,
                meeting_date=m.meeting_date,
            )
        )
    return results


@app.patch("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, updates: TaskUpdate, db: Session = Depends(get_db)):
    """
    Update status, owner, or deadline of a task manually.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if updates.status is not None:
        if updates.status not in ("pending", "done", "blocked"):
            raise HTTPException(status_code=400, detail="Invalid task status")
        task.status = updates.status

    if updates.owner is not None:
        task.owner = updates.owner.strip() if updates.owner.strip() else None
        if task.owner and task.needs_clarification:
            # If owner was provided, check if deadline is also provided
            if task.deadline:
                task.needs_clarification = False

    if updates.deadline is not None:
        task.deadline = updates.deadline.strip() if updates.deadline.strip() else None
        if task.deadline and task.owner and task.needs_clarification:
            task.needs_clarification = False

    db.commit()
    db.refresh(task)

    meeting = db.query(Meeting).filter(Meeting.id == task.meeting_id).first()

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
        meeting_title=meeting.title if meeting else None,
        meeting_date=meeting.meeting_date if meeting else None,
    )
