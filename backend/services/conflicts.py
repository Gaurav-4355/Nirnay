import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models import Decision, Task, Meeting
from ..schemas import ConflictItem, ProposalDecision, ProposalTask, ProposalTaskUpdate

WORKLOAD_THRESHOLD = 4


def normalize_val(val: str) -> str:
    """Normalize a decision value for conflict comparison."""
    if not val:
        return ""
    # Lowercase, remove non-alphanumeric characters, strip whitespace
    return re.sub(r"[^a-z0-9]", "", val.lower())


def parse_date(date_str: Optional[str]) -> Optional[datetime.date]:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


class TaskWrapper:
    """Helper to represent both existing and new tasks with effective values."""
    def __init__(
        self,
        key: str,
        title: str,
        owner: Optional[str],
        effective_deadline: Optional[str],
        effective_status: str,
        evidence_quote: Optional[str] = None,
        dep_key: Optional[str] = None,
    ):
        self.key = key
        self.title = title
        self.owner = owner.strip() if owner else None
        self.effective_deadline = effective_deadline.strip() if effective_deadline else None
        self.effective_status = effective_status
        self.evidence_quote = evidence_quote
        self.dep_key = dep_key


def detect_conflicts(
    db: Session,
    decisions: List[ProposalDecision],
    tasks: List[ProposalTask],
    task_updates: List[ProposalTaskUpdate],
) -> List[ConflictItem]:
    conflicts: List[ConflictItem] = []

    # -------------------------------------------------------------
    # 1. Decision Conflicts
    # -------------------------------------------------------------
    # Load all active decisions from DB with meeting details
    active_decisions = (
        db.query(Decision, Meeting)
        .join(Meeting, Decision.meeting_id == Meeting.id)
        .filter(Decision.status == "active")
        .all()
    )

    active_by_topic: Dict[str, tuple[Decision, Meeting]] = {
        d.topic.strip().lower(): (d, m) for d, m in active_decisions
    }

    for prop_d in decisions:
        topic_key = prop_d.topic.strip().lower()
        if topic_key in active_by_topic:
            old_d, old_m = active_by_topic[topic_key]
            if normalize_val(prop_d.value) != normalize_val(old_d.value):
                topic_display = topic_key.replace("_", " ").capitalize()
                desc = (
                    f"{topic_display} changed from {old_d.value} "
                    f"({old_m.title}, {old_m.meeting_date}) to {prop_d.value}"
                )
                conflicts.append(
                    ConflictItem(
                        type="decision_conflict",
                        title=f"Conflict on '{topic_key}'",
                        description=desc,
                        severity="high",
                        evidence_quote=prop_d.evidence_quote,
                        related_titles=[f"Previous: {old_d.value}", f"Proposed: {prop_d.value}"],
                        old_decision_id=old_d.id,
                        old_value=old_d.value,
                        old_meeting_title=old_m.title,
                        old_meeting_date=old_m.meeting_date,
                        new_value=prop_d.value,
                    )
                )

    # -------------------------------------------------------------
    # 2. Build Effective Task Map
    # -------------------------------------------------------------
    # Updates indexed by task_id
    updates_by_id: Dict[int, ProposalTaskUpdate] = {
        u.task_id: u for u in task_updates
    }

    # Load all non-done tasks from DB
    existing_tasks = db.query(Task).filter(Task.status.in_(["pending", "blocked"])).all()

    effective_tasks: Dict[str, TaskWrapper] = {}

    for t in existing_tasks:
        tu = updates_by_id.get(t.id)
        eff_status = tu.new_status if (tu and tu.new_status) else t.status
        eff_deadline = tu.new_deadline if (tu and tu.new_deadline) else t.deadline
        dep_key = f"existing_{t.depends_on_task_id}" if t.depends_on_task_id else None

        wrapper = TaskWrapper(
            key=f"existing_{t.id}",
            title=t.title,
            owner=t.owner,
            effective_deadline=eff_deadline,
            effective_status=eff_status,
            evidence_quote=t.evidence_quote,
            dep_key=dep_key,
        )
        effective_tasks[wrapper.key] = wrapper

    for idx, nt in enumerate(tasks):
        dep_key = None
        if nt.depends_on_existing_task_id:
            dep_key = f"existing_{nt.depends_on_existing_task_id}"
        elif nt.depends_on_new_task_index is not None and 0 <= nt.depends_on_new_task_index < len(tasks):
            dep_key = f"new_{nt.depends_on_new_task_index}"

        wrapper = TaskWrapper(
            key=f"new_{idx}",
            title=nt.title,
            owner=nt.owner,
            effective_deadline=nt.deadline,
            effective_status=nt.status or "pending",
            evidence_quote=nt.evidence_quote,
            dep_key=dep_key,
        )
        effective_tasks[wrapper.key] = wrapper

    # -------------------------------------------------------------
    # 3. Workload Overload Conflicts
    # -------------------------------------------------------------
    # Group active (non-done) tasks by owner
    tasks_by_owner: Dict[str, List[TaskWrapper]] = {}
    for tw in effective_tasks.values():
        if tw.effective_status == "done" or not tw.owner:
            continue
        owner_clean = tw.owner.strip().lower()
        if owner_clean not in tasks_by_owner:
            tasks_by_owner[owner_clean] = []
        tasks_by_owner[owner_clean].append(tw)

    for owner_clean, owner_tasks in tasks_by_owner.items():
        # Filter tasks with valid deadlines
        dated_tasks = []
        for ot in owner_tasks:
            d = parse_date(ot.effective_deadline)
            if d:
                dated_tasks.append((d, ot))

        dated_tasks.sort(key=lambda x: x[0])

        reported_windows = set()
        for i, (start_d, _) in enumerate(dated_tasks):
            end_d = start_d + timedelta(days=6)
            window_tasks = [
                task for (d, task) in dated_tasks if start_d <= d <= end_d
            ]

            if len(window_tasks) >= WORKLOAD_THRESHOLD:
                owner_display = window_tasks[0].owner or owner_clean.capitalize()
                titles_tuple = tuple(sorted(t.title for t in window_tasks))
                if titles_tuple not in reported_windows:
                    reported_windows.add(titles_tuple)
                    conflicts.append(
                        ConflictItem(
                            type="workload_overload",
                            title=f"Workload Overload: {owner_display}",
                            description=(
                                f"{owner_display} has {len(window_tasks)} tasks due between "
                                f"{start_d} and {end_d} (threshold is {WORKLOAD_THRESHOLD} in 7 days): "
                                f"{', '.join(t.title for t in window_tasks)}"
                            ),
                            severity="high",
                            related_titles=[t.title for t in window_tasks],
                        )
                    )

    # -------------------------------------------------------------
    # 4. Dependency Conflicts
    # -------------------------------------------------------------
    for tw in effective_tasks.values():
        if tw.effective_status == "done" or not tw.dep_key:
            continue
        dep_wrapper = effective_tasks.get(tw.dep_key)
        if not dep_wrapper or dep_wrapper.effective_status == "done":
            continue

        task_d = parse_date(tw.effective_deadline)
        dep_d = parse_date(dep_wrapper.effective_deadline)

        if task_d and dep_d and task_d < dep_d:
            task_owner = tw.owner or "Task"
            dep_owner = dep_wrapper.owner or "Dependency"
            desc = (
                f"{task_owner}'s '{tw.title}' is due {tw.effective_deadline} but depends on "
                f"{dep_owner}'s '{dep_wrapper.title}' due {dep_wrapper.effective_deadline}"
            )
            conflicts.append(
                ConflictItem(
                    type="dependency_conflict",
                    title=f"Dependency Conflict: {tw.title}",
                    description=desc,
                    severity="high",
                    evidence_quote=tw.evidence_quote,
                    related_titles=[tw.title, dep_wrapper.title],
                )
            )

    return conflicts
