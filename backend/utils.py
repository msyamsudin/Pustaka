from engine_params import AVG_CHARS_PER_TOKEN, MAX_PROMPT_TOKENS

def estimate_tokens(text: str) -> int:
    """Simple character-based token estimation."""
    return len(text) // AVG_CHARS_PER_TOKEN

def safe_truncate(text: str, max_tokens: int) -> str:
    """Truncates text to a maximum number of tokens with a marker."""
    max_chars = max_tokens * AVG_CHARS_PER_TOKEN
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n[TRUNCATED — content exceeds context limit]"
    return text

def validate_prompt_length(prompt: str):
    """Raises ValueError if the prompt exceeds the maximum token limit."""
    tokens = estimate_tokens(prompt)
    if tokens > MAX_PROMPT_TOKENS:
        raise ValueError(f"Prompt too long: ~{tokens} tokens (limit: {MAX_PROMPT_TOKENS})")
