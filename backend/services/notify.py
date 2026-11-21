import os
from typing import Dict, Any
import httpx

TIMEOUT_SECONDS = 10.0


def is_webhook_configured() -> bool:
    url = os.getenv("NOTIFY_WEBHOOK_URL", "").strip()
    return bool(url)


def send_webhook_notification(title: str, body: str) -> Dict[str, Any]:
    """
    Sends a notification payload to NOTIFY_WEBHOOK_URL.
    Supports Discord format ({"content": ...}) and Slack/generic format ({"text": ...}).
    """
    url = os.getenv("NOTIFY_WEBHOOK_URL", "").strip()
    if not url:
        raise ValueError("No webhook configured")

    message_text = f"**{title}**\n\n{body}" if title else body

    # Detect platform format
    if "discord.com" in url.lower():
        payload = {"content": message_text}
    else:
        payload = {"text": message_text}

    with httpx.Client() as client:
        try:
            resp = client.post(url, json=payload, timeout=TIMEOUT_SECONDS)
            if resp.status_code not in (200, 204):
                raise RuntimeError(f"Webhook delivery failed ({resp.status_code}): {resp.text}")
            return {"status": "delivered", "code": resp.status_code}
        except httpx.TimeoutException as e:
            raise RuntimeError("Webhook delivery timed out after 10s") from e
        except Exception as e:
            raise RuntimeError(f"Webhook delivery error: {str(e)}") from e
