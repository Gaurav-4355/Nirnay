import pytest
from datetime import datetime
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import Base
from backend.models import Task, OutboxItem, Meeting
from backend.services.time_service import set_simulated_today, get_today
from backend.services.reminders import scan_and_queue_reminders
from backend.services.outbox_service import (
    queue_tracker_create,
    approve_outbox_item,
    reject_outbox_item,
    approve_all_pending,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_reminders_scan_and_deduplication(db_session):
    # Set simulated today to 2026-12-04
    set_simulated_today(db_session, "2026-12-04")
    assert str(get_today(db_session)) == "2026-12-04"

    # Create dummy meeting
    m = Meeting(title="Planning Meeting", meeting_date="2026-12-01", transcript="test")
    db_session.add(m)
    db_session.flush()

    # Task 1: Due tomorrow (2026-12-05) -> should trigger due_soon
    t1 = Task(
        meeting_id=m.id,
        title="Deploy to staging",
        owner="Pooja",
        deadline="2026-12-05",
        status="pending",
        evidence_quote="Pooja: kal tak staging pe dal dungi.",
    )
    # Task 2: Overdue (2026-12-01) -> should trigger overdue
    t2 = Task(
        meeting_id=m.id,
        title="Setup database schema",
        owner="Amit",
        deadline="2026-12-01",
        status="pending",
        evidence_quote="Amit: 1st Dec tak DB setup ready ho jayega.",
    )
    # Task 3: Blocked task -> should trigger blocked reminder
    t3 = Task(
        meeting_id=m.id,
        title="Run integration tests",
        owner="Karan",
        deadline="2026-12-10",
        status="blocked",
        evidence_quote="Karan: I am blocked on API specs.",
    )
    # Task 4: Far future task (2026-12-25) -> should not trigger
    t4 = Task(
        meeting_id=m.id,
        title="Final security audit",
        owner="Rahul",
        deadline="2026-12-25",
        status="pending",
        evidence_quote="Rahul: End of month.",
    )
    # Task 5: Done task (was due 2026-12-01) -> should not trigger
    t5 = Task(
        meeting_id=m.id,
        title="Initial kickoff",
        owner="Rahul",
        deadline="2026-12-01",
        status="done",
        evidence_quote="Done.",
    )
    db_session.add_all([t1, t2, t3, t4, t5])
    db_session.commit()

    # 1. Run first scan
    res1 = scan_and_queue_reminders(db_session)
    assert res1["new_reminders_queued"] == 3

    items = db_session.query(OutboxItem).filter(OutboxItem.kind == "reminder").all()
    assert len(items) == 3

    kinds = {item.dedupe_key.split(":")[0] for item in items}
    assert kinds == {"due_soon", "overdue", "blocked"}

    for item in items:
        assert item.status == "pending"
        assert item.target == "webhook"

    # 2. Run second scan on the SAME simulated day
    res2 = scan_and_queue_reminders(db_session)
    assert res2["new_reminders_queued"] == 0
    assert len(db_session.query(OutboxItem).filter(OutboxItem.kind == "reminder").all()) == 3


def test_outbox_approval_and_rejection(db_session):
    set_simulated_today(db_session, "2026-12-04")

    m = Meeting(title="Sprint 1", meeting_date="2026-12-01", transcript="test")
    db_session.add(m)
    db_session.flush()

    task = Task(
        meeting_id=m.id,
        title="Prepare slide deck",
        owner="Sneha",
        deadline="2026-12-04",
        status="pending",
        evidence_quote="Sneha will do slides.",
    )
    db_session.add(task)
    db_session.flush()

    # 1. Tracker create approval in internal mode (no Trello keys configured)
    with patch("backend.services.outbox_service.is_trello_configured", return_value=False):
        tracker_item = queue_tracker_create(db_session, task, m)
        db_session.commit()

        app_res = approve_outbox_item(db_session, tracker_item)
        assert app_res["status"] == "sent"
        assert tracker_item.status == "sent"
        assert tracker_item.sent_at is not None

    # 2. Webhook reminder without webhook configured -> fails gracefully
    reminder_item = OutboxItem(
        kind="reminder",
        target="webhook",
        recipient="Sneha",
        title="Reminder: Prepare slide deck",
        body="Due today",
        related_task_id=task.id,
        dedupe_key=f"due_soon:{task.id}:2026-12-04",
        status="pending",
    )
    db_session.add(reminder_item)
    db_session.commit()

    with patch("backend.services.outbox_service.is_webhook_configured", return_value=False):
        fail_res = approve_outbox_item(db_session, reminder_item)
        assert fail_res["status"] == "failed"
        assert reminder_item.status == "failed"
        assert "No webhook configured" in reminder_item.error

    # 3. Webhook reminder with mocked successful webhook
    reminder_item2 = OutboxItem(
        kind="reminder",
        target="webhook",
        recipient="Sneha",
        title="Reminder 2: Prepare slide deck",
        body="Due today",
        related_task_id=task.id,
        dedupe_key=f"due_soon_2:{task.id}:2026-12-04",
        status="pending",
    )
    db_session.add(reminder_item2)
    db_session.commit()

    with patch("backend.services.outbox_service.is_webhook_configured", return_value=True):
        with patch("backend.services.outbox_service.send_webhook_notification", return_value=True):
            ok_res = approve_outbox_item(db_session, reminder_item2)
            assert ok_res["status"] == "sent"
            assert reminder_item2.status == "sent"
            assert reminder_item2.sent_at is not None

    # 4. Rejection
    item_to_reject = OutboxItem(
        kind="reminder",
        target="webhook",
        recipient="Sneha",
        title="Spam reminder",
        body="Testing rejection",
        status="pending",
    )
    db_session.add(item_to_reject)
    db_session.commit()

    rej_res = reject_outbox_item(db_session, item_to_reject)
    assert rej_res["status"] == "rejected"
    assert item_to_reject.status == "rejected"


def test_approve_all_pending(db_session):
    set_simulated_today(db_session, "2026-12-04")

    # Add 2 items
    item1 = OutboxItem(kind="tracker_create", target="trello", title="Card 1", body="B1", status="pending")
    item2 = OutboxItem(kind="reminder", target="webhook", title="Reminder 1", body="B2", status="pending")
    db_session.add_all([item1, item2])
    db_session.commit()

    with patch("backend.services.outbox_service.is_trello_configured", return_value=False):
        with patch("backend.services.outbox_service.is_webhook_configured", return_value=True):
            with patch("backend.services.outbox_service.send_webhook_notification", return_value=True):
                results = approve_all_pending(db_session)
                assert len(results) == 2
                assert all(r["status"] == "sent" for r in results)
                assert item1.status == "sent"
                assert item2.status == "sent"
