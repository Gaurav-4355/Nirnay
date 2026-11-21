import os
from typing import Optional, Dict, Any, Tuple
import httpx

TRELLO_BASE_URL = "https://api.trello.com/1"
TIMEOUT_SECONDS = 10.0


def is_trello_configured() -> bool:
    api_key = os.getenv("TRELLO_API_KEY", "").strip()
    token = os.getenv("TRELLO_TOKEN", "").strip()
    board_id = os.getenv("TRELLO_BOARD_ID", "").strip()
    return bool(api_key and token and board_id)


def get_trello_credentials() -> Tuple[str, str, str]:
    api_key = os.getenv("TRELLO_API_KEY", "").strip()
    token = os.getenv("TRELLO_TOKEN", "").strip()
    board_id = os.getenv("TRELLO_BOARD_ID", "").strip()
    if not (api_key and token and board_id):
        raise ValueError("Trello is not configured. Missing TRELLO_API_KEY, TRELLO_TOKEN, or TRELLO_BOARD_ID.")
    return api_key, token, board_id


def get_or_create_lists(client: httpx.Client, board_id: str, key: str, token: str) -> Dict[str, str]:
    """
    Finds or creates 'To Do', 'Blocked', and 'Done' lists on the specified Trello board.
    Returns mapping: {"todo": list_id, "blocked": list_id, "done": list_id}
    """
    url = f"{TRELLO_BASE_URL}/boards/{board_id}/lists"
    resp = client.get(url, params={"key": key, "token": token}, timeout=TIMEOUT_SECONDS)
    if resp.status_code != 200:
        raise RuntimeError(f"Trello error fetching lists (status {resp.status_code}): {resp.text}")

    existing_lists = resp.json()
    mapping = {}
    for lst in existing_lists:
        name_lower = lst.get("name", "").strip().lower()
        if "to do" in name_lower or "todo" in name_lower:
            mapping["todo"] = lst["id"]
        elif "blocked" in name_lower:
            mapping["blocked"] = lst["id"]
        elif "done" in name_lower:
            mapping["done"] = lst["id"]

    # Create missing lists
    needed = [("todo", "To Do"), ("blocked", "Blocked"), ("done", "Done")]
    for key_name, display_name in needed:
        if key_name not in mapping:
            create_url = f"{TRELLO_BASE_URL}/boards/{board_id}/lists"
            create_resp = client.post(
                create_url,
                params={"name": display_name, "key": key, "token": token},
                timeout=TIMEOUT_SECONDS,
            )
            if create_resp.status_code in (200, 201):
                mapping[key_name] = create_resp.json()["id"]
            else:
                raise RuntimeError(f"Failed to create Trello list '{display_name}': {create_resp.text}")

    return mapping


def create_trello_card(
    title: str,
    description: str,
    deadline: Optional[str] = None,
    status: str = "pending",
) -> Dict[str, Any]:
    """
    Creates a card in Trello in the appropriate list.
    Returns dict: {"card_id": str, "url": str}
    """
    key, token, board_id = get_trello_credentials()

    with httpx.Client() as client:
        lists = get_or_create_lists(client, board_id, key, token)

        # Select list based on task status
        if status == "done":
            list_id = lists.get("done") or lists.get("todo")
        elif status == "blocked":
            list_id = lists.get("blocked") or lists.get("todo")
        else:
            list_id = lists.get("todo")

        params: Dict[str, Any] = {
            "key": key,
            "token": token,
            "idList": list_id,
            "name": title,
            "desc": description,
        }
        if deadline and deadline.strip():
            # Trello accepts ISO 8601 strings
            params["due"] = f"{deadline.strip()}T12:00:00Z"

        url = f"{TRELLO_BASE_URL}/cards"
        resp = client.post(url, params=params, timeout=TIMEOUT_SECONDS)
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Trello card creation failed ({resp.status_code}): {resp.text}")

        data = resp.json()
        card_id = data.get("id")
        card_url = data.get("shortUrl") or data.get("url") or f"https://trello.com/c/{card_id}"
        return {"card_id": card_id, "url": card_url}


def update_trello_card(
    card_id: str,
    status: Optional[str] = None,
    deadline: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Updates an existing card's list (status) and/or due date in Trello.
    """
    key, token, board_id = get_trello_credentials()

    with httpx.Client() as client:
        params: Dict[str, Any] = {"key": key, "token": token}

        if status:
            lists = get_or_create_lists(client, board_id, key, token)
            if status == "done":
                params["idList"] = lists.get("done")
            elif status == "blocked":
                params["idList"] = lists.get("blocked")
            elif status == "pending":
                params["idList"] = lists.get("todo")

        if deadline and deadline.strip():
            params["due"] = f"{deadline.strip()}T12:00:00Z"

        url = f"{TRELLO_BASE_URL}/cards/{card_id}"
        resp = client.put(url, params=params, timeout=TIMEOUT_SECONDS)
        if resp.status_code != 200:
            raise RuntimeError(f"Trello card update failed ({resp.status_code}): {resp.text}")

        return resp.json()
