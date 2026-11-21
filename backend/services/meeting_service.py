import json
from typing import Dict, Any
from pydantic import ValidationError
from ..prompts import EXTRACTION_SYSTEM_PROMPT, build_extraction_user_prompt
from ..llm import call_groq_json
from ..schemas import (
    LLMExtractionResult,
    MeetingAnalyzeResponse,
    ProposalDecision,
    ProposalTask,
)
from .quote_matcher import find_quote_span


def analyze_meeting(title: str, meeting_date: str, transcript: str) -> MeetingAnalyzeResponse:
    user_prompt = build_extraction_user_prompt(title, meeting_date, transcript)

    # Call LLM (makes exactly 1 call, retry inside if error)
    raw_response = call_groq_json(EXTRACTION_SYSTEM_PROMPT, user_prompt, transcript=transcript)

    # Validate output with Pydantic; if invalid, retry once
    try:
        validated = LLMExtractionResult.model_validate(raw_response)
    except ValidationError:
        # Retry once
        raw_response = call_groq_json(
            EXTRACTION_SYSTEM_PROMPT,
            user_prompt + "\n\nCRITICAL: Ensure the response matches the required JSON structure strictly.",
            transcript=transcript,
        )
        validated = LLMExtractionResult.model_validate(raw_response)

    # Process Decisions
    decisions = []
    for d in validated.decisions:
        q_start, q_end, matched_quote, multiplier, matched = find_quote_span(
            transcript, d.evidence_quote
        )
        conf = round(d.confidence * multiplier, 2)
        if not matched:
            conf = 0.3

        decisions.append(
            ProposalDecision(
                topic=d.topic.strip().lower(),
                text=d.text.strip(),
                value=d.value.strip(),
                evidence_quote=matched_quote or d.evidence_quote,
                confidence=conf,
                status="active",
                quote_start=q_start,
                quote_end=q_end,
            )
        )

    # Process Tasks
    tasks = []
    for t in validated.tasks:
        q_start, q_end, matched_quote, multiplier, matched = find_quote_span(
            transcript, t.evidence_quote
        )
        conf = round(t.confidence * multiplier, 2)
        needs_clar = t.needs_clarification
        clar_question = t.clarification_question

        if not matched:
            conf = 0.3
            needs_clar = True
            if not clar_question:
                clar_question = "Evidence quote was not found directly in transcript; please verify details."

        # If owner is missing, ensure clarification is flagged
        if not t.owner or t.owner.strip().lower() in ("null", "none", "unassigned", "unclear"):
            owner = None
            needs_clar = True
            if not clar_question:
                clar_question = f"Who will take ownership of '{t.title}'?"
        else:
            owner = t.owner.strip()

        # If deadline is missing or vague
        deadline = t.deadline.strip() if t.deadline else None
        if not deadline or deadline.lower() in ("null", "none"):
            deadline = None
            if not owner or needs_clar:
                needs_clar = True
                if not clar_question:
                    clar_question = f"When is '{t.title}' expected to be completed?"

        tasks.append(
            ProposalTask(
                title=t.title.strip(),
                owner=owner,
                deadline=deadline,
                status="pending",
                evidence_quote=matched_quote or t.evidence_quote,
                confidence=conf,
                needs_clarification=needs_clar,
                clarification_question=clar_question,
                quote_start=q_start,
                quote_end=q_end,
            )
        )

    return MeetingAnalyzeResponse(
        title=title,
        meeting_date=meeting_date,
        transcript=transcript,
        decisions=decisions,
        tasks=tasks,
    )
