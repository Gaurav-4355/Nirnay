import re
import difflib
from typing import Optional, Tuple


def find_quote_span(
    transcript: str, quote: str
) -> Tuple[Optional[int], Optional[int], str, float, bool]:
    """
    Validates and locates an evidence quote in the transcript.
    Returns:
      (start_idx, end_idx, matched_quote, confidence_multiplier, quote_matched_bool)
    """
    if not quote or not transcript:
        return None, None, quote, 0.3, False

    clean_quote = quote.strip()

    # 1. Exact match
    idx = transcript.find(clean_quote)
    if idx != -1:
        return idx, idx + len(clean_quote), clean_quote, 1.0, True

    # 2. Case-insensitive exact match
    lower_transcript = transcript.lower()
    lower_quote = clean_quote.lower()
    idx = lower_transcript.find(lower_quote)
    if idx != -1:
        matched_text = transcript[idx : idx + len(clean_quote)]
        return idx, idx + len(clean_quote), matched_text, 1.0, True

    # 3. Whitespace-normalized match (handles extra spaces, tabs, or newlines)
    words = clean_quote.split()
    if words:
        pattern = r"\s+".join(re.escape(w) for w in words)
        regex_match = re.search(pattern, transcript, re.IGNORECASE)
        if regex_match:
            start, end = regex_match.span()
            return start, end, transcript[start:end], 0.95, True

    # 4. Fuzzy match against transcript lines
    lines = []
    current_pos = 0
    for line in transcript.splitlines(keepends=True):
        line_start = current_pos
        line_end = current_pos + len(line.rstrip("\r\n"))
        raw_text = transcript[line_start:line_end].strip()
        if raw_text:
            lines.append((line_start, line_end, raw_text))
        current_pos += len(line)

    best_ratio = 0.0
    best_span = None
    best_matched_text = clean_quote

    for l_start, l_end, l_text in lines:
        # Check if line contains quote or vice versa
        if lower_quote in l_text.lower() or l_text.lower() in lower_quote:
            ratio = 0.85
        else:
            ratio = difflib.SequenceMatcher(None, lower_quote, l_text.lower()).ratio()

        if ratio > best_ratio:
            best_ratio = ratio
            best_span = (l_start, l_end)
            best_matched_text = transcript[l_start:l_end]

    # Threshold for fuzzy match
    if best_ratio >= 0.6 and best_span:
        return best_span[0], best_span[1], best_matched_text, 0.85, True

    # If still no match: lower confidence and mark unverified
    return None, None, clean_quote, 0.3, False
