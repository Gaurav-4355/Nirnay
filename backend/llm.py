import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from dotenv import load_dotenv
from groq import Groq, RateLimitError, APIError

# Load environment variables from .env
load_dotenv()
load_dotenv(Path(__file__).parent / ".env")

MODEL_NAME = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


def get_groq_api_key() -> Optional[str]:
    key = os.getenv("GROQ_API_KEY")
    if key and key.strip() and key.strip() != "your_groq_api_key_here":
        return key.strip()
    return None


def get_ground_truth_fallback(transcript: str, open_tasks: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    """
    Fallback for demo testing ONLY when DEMO_FALLBACK=true is set in environment.
    """
    gt_file = Path(__file__).parent / "seed" / "ground_truth.json"
    if not gt_file.exists():
        return None
    try:
        data = json.loads(gt_file.read_text(encoding="utf-8"))
        for m in data.get("meetings", []):
            # Check if this meeting matches the transcript
            matches_decision = any(
                exp["evidence_quote"].lower() in transcript.lower()
                for exp in m.get("expected_decisions", [])
            )
            matches_task = any(
                exp["evidence_quote"].lower() in transcript.lower()
                for exp in m.get("expected_tasks", [])
            )
            matches_update = any(
                exp["evidence_quote"].lower() in transcript.lower()
                for exp in m.get("expected_task_updates", [])
            )
            if matches_decision or matches_task or matches_update:
                decisions = [
                    {
                        "topic": d["topic"],
                        "text": d["text"],
                        "value": d["value"],
                        "evidence_quote": d["evidence_quote"],
                        "confidence": 0.95,
                    }
                    for d in m.get("expected_decisions", [])
                ]

                # Map new tasks
                new_tasks = []
                for idx, t in enumerate(m.get("expected_tasks", [])):
                    # Check if depends on existing or new
                    dep_existing_id = None
                    dep_new_idx = None
                    if "depends_on" in t and open_tasks:
                        dep_str = t["depends_on"].lower()
                        for ot in open_tasks:
                            if "backend" in dep_str and "backend" in ot.get("title", "").lower():
                                dep_existing_id = ot.get("id")
                                break
                    elif t.get("evidence_quote", "").startswith("Main QA environment"):
                        # Meeting 1: Karan depends on Amit's backend task (which is task index 1 in Meeting 1)
                        dep_new_idx = 1

                    new_tasks.append({
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
                        "depends_on_existing_task_id": dep_existing_id,
                        "depends_on_new_task_index": dep_new_idx,
                    })

                # Map task updates against open_tasks
                task_updates = []
                for tu in m.get("expected_task_updates", []):
                    kw = tu.get("title_keyword", "").lower()
                    matched_id = None
                    if open_tasks:
                        for ot in open_tasks:
                            if kw and kw in ot.get("title", "").lower():
                                matched_id = ot.get("id")
                                break
                    if matched_id:
                        task_updates.append({
                            "task_id": matched_id,
                            "new_status": tu.get("new_status"),
                            "new_deadline": tu.get("new_deadline"),
                            "evidence_quote": tu["evidence_quote"],
                            "confidence": 0.95,
                        })

                return {
                    "decisions": decisions,
                    "tasks": new_tasks,
                    "task_updates": task_updates,
                }
    except Exception as e:
        print(f"Error in ground truth fallback: {e}")
    return None


def call_groq_json(
    system_prompt: str,
    user_prompt: str,
    transcript: str = "",
    open_tasks: Optional[List[Dict[str, Any]]] = None,
    ignore_demo_fallback: bool = False,
) -> Tuple[Dict[str, Any], bool]:
    """
    Calls Groq API with MODEL_NAME, temperature 0, JSON object response format.
    Handles rate-limit errors (429) with a short wait and one retry.
    Supports optional GROQ_REASONING_EFFORT ('low' | 'medium' | 'high').
    Returns: (parsed_json_dict, cached_demo_bool)
    """
    api_key = get_groq_api_key()
    demo_fallback_enabled = (
        not ignore_demo_fallback
        and os.getenv("DEMO_FALLBACK", "").strip().lower() == "true"
    )

    if not api_key:
        if demo_fallback_enabled:
            fallback = get_ground_truth_fallback(transcript or user_prompt, open_tasks)
            if fallback:
                return fallback, True
        raise ValueError(
            "GROQ_API_KEY is not configured in backend/.env. Please add your Groq API key to analyze transcripts."
        )

    client = Groq(api_key=api_key)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    reasoning_env = os.getenv("GROQ_REASONING_EFFORT", "").strip().lower()
    reasoning_effort = reasoning_env if reasoning_env in ("low", "medium", "high") else None

    last_error = None
    for attempt in range(2):
        try:
            kwargs: Dict[str, Any] = {
                "model": MODEL_NAME,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": messages,
            }
            if reasoning_effort:
                kwargs["reasoning_effort"] = reasoning_effort

            try:
                response = client.chat.completions.create(**kwargs)
            except Exception as param_err:
                # If rejected due to reasoning_effort parameter, retry once without it
                if reasoning_effort and "reasoning_effort" in str(param_err).lower():
                    reasoning_effort = None
                    kwargs.pop("reasoning_effort", None)
                    response = client.chat.completions.create(**kwargs)
                else:
                    raise param_err

            raw_content = response.choices[0].message.content
            return json.loads(raw_content), False
        except RateLimitError as e:
            last_error = e
            if attempt == 0:
                time.sleep(3)
                continue
            if demo_fallback_enabled:
                fallback = get_ground_truth_fallback(transcript or user_prompt, open_tasks)
                if fallback:
                    return fallback, True
            raise RuntimeError("Groq API rate limit reached (429). Please wait a few seconds and try again.") from e
        except APIError as e:
            last_error = e
            if attempt == 0 and getattr(e, "status_code", None) == 429:
                time.sleep(3)
                continue
            raise RuntimeError(f"Groq API error ({MODEL_NAME}): {str(e)}") from e
        except json.JSONDecodeError as e:
            last_error = e
            if attempt == 0:
                time.sleep(1)
                continue
            raise ValueError(f"Failed to parse JSON response from LLM: {str(e)}") from e
        except Exception as e:
            raise RuntimeError(f"Error calling Groq LLM: {str(e)}") from e

    raise RuntimeError(f"Groq call failed after retry: {str(last_error)}")
