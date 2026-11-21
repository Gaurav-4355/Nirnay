from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# --- Raw Extraction Schemas (from LLM) ---
class ExtractedDecision(BaseModel):
    topic: str = Field(..., description="Short normalized label for what the decision is about (e.g. launch_date, pricing, tech_stack)")
    text: str = Field(..., description="Summary of the decision")
    value: str = Field(..., description="The concrete agreed value or specification (e.g. 15 Jan 2027, Rs 499/month)")
    evidence_quote: str = Field(..., description="Exact character-for-character quote from the transcript")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")


class ExtractedTask(BaseModel):
    title: str = Field(..., description="Actionable title of the task")
    owner: Optional[str] = Field(None, description="Owner of the task, or null if unclear")
    deadline: Optional[str] = Field(None, description="Resolved date in YYYY-MM-DD or null")
    evidence_quote: str = Field(..., description="Exact character-for-character quote from the transcript")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    needs_clarification: bool = Field(False, description="True if owner or deadline is missing or ambiguous")
    clarification_question: Optional[str] = Field(None, description="Short question asking who owns it or when it is due")
    depends_on_existing_task_id: Optional[int] = Field(None, description="ID of an existing open task this task depends on")
    depends_on_new_task_index: Optional[int] = Field(None, description="0-based index of another new task in this output")


class ExtractedTaskUpdate(BaseModel):
    task_id: int = Field(..., description="ID from EXISTING_OPEN_TASKS being updated")
    new_status: Optional[str] = Field(None, description="'done' | 'blocked' | 'pending' or null")
    new_deadline: Optional[str] = Field(None, description="Rescheduled date in YYYY-MM-DD or null")
    evidence_quote: str = Field(..., description="Exact character-for-character quote from transcript")
    confidence: float = Field(..., ge=0.0, le=1.0)


class LLMExtractionResult(BaseModel):
    decisions: List[ExtractedDecision] = Field(default_factory=list)
    tasks: List[ExtractedTask] = Field(default_factory=list)
    task_updates: List[ExtractedTaskUpdate] = Field(default_factory=list)


# --- API Proposal / Confirmation Schemas ---
class ProposalDecision(BaseModel):
    topic: str
    text: str
    value: str
    evidence_quote: str
    confidence: float
    status: str = "active"
    quote_start: Optional[int] = None
    quote_end: Optional[int] = None
    superseded_by_id: Optional[int] = None


class ProposalTask(BaseModel):
    title: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "pending"
    evidence_quote: str
    confidence: float
    needs_clarification: bool = False
    clarification_question: Optional[str] = None
    depends_on_task_id: Optional[int] = None
    depends_on_existing_task_id: Optional[int] = None
    depends_on_new_task_index: Optional[int] = None
    depends_on_title: Optional[str] = None
    quote_start: Optional[int] = None
    quote_end: Optional[int] = None


class ProposalTaskUpdate(BaseModel):
    task_id: int
    task_title: str
    owner: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    old_deadline: Optional[str] = None
    new_deadline: Optional[str] = None
    evidence_quote: str
    confidence: float
    quote_start: Optional[int] = None
    quote_end: Optional[int] = None
    included: bool = True


class ConflictItem(BaseModel):
    type: str  # "decision_conflict" | "workload_overload" | "dependency_conflict"
    title: str
    description: str
    severity: str = "high"  # "high" | "medium"
    evidence_quote: Optional[str] = None
    related_titles: List[str] = Field(default_factory=list)
    # Decision conflict specific
    old_decision_id: Optional[int] = None
    old_value: Optional[str] = None
    old_meeting_title: Optional[str] = None
    old_meeting_date: Optional[str] = None
    new_value: Optional[str] = None
    resolution: Optional[str] = None  # "kept_new" | "kept_old" | "acknowledged"


class MeetingAnalyzeRequest(BaseModel):
    title: str
    meeting_date: str
    transcript: str


class MeetingAnalyzeResponse(BaseModel):
    title: str
    meeting_date: str
    transcript: str
    decisions: List[ProposalDecision]
    tasks: List[ProposalTask]
    task_updates: List[ProposalTaskUpdate] = Field(default_factory=list)
    conflicts: List[ConflictItem] = Field(default_factory=list)
    cached_demo: bool = False


class ConflictResolutionInput(BaseModel):
    conflict_index: Optional[int] = None
    type: Optional[str] = None
    resolution: str  # "kept_new" | "kept_old" | "acknowledged"
    old_decision_id: Optional[int] = None
    topic: Optional[str] = None


class MeetingConfirmRequest(BaseModel):
    title: str
    meeting_date: str
    transcript: str
    decisions: List[ProposalDecision]
    tasks: List[ProposalTask]
    task_updates: List[ProposalTaskUpdate] = Field(default_factory=list)
    conflict_resolutions: List[Dict[str, Any]] = Field(default_factory=list)
    conflicts: List[ConflictItem] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    status: Optional[str] = None  # "pending", "done", "blocked"
    owner: Optional[str] = None
    deadline: Optional[str] = None


# --- Output Schemas ---
class DecisionOut(BaseModel):
    id: int
    meeting_id: int
    topic: str
    text: str
    value: str
    evidence_quote: str
    confidence: float
    status: str
    superseded_by_id: Optional[int] = None
    superseded_by_value: Optional[str] = None
    superseded_by_meeting_title: Optional[str] = None
    meeting_title: Optional[str] = None
    meeting_date: Optional[str] = None

    class Config:
        from_attributes = True


class TaskOut(BaseModel):
    id: int
    meeting_id: int
    title: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    status: str
    evidence_quote: str
    confidence: float
    needs_clarification: bool
    clarification_question: Optional[str] = None
    depends_on_task_id: Optional[int] = None
    depends_on_title: Optional[str] = None
    status_evidence: Optional[str] = None
    updated_in_meeting_id: Optional[int] = None
    updated_in_meeting_title: Optional[str] = None
    meeting_title: Optional[str] = None
    meeting_date: Optional[str] = None

    class Config:
        from_attributes = True


class ConflictOut(BaseModel):
    id: int
    meeting_id: int
    type: str
    title: str
    description: str
    resolution: Optional[str] = None
    created_at: datetime
    meeting_title: Optional[str] = None
    meeting_date: Optional[str] = None

    class Config:
        from_attributes = True


class MeetingOut(BaseModel):
    id: int
    title: str
    meeting_date: str
    transcript: str
    created_at: datetime
    decisions: List[DecisionOut] = []
    tasks: List[TaskOut] = []
    conflicts: List[ConflictOut] = []

    class Config:
        from_attributes = True


class MeetingListItem(BaseModel):
    id: int
    title: str
    meeting_date: str
    created_at: datetime
    decisions_count: int
    tasks_count: int
    conflicts_count: int = 0

    class Config:
        from_attributes = True
