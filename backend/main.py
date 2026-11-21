import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import engine, Base, get_db, init_and_migrate_db
from .models import Meeting, Decision, Task, Conflict, OutboxItem, AppSetting
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
    TodaySettingRequest,
    TodaySettingResponse,
    IntegrationsStatusResponse,
    OutboxItemOut,
    OutboxItemPatch,
    AskRequest,
    AskResponse,
)
from .services.meeting_service import analyze_meeting, save_confirmed_meeting
from .services.time_service import get_today, get_today_str, get_today_status, set_simulated_today
from .services.trello import is_trello_configured
from .services.notify import is_webhook_configured
from .services.outbox_service import (
    queue_tracker_create,
    queue_tracker_update,
    approve_outbox_item,
    reject_outbox_item,
    approve_all_pending,
)
from .services.reminders import scan_and_queue_reminders
from .services.digest import generate_weekly_digests
from .services.brief import generate_meeting_brief
from .services.eval_runner import (
    start_eval_job,
    get_eval_status,
    export_eval_snapshot,
    get_latest_eval_result,
)
from .services.ask_nirnay import answer_nirnay_question
from .services.dashboard import get_dashboard_data

# Initialize DB and automatically migrate any new columns/tables without deleting existing DB
init_and_migrate_db(engine)

app = FastAPI(
    title="Nirnay - Meeting-to-Execution Agent",
    description="Meeting ke faisle, kaam mein badlo.",
    version="1.0.0",
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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


# --- Settings / Simulated Today Endpoints ---
@app.get("/api/settings/today", response_model=TodaySettingResponse)
def get_today_endpoint(db: Session = Depends(get_db)):
    """Returns current effective date and whether it is simulated."""
    today_str, simulated = get_today_status(db)
    return TodaySettingResponse(today=today_str, simulated=simulated)


@app.put("/api/settings/today", response_model=TodaySettingResponse)
def set_today_endpoint(req: TodaySettingRequest, db: Session = Depends(get_db)):
    """Sets a simulated date (YYYY-MM-DD) or null to revert to the real date."""
    try:
        today_str, simulated = set_simulated_today(db, req.date)
        return TodaySettingResponse(today=today_str, simulated=simulated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")


# --- Integrations Status ---
@app.get("/api/integrations/status", response_model=IntegrationsStatusResponse)
def get_integrations_status():
    """Returns whether integrations are configured (booleans only, never keys)."""
    return IntegrationsStatusResponse(
        trello=is_trello_configured(),
        webhook=is_webhook_configured(),
    )


# --- Reset Endpoint ---
@app.post("/api/reset")
def reset_database(db: Session = Depends(get_db)):
    """Deletes all meetings, decisions, tasks, conflicts, and outbox items."""
    db.query(OutboxItem).delete()
    db.query(Conflict).delete()
    db.query(Decision).delete()
    db.query(Task).delete()
    db.query(Meeting).delete()
    db.commit()
    return {"status": "ok", "message": "All database records have been reset."}


# --- Demo Meetings ---
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


# --- Core Flow: Analyze & Confirm ---
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
    save new tasks in two passes for dependencies, store conflict records,
    and automatically queue outbox items for new tasks / updates.
    """
    if not request.title.strip() or not request.transcript.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title and transcript are required.",
        )
    return save_confirmed_meeting(db=db, request=request, queue_outbox=True)


# --- Outbox Endpoints ---
@app.get("/api/outbox", response_model=List[OutboxItemOut])
def list_outbox_items(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists outbox items optionally filtered by status, newest first."""
    query = db.query(OutboxItem)
    if status and status.strip():
        query = query.filter(OutboxItem.status == status.strip().lower())
    items = query.order_by(OutboxItem.created_at.desc(), OutboxItem.id.desc()).all()

    results = []
    for item in items:
        trello_link = item.related_task.trello_url if item.related_task else None
        results.append(
            OutboxItemOut(
                id=item.id,
                kind=item.kind,
                target=item.target,
                recipient=item.recipient,
                title=item.title,
                body=item.body,
                payload=item.payload,
                related_task_id=item.related_task_id,
                dedupe_key=item.dedupe_key,
                status=item.status,
                error=item.error,
                created_at=item.created_at,
                sent_at=item.sent_at,
                trello_url=trello_link,
            )
        )
    return results


@app.patch("/api/outbox/{item_id}", response_model=OutboxItemOut)
def patch_outbox_item(
    item_id: int,
    patch: OutboxItemPatch,
    db: Session = Depends(get_db),
):
    """Allows editing title and body of an outbox item while it is pending."""
    item = db.query(OutboxItem).filter(OutboxItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Outbox item not found")
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot edit an item that is already processed")

    if patch.title is not None:
        item.title = patch.title.strip()
    if patch.body is not None:
        item.body = patch.body.strip()

    db.commit()
    db.refresh(item)
    return item


@app.post("/api/outbox/{item_id}/approve")
def approve_item_endpoint(item_id: int, db: Session = Depends(get_db)):
    """Executes the outbox item (calls external Trello or Webhook, or marks sent in internal mode)."""
    item = db.query(OutboxItem).filter(OutboxItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Outbox item not found")
    return approve_outbox_item(db, item)


@app.post("/api/outbox/{item_id}/reject")
def reject_item_endpoint(item_id: int, db: Session = Depends(get_db)):
    """Rejects an outbox item so it is never sent."""
    item = db.query(OutboxItem).filter(OutboxItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Outbox item not found")
    return reject_outbox_item(db, item)


@app.post("/api/outbox/approve-all")
def approve_all_endpoint(db: Session = Depends(get_db)):
    """Approves and executes all pending outbox items."""
    return approve_all_pending(db)


# --- Reminders Endpoint ---
@app.post("/api/reminders/scan")
def scan_reminders_endpoint(db: Session = Depends(get_db)):
    """Scans all active tasks against current simulated today and queues reminders in outbox."""
    return scan_and_queue_reminders(db)


# --- Weekly Digest Endpoint ---
@app.post("/api/digests/generate")
def generate_digests_endpoint(db: Session = Depends(get_db)):
    """Generates per-person weekly execution digests and queues them in outbox."""
    return generate_weekly_digests(db)


# --- Meeting Brief Endpoint ---
@app.get("/api/brief")
def get_meeting_brief_endpoint(db: Session = Depends(get_db)):
    """Returns deterministic pre-meeting brief data + grounded agenda suggestions."""
    return generate_meeting_brief(db)


# --- Lists & Detail Endpoints ---
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
    """List tasks with optional ?owner= filter, dependencies, and Trello card URLs."""
    query = (
        db.query(Task, Meeting)
        .join(Meeting, Task.meeting_id == Meeting.id)
    )
    if owner and owner.strip():
        query = query.filter(Task.owner.ilike(f"%{owner.strip()}%"))

    tasks_with_meetings = query.order_by(Task.deadline.asc().nullslast(), Task.id.asc()).all()

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
                trello_card_id=t.trello_card_id,
                trello_url=t.trello_url,
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

    old_status = task.status
    old_deadline = task.deadline

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

    # Queue tracker_update if status or deadline changed
    if (updates.status and updates.status != old_status) or (updates.deadline and updates.deadline != old_deadline):
        queue_tracker_update(
            db=db,
            task=task,
            new_status=updates.status,
            new_deadline=updates.deadline,
        )

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
        trello_card_id=task.trello_card_id,
        trello_url=task.trello_url,
        meeting_title=meeting.title if meeting else None,
        meeting_date=meeting.meeting_date if meeting else None,
    )


# --- Accuracy Evaluation Endpoints ---
@app.post("/api/eval/run")
def run_evaluation_endpoint():
    """Starts a live evaluation background job against backend/seed/ground_truth.json."""
    job_id = start_eval_job()
    return {"job_id": job_id, "message": "Evaluation started in background"}


@app.get("/api/eval/status")
def eval_status_endpoint():
    """Returns the current state and progress of the background evaluation job."""
    return get_eval_status()


@app.get("/api/eval/latest")
def latest_eval_endpoint(db: Session = Depends(get_db)):
    """Returns the latest evaluation result or the benchmark snapshot."""
    res = get_latest_eval_result(db)
    if not res:
        raise HTTPException(status_code=404, detail="No evaluation result or snapshot found.")
    return res


@app.post("/api/eval/export-snapshot")
def export_snapshot_endpoint(data: Dict[str, Any]):
    """Exports the evaluation result to backend/seed/eval_snapshot.json."""
    path = export_eval_snapshot(data)
    return {"message": "Snapshot exported successfully", "path": path}


# --- Ask Nirnay Endpoints ---
@app.post("/api/ask", response_model=AskResponse)
def ask_nirnay_endpoint(req: AskRequest, db: Session = Depends(get_db)):
    """
    Answers user questions strictly grounded in historical meeting memory,
    decisions, tasks, and transcripts with exact quote citations.
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    res = answer_nirnay_question(db=db, question=req.question.strip(), history=req.history)
    return AskResponse(**res)


# --- Dashboard Endpoints ---
@app.get("/api/dashboard")
def get_dashboard_endpoint(db: Session = Depends(get_db)):
    """Returns aggregated executive dashboard data using simulated today date."""
    return get_dashboard_data(db)

