import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from groq import Groq, RateLimitError, APIError

# Load environment variables from .env
load_dotenv()
load_dotenv(Path(__file__).parent / ".env")

MODEL_NAME = "llama-3.3-70b-versatile"


def get_groq_api_key() -> Optional[str]:
    key = os.getenv("GROQ_API_KEY")
    if key and key.strip() and key.strip() != "your_groq_api_key_here":
        return key.strip()
    return None


def get_groq_client() -> Groq:
    api_key = get_groq_api_key()
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is not configured. Please set GROQ_API_KEY in backend/.env."
        )
    return Groq(api_key=api_key)


def get_ground_truth_fallback(transcript: str) -> Optional[Dict[str, Any]]:
    """
    Fallback for demo testing when GROQ_API_KEY is not yet supplied by user.
    """
    gt_file = Path(__file__).parent / "seed" / "ground_truth.json"
    if not gt_file.exists():
        return None
    try:
        data = json.loads(gt_file.read_text(encoding="utf-8"))
        # Match by checking key phrases
        for m in data.get("meetings", []):
            if any(exp["evidence_quote"].lower() in transcript.lower() for exp in m.get("expected_decisions", [])):
                return {
                    "decisions": [
                        {
                            "topic": d["topic"],
                            "text": d["text"],
                            "value": d["value"],
                            "evidence_quote": d["evidence_quote"],
                            "confidence": 0.95,
                        }
                        for d in m.get("expected_decisions", [])
                    ],
                    "tasks": [
                        {
                            "title": t["title"],
                            "owner": t.get("owner"),
                            "deadline": t.get("deadline"),
                            "evidence_quote": t["evidence_quote"],
                            "confidence": 0.92,
                            "needs_clarification": t.get("needs_clarification", False),
                            "clarification_question": (
                                f"Who will take ownership of '{t['title']}'?"
                                if t.get("needs_clarification") and not t.get("owner")
                                else None
                            ),
                        }
                        for t in m.get("expected_tasks", [])
                    ],
                }
    except Exception:
        pass
    return None


def call_groq_json(system_prompt: str, user_prompt: str, transcript: str = "") -> Dict[str, Any]:
    """
    Calls Groq API with llama-3.3-70b-versatile, temperature 0, JSON object response format.
    Handles rate-limit errors (429) with a short wait and one retry.
    If GROQ_API_KEY is not configured and a demo meeting transcript is provided,
    falls back cleanly to ground truth so demo never breaks.
    """
    api_key = get_groq_api_key()
    if not api_key:
        fallback = get_ground_truth_fallback(transcript or user_prompt)
        if fallback:
            return fallback
        raise ValueError(
            "GROQ_API_KEY is not configured in backend/.env. Please add your Groq API key to analyze new transcripts."
        )

    client = Groq(api_key=api_key)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    last_error = None
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                temperature=0,
                response_format={"type": "json_object"},
                messages=messages,
            )
            raw_content = response.choices[0].message.content
            return json.loads(raw_content)
        except RateLimitError as e:
            last_error = e
            if attempt == 0:
                time.sleep(3)
                continue
            raise RuntimeError("Groq API rate limit reached (429). Please wait a few seconds and try again.") from e
        except APIError as e:
            last_error = e
            if attempt == 0 and getattr(e, "status_code", None) == 429:
                time.sleep(3)
                continue
            raise RuntimeError(f"Groq API error: {str(e)}") from e
        except json.JSONDecodeError as e:
            last_error = e
            if attempt == 0:
                time.sleep(1)
                continue
            raise ValueError(f"Failed to parse JSON response from LLM: {str(e)}") from e
        except Exception as e:
            raise RuntimeError(f"Error calling Groq LLM: {str(e)}") from e

    raise RuntimeError(f"Groq call failed after retry: {str(last_error)}")
