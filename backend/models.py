from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .db import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    meeting_date = Column(String(50), nullable=False)  # stored as YYYY-MM-DD
    transcript = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    decisions = relationship("Decision", back_populates="meeting", foreign_keys="Decision.meeting_id", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="meeting", foreign_keys="Task.meeting_id", cascade="all, delete-orphan")
    conflicts = relationship("Conflict", back_populates="meeting", cascade="all, delete-orphan")


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    topic = Column(String(100), nullable=False, index=True)
    text = Column(Text, nullable=False)
    value = Column(String(255), nullable=False)
    evidence_quote = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=1.0)
    status = Column(String(50), nullable=False, default="active")  # "active" | "superseded"
    superseded_by_id = Column(Integer, ForeignKey("decisions.id"), nullable=True)

    meeting = relationship("Meeting", back_populates="decisions", foreign_keys=[meeting_id])
    superseded_by = relationship("Decision", remote_side=[id], foreign_keys=[superseded_by_id])


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    title = Column(String(255), nullable=False)
    owner = Column(String(100), nullable=True)
    deadline = Column(String(50), nullable=True)  # YYYY-MM-DD or None
    status = Column(String(50), nullable=False, default="pending")  # "pending" | "done" | "blocked"
    evidence_quote = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=1.0)
    needs_clarification = Column(Boolean, nullable=False, default=False)
    clarification_question = Column(Text, nullable=True)
    depends_on_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    status_evidence = Column(Text, nullable=True)
    updated_in_meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=True)
    trello_card_id = Column(String(100), nullable=True)
    trello_url = Column(String(500), nullable=True)

    meeting = relationship("Meeting", back_populates="tasks", foreign_keys=[meeting_id])
    depends_on_task = relationship("Task", remote_side=[id], foreign_keys=[depends_on_task_id])
    updated_in_meeting = relationship("Meeting", foreign_keys=[updated_in_meeting_id])
    outbox_items = relationship("OutboxItem", back_populates="related_task")


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    type = Column(String(50), nullable=False)  # "decision_conflict" | "workload_overload" | "dependency_conflict"
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    resolution = Column(String(50), nullable=True)  # "kept_new" | "kept_old" | "acknowledged"
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="conflicts")


class OutboxItem(Base):
    __tablename__ = "outbox_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    kind = Column(String(50), nullable=False)  # "tracker_create" | "tracker_update" | "reminder" | "digest"
    target = Column(String(50), nullable=False)  # "trello" | "webhook"
    recipient = Column(String(100), nullable=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    payload = Column(Text, nullable=True)  # JSON text
    related_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    dedupe_key = Column(String(255), unique=True, index=True, nullable=True)
    status = Column(String(50), nullable=False, default="pending")  # "pending" | "sent" | "rejected" | "failed"
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)

    related_task = relationship("Task", back_populates="outbox_items", foreign_keys=[related_task_id])
