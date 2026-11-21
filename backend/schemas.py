from datetime import datetime
from typing import Optional, List
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


class LLMExtractionResult(BaseModel):
    decisions: List[ExtractedDecision] = Field(default_factory=list)
    tasks: List[ExtractedTask] = Field(default_factory=list)


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
    quote_start: Optional[int] = None
    quote_end: Optional[int] = None


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


class MeetingConfirmRequest(BaseModel):
    title: str
    meeting_date: str
    transcript: str
    decisions: List[ProposalDecision]
    tasks: List[ProposalTask]


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

    class Config:
        from_attributes = True


class MeetingListItem(BaseModel):
    id: int
    title: str
    meeting_date: str
    created_at: datetime
    decisions_count: int
    tasks_count: int

    class Config:
        from_attributes = True
