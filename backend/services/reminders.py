from datetime import datetime, date
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ..models import Task, OutboxItem
from .time_service import get_today


def scan_and_queue_reminders(db: Session) -> Dict[str, Any]:
    """
    Scans all non-done tasks against simulated today.
    Creates outbox items for due-soon (<= 2 days), overdue (< 0 days), and blocked tasks.
    Uses dedupe_key = "<type>:<task_id>:<today>" so duplicate scans do nothing.
    """
    today: date = get_today(db)
    today_str: str = today.strftime("%Y-%m-%d")

    # Fetch non-done tasks
    tasks = db.query(Task).filter(Task.status.in_(["pending", "blocked"])).all()

    # Pre-fetch existing dedupe keys for today
    existing_keys = {
        row[0]
        for row in db.query(OutboxItem.dedupe_key)
        .filter(OutboxItem.dedupe_key.like(f"%:{today_str}"))
        .all()
        if row[0]
    }

    new_items: List[OutboxItem] = []

    for task in tasks:
        # 1. Blocked task alerts
        if task.status == "blocked":
            blocked_key = f"blocked:{task.id}:{today_str}"
            if blocked_key not in existing_keys:
                title = f"Blocked: {task.title} - needs attention"
                body = (
                    f"Task '{task.title}' assigned to {task.owner or 'Unassigned'} is currently BLOCKED.\n"
                    f"Evidence: \"{task.evidence_quote or task.status_evidence or 'N/A'}\""
                )
                item = OutboxItem(
                    kind="reminder",
                    target="webhook",
                    recipient=task.owner,
                    title=title,
                    body=body,
                    related_task_id=task.id,
                    dedupe_key=blocked_key,
                    status="pending",
                )
                db.add(item)
                new_items.append(item)
                existing_keys.add(blocked_key)

        # 2. Deadline checks (if deadline present)
        if task.deadline and task.deadline.strip():
            try:
                task_date = datetime.strptime(task.deadline.strip(), "%Y-%m-%d").date()
                diff_days = (task_date - today).days

                # Overdue check
                if diff_days < 0:
                    n_ago = abs(diff_days)
                    day_unit = "day" if n_ago == 1 else "days"
                    overdue_key = f"overdue:{task.id}:{today_str}"
                    if overdue_key not in existing_keys:
                        title = f"Overdue: {task.title} was due {task.deadline} ({n_ago} {day_unit} ago)"
                        body = (
                            f"Task '{task.title}' owned by {task.owner or 'Unassigned'} is OVERDUE.\n"
                            f"Target deadline was {task.deadline} ({n_ago} {day_unit} ago)."
                        )
                        item = OutboxItem(
                            kind="reminder",
                            target="webhook",
                            recipient=task.owner,
                            title=title,
                            body=body,
                            related_task_id=task.id,
                            dedupe_key=overdue_key,
                            status="pending",
                        )
                        db.add(item)
                        new_items.append(item)
                        existing_keys.add(overdue_key)

                # Due within 2 days (0 <= diff_days <= 2)
                elif 0 <= diff_days <= 2:
                    if diff_days == 0:
                        left_str = "due today"
                    elif diff_days == 1:
                        left_str = "1 day left"
                    else:
                        left_str = f"{diff_days} days left"

                    due_key = f"due_soon:{task.id}:{today_str}"
                    if due_key not in existing_keys:
                        title = f"Reminder: {task.title} is due on {task.deadline} ({left_str})"
                        body = (
                            f"Task '{task.title}' assigned to {task.owner or 'Unassigned'} is due on {task.deadline} ({left_str}).\n"
                            f"Please ensure deliverables are on track."
                        )
                        item = OutboxItem(
                            kind="reminder",
                            target="webhook",
                            recipient=task.owner,
                            title=title,
                            body=body,
                            related_task_id=task.id,
                            dedupe_key=due_key,
                            status="pending",
                        )
                        db.add(item)
                        new_items.append(item)
                        existing_keys.add(due_key)

            except ValueError:
                pass

    db.commit()
    for item in new_items:
        db.refresh(item)

    return {
        "today": today_str,
        "scanned_tasks_count": len(tasks),
        "new_reminders_queued": len(new_items),
        "items": [{"id": i.id, "title": i.title, "recipient": i.recipient, "dedupe_key": i.dedupe_key} for i in new_items],
    }
