from datetime import datetime, date
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from ..models import Meeting, Decision, Task, Conflict, OutboxItem
from .time_service import get_today

WORKLOAD_THRESHOLD = 3  # Tasks due in next 7 days indicating overload


def get_dashboard_data(db: Session) -> Dict[str, Any]:
    today: date = get_today(db)
    today_str: str = today.strftime("%Y-%m-%d")

    # 1. Fetch core records
    meetings = db.query(Meeting).order_by(Meeting.meeting_date.desc(), Meeting.id.desc()).all()
    decisions = db.query(Decision).all()
    tasks = db.query(Task).all()
    conflicts = db.query(Conflict).all()
    outbox_items = db.query(OutboxItem).order_by(OutboxItem.created_at.desc(), OutboxItem.id.desc()).limit(15).all()

    meetings_by_id = {m.id: m for m in meetings}

    # 2. Compute KPIs
    meetings_count = len(meetings)
    active_decisions_count = sum(1 for d in decisions if d.status == "active")

    pending_tasks = sum(1 for t in tasks if t.status == "pending")
    blocked_tasks = sum(1 for t in tasks if t.status == "blocked")
    done_tasks = sum(1 for t in tasks if t.status == "done")
    total_tasks = len(tasks)
    completion_rate = round((done_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0

    clarification_count = sum(1 for t in tasks if t.needs_clarification and t.status != "done")

    overdue_count = 0
    due_next_7_days_count = 0

    for t in tasks:
        if t.status in ("pending", "blocked") and t.deadline and t.deadline.strip():
            try:
                t_date = datetime.strptime(t.deadline.strip(), "%Y-%m-%d").date()
                diff = (t_date - today).days
                if diff < 0:
                    overdue_count += 1
                elif 0 <= diff <= 7:
                    due_next_7_days_count += 1
            except ValueError:
                pass

    unresolved_conflicts = sum(1 for c in conflicts if not c.resolution or c.resolution == "unresolved")

    kpis = {
        "meetings_count": meetings_count,
        "active_decisions_count": active_decisions_count,
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "blocked_tasks": blocked_tasks,
        "done_tasks": done_tasks,
        "completion_rate": completion_rate,
        "overdue_tasks": overdue_count,
        "due_next_7_days": due_next_7_days_count,
        "total_conflicts": len(conflicts),
        "unresolved_conflicts": unresolved_conflicts,
        "clarification_count": clarification_count,
    }

    # 3. Workload per owner
    owners_map: Dict[str, Dict[str, int]] = {}
    for t in tasks:
        owner = t.owner.strip() if t.owner and t.owner.strip() else "Unassigned"
        if owner not in owners_map:
            owners_map[owner] = {"pending": 0, "blocked": 0, "done": 0, "due_next_7_days": 0}

        st = t.status or "pending"
        if st in owners_map[owner]:
            owners_map[owner][st] += 1

        if st in ("pending", "blocked") and t.deadline and t.deadline.strip():
            try:
                t_date = datetime.strptime(t.deadline.strip(), "%Y-%m-%d").date()
                diff = (t_date - today).days
                if 0 <= diff <= 7:
                    owners_map[owner]["due_next_7_days"] += 1
            except ValueError:
                pass

    workload = []
    for owner, counts in sorted(owners_map.items(), key=lambda x: (x[0] == "Unassigned", x[0])):
        workload.append({
            "owner": owner,
            "pending": counts["pending"],
            "blocked": counts["blocked"],
            "done": counts["done"],
            "due_next_7_days": counts["due_next_7_days"],
            "is_overloaded": bool(counts["due_next_7_days"] >= WORKLOAD_THRESHOLD),
        })

    # 4. Next 10 Upcoming Deadlines
    deadline_tasks = []
    for t in tasks:
        if t.status in ("pending", "blocked") and t.deadline and t.deadline.strip():
            try:
                t_date = datetime.strptime(t.deadline.strip(), "%Y-%m-%d").date()
                diff = (t_date - today).days
                deadline_tasks.append({
                    "id": t.id,
                    "title": t.title,
                    "owner": t.owner or "Unassigned",
                    "deadline": t.deadline,
                    "status": t.status,
                    "days_left": diff,
                    "is_overdue": diff < 0,
                    "trello_url": t.trello_url,
                })
            except ValueError:
                pass

    deadline_tasks.sort(key=lambda x: x["days_left"])
    upcoming_deadlines = deadline_tasks[:10]

    # 5. Decision Memory Chains
    topics_map: Dict[str, List[Dict[str, Any]]] = {}
    for d in decisions:
        topic = d.topic.strip().lower()
        if topic not in topics_map:
            topics_map[topic] = []

        m = meetings_by_id.get(d.meeting_id)
        m_title = m.title if m else f"Meeting #{d.meeting_id}"
        m_date = m.meeting_date if m else ""

        topics_map[topic].append({
            "id": d.id,
            "value": d.value,
            "text": d.text,
            "status": d.status,
            "meeting_id": d.meeting_id,
            "meeting_title": m_title,
            "meeting_date": m_date,
            "superseded_by_id": d.superseded_by_id,
        })

    decision_chains = []
    for topic, d_list in sorted(topics_map.items()):
        # Sort by meeting_date then id
        d_list.sort(key=lambda x: (x["meeting_date"] or "", x["id"]))
        decision_chains.append({
            "topic": topic,
            "chain": d_list,
        })

    # 6. Conflict Radar by type
    conflict_radar = {
        "decision_conflict": sum(1 for c in conflicts if c.type == "decision_conflict"),
        "workload_overload": sum(1 for c in conflicts if c.type == "workload_overload"),
        "dependency_conflict": sum(1 for c in conflicts if c.type == "dependency_conflict"),
    }

    # 7. Recent Activity Feed (max 15 items)
    activities = []

    for m in meetings:
        activities.append({
            "type": "meeting",
            "title": f"Meeting Analyzed: {m.title}",
            "description": f"Held on {m.meeting_date}",
            "timestamp": m.created_at.isoformat() if m.created_at else m.meeting_date,
        })

    for t in tasks:
        if t.updated_in_meeting_id:
            m = meetings_by_id.get(t.updated_in_meeting_id)
            m_title = m.title if m else f"Meeting #{t.updated_in_meeting_id}"
            activities.append({
                "type": "task_update",
                "title": f"Task Updated: {t.title}",
                "description": f"Status: {t.status} | Updated in {m_title}",
                "timestamp": t.created_at.isoformat() if t.created_at else "",
            })

    for c in conflicts:
        activities.append({
            "type": "conflict",
            "title": f"Conflict Logged: {c.title}",
            "description": f"Type: {c.type} | Resolution: {c.resolution or 'Unresolved'}",
            "timestamp": c.created_at.isoformat() if c.created_at else "",
        })

    for item in outbox_items:
        if item.status in ("sent", "approved"):
            activities.append({
                "type": "outbox",
                "title": f"Outbox Dispatched: {item.title}",
                "description": f"Target: {item.target} | Recipient: {item.recipient or 'General'}",
                "timestamp": item.sent_at.isoformat() if item.sent_at else item.created_at.isoformat(),
            })

    activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    recent_activity = activities[:15]

    return {
        "today": today_str,
        "kpis": kpis,
        "workload": workload,
        "upcoming_deadlines": upcoming_deadlines,
        "decision_chains": decision_chains,
        "conflict_radar": conflict_radar,
        "recent_activity": recent_activity,
        "threshold": WORKLOAD_THRESHOLD,
    }
