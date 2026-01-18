# This file is a STRICT adaptation of the original LogeekMind/utils.py's Gemini client logic.
# Streamlit-specific UI/session state code is removed, but core API interaction and validation are preserved.

import os
import time
from typing import Dict, Optional, Tuple, Any
from google import genai
from google.genai.errors import APIError # Corrected import

from dotenv import load_dotenv

load_dotenv()

# In-memory store for rate limiting.
_rate_limit_history: Dict[str, list] = {}
MAX_REQUESTS = 6
TIME_WINDOW_SECONDS = 60
DEFAULT_MODEL = "gemini-2.5-flash"

def check_rate_limit(user_identifier: str) -> Tuple[bool, str]:
    """
    Checks if a user has exceeded the rate limit.
    Returns a tuple of (is_ok, message).
    """
    history = _rate_limit_history.get(user_identifier, [])
    current_time = time.time()
    
    # Filter out timestamps older than the time window
    history = [t for t in history if t > current_time - TIME_WINDOW_SECONDS]
    
    if len(history) >= MAX_REQUESTS:
        time_to_wait = int(TIME_WINDOW_SECONDS - (current_time - history[0]))
        message = f"Rate Limit Hit! Please wait {time_to_wait} seconds before making another request."
        _rate_limit_history[user_identifier] = history
        return False, message

    history.append(current_time)
    _rate_limit_history[user_identifier] = history 
    
    return True, "OK"

async def get_gemini_client(user_id: str) -> Tuple[Optional[genai.Client], Optional[str]]:
    """
    Handles API key selection, validation, and rate-limiting.
    Returns a configured genai.Client instance and an error message if any.
    """
    system_api_key = os.getenv("GEMINI_API_KEY")
    
    if not system_api_key:
        # This is a server configuration error, should not be shown to most users.
        return None, "Server is not configured with a Gemini API Key."

    # Apply rate limiting to all users.
    is_ok, message = check_rate_limit(user_id)
    if not is_ok:
        return None, message
            
    try:
        # Initialize the genai.Client instance.
        client = genai.Client(api_key=system_api_key)
        return client, None # Success: client, error
    except APIError:
        # If there's any API error (e.g. quota, wrong key), return a standardized message.
        return None, "The feature is currently unavailable. In the meantime, you can try other non-ai features."
    except Exception:
        # Catch any other unexpected errors during client initialization.
        return None, "An unexpected server error occurred while contacting the AI service."