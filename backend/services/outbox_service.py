import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from ..models import OutboxItem, Task, Meeting
from .trello import is_trello_configured, create_trello_card, update_trello_card
from .notify import is_webhook_configured, send_webhook_notification


def queue_tracker_create(db: Session, task: Task, meeting: Optional[Meeting] = None) -> OutboxItem:
    """Queues a tracker_create outbox item when a new task is confirmed."""
    meeting_info = f"Meeting: {meeting.title} ({meeting.meeting_date})" if meeting else "Nirnay Meeting"
    desc_lines = [
        f"**Owner:** {task.owner or 'Unassigned'}",
        f"**Deadline:** {task.deadline or 'None'}",
        f"**Source:** {meeting_info}",
        f"**Evidence:** \"{task.evidence_quote}\"",
    ]
    if task.depends_on_task:
        desc_lines.append(f"**Prerequisite:** Waits for '{task.depends_on_task.title}'")

    body_desc = "\n".join(desc_lines)
    payload_data = {
        "task_id": task.id,
        "title": task.title,
        "owner": task.owner,
        "deadline": task.deadline,
        "status": task.status or "pending",
        "description": body_desc,
    }

    item = OutboxItem(
        kind="tracker_create",
        target="trello",
        recipient=task.owner,
        title=f"Create Card: {task.title}",
        body=body_desc,
        payload=json.dumps(payload_data),
        related_task_id=task.id,
        dedupe_key=f"tracker_create:{task.id}",
        status="pending",
    )
    db.add(item)
    return item


def queue_tracker_update(
    db: Session,
    task: Task,
    new_status: Optional[str] = None,
    new_deadline: Optional[str] = None,
    evidence: Optional[str] = None,
) -> Optional[OutboxItem]:
    """Queues a tracker_update outbox item when a task changes status or deadline."""
    changes = []
    if new_status:
        changes.append(f"status: {task.status} -> {new_status}")
    if new_deadline:
        changes.append(f"deadline: {task.deadline} -> {new_deadline}")
    if not changes:
        return None

    change_desc = ", ".join(changes)
    body_text = f"Updating card for '{task.title}' ({change_desc})"
    if evidence:
        body_text += f"\nEvidence: \"{evidence}\""

    payload_data = {
        "task_id": task.id,
        "trello_card_id": task.trello_card_id,
        "new_status": new_status,
        "new_deadline": new_deadline,
    }

    item = OutboxItem(
        kind="tracker_update",
        target="trello",
        recipient=task.owner,
        title=f"Update Card: {task.title}",
        body=body_text,
        payload=json.dumps(payload_data),
        related_task_id=task.id,
        dedupe_key=None,  # multiple updates over time are allowed
        status="pending",
    )
    db.add(item)
    return item


def approve_outbox_item(db: Session, item: OutboxItem) -> Dict[str, Any]:
    """
    Executes an approved outbox item.
    Updates item.status to 'sent' or 'failed', with sent_at or error.
    """
    if item.status != "pending":
        return {"id": item.id, "status": item.status, "message": f"Item was already {item.status}"}

    try:
        if item.target == "trello":
            if is_trello_configured():
                payload = json.loads(item.payload or "{}")
                if item.kind == "tracker_create":
                    result = create_trello_card(
                        title=payload.get("title", item.title),
                        description=payload.get("description", item.body),
                        deadline=payload.get("deadline"),
                        status=payload.get("status", "pending"),
                    )
                    # Link card to task in DB
                    if item.related_task_id:
                        task = db.query(Task).filter(Task.id == item.related_task_id).first()
                        if task:
                            task.trello_card_id = result["card_id"]
                            task.trello_url = result["url"]

                    item.status = "sent"
                    item.sent_at = datetime.utcnow()
                    item.error = None
                elif item.kind == "tracker_update":
                    payload = json.loads(item.payload or "{}")
                    card_id = payload.get("trello_card_id")
                    if not card_id and item.related_task_id:
                        task = db.query(Task).filter(Task.id == item.related_task_id).first()
                        if task:
                            card_id = task.trello_card_id

                    if card_id:
                        update_trello_card(
                            card_id=card_id,
                            status=payload.get("new_status"),
                            deadline=payload.get("new_deadline"),
                        )
                    item.status = "sent"
                    item.sent_at = datetime.utcnow()
                    item.error = None
            else:
                # Internal tracker mode (Trello not configured)
                # "Show a visible amber label 'Internal tracker mode (Trello not configured)'... and approving a tracker item just marks it sent to the internal tracker with a note saying no external tracker was called."
                item.status = "sent"
                item.sent_at = datetime.utcnow()
                item.error = "Marked sent to internal tracker (Trello not configured)"

        elif item.target == "webhook":
            if is_webhook_configured():
                send_webhook_notification(title=item.title, body=item.body)
                item.status = "sent"
                item.sent_at = datetime.utcnow()
                item.error = None
            else:
                # "If the URL is not set, the item fails with the message 'No webhook configured' (do not fake success)."
                item.status = "failed"
                item.error = "No webhook configured"

        db.commit()
        db.refresh(item)
        return {
            "id": item.id,
            "status": item.status,
            "error": item.error,
            "sent_at": item.sent_at.isoformat() if item.sent_at else None,
        }
    except Exception as e:
        item.status = "failed"
        item.error = str(e)
        db.commit()
        db.refresh(item)
        return {"id": item.id, "status": "failed", "error": str(e)}


def reject_outbox_item(db: Session, item: OutboxItem) -> Dict[str, Any]:
    item.status = "rejected"
    db.commit()
    db.refresh(item)
    return {"id": item.id, "status": "rejected"}


def approve_all_pending(db: Session) -> List[Dict[str, Any]]:
    pending_items = db.query(OutboxItem).filter(OutboxItem.status == "pending").all()
    results = []
    for item in pending_items:
        res = approve_outbox_item(db, item)
        results.append(res)
    return results
