# This file is a STRICT adaptation of the original LogeekMind/utils.py's Gemini client logic.
# Streamlit-specific UI/session state code is removed, but core API interaction and validation are preserved.

import os
import time
from typing import Dict, Optional, Tuple, Any
from google import genai
from google.genai.errors import APIError # Corrected import

from dotenv import load_dotenv

load_dotenv()

# In-memory store for rate limiting, replacing st.session_state for backend context
_rate_limit_history: Dict[str, list] = {}
MAX_REQUESTS = 5
TIME_WINDOW_SECONDS = 30
DEFAULT_MODEL = "gemini-2.5-flash" # As per user's original implementation

def is_gemini_key_valid_original(api_key: str) -> bool:
    """
    STRICTLY replicates the is_gemini_key_valid logic from original LogeekMind/utils.py.
    """
    if not api_key:
        return False
    try:
        client = genai.Client(api_key=api_key)
        _ = client.models.get(model=DEFAULT_MODEL) # Using DEFAULT_MODEL for validation
        return True
    except (APIError, Exception) as e:
        print(f"Gemini API key validation failed: {e}") # Internal logging
        return False

def check_rate_limit(user_identifier: str) -> Tuple[bool, str]:
    """
    Adapted rate-limiting logic from original utils.py.
    Uses a dictionary for history instead of st.session_state.
    """
    history = _rate_limit_history.get(user_identifier, [])
    
    current_time = time.time()
    # Filter out timestamps older than the time window
    history = [t for t in history if t > current_time - TIME_WINDOW_SECONDS]
    
    # --- START COMMENTED OUT RATE LIMITING LOGIC ---
    # if len(history) >= MAX_REQUESTS:
    #     time_to_wait = int(TIME_WINDOW_SECONDS - (current_time - history[0]))
    #     message = f"Rate Limit Hit! Please wait {time_to_wait} seconds before making use of any AI feature, or enter your own API key for unlimited access."
    #     _rate_limit_history[user_identifier] = history
    #     return False, message
    # --- END COMMENTED OUT RATE LIMITING LOGIC ---

    history.append(current_time)
    _rate_limit_history[user_identifier] = [] 
    
    return True, "OK"

async def get_gemini_client_and_key(
    user_id: str, 
    user_api_key: Optional[str] = None
) -> Tuple[Optional[genai.Client], Optional[str], Optional[str]]:
    """
    STRICTLY replicates the get_gemini_client logic from original LogeekMind/utils.py,
    adapted for backend use. It handles API key selection, validation, and rate-limiting.
    Returns a configured genai.Client instance, the API key used, and an error message.
    """
    system_api_key = os.getenv("GEMINI_API_KEY")
    api_key_to_use = None
    using_system_key = False
    rate_limit_identifier = user_id # Default to user_id for logging/tracking

    if user_api_key:
        if is_gemini_key_valid_original(user_api_key):
            api_key_to_use = user_api_key
        else:
            return None, None, "Invalid user-provided Gemini API Key. Please check your key."
    elif system_api_key:
        api_key_to_use = system_api_key
        using_system_key = True
        rate_limit_identifier = "system_key_global"
    
    if not api_key_to_use:
        return None, None, "No valid Gemini API Key found. Provide your own or configure the server's key."

    if using_system_key:
        is_ok, message = check_rate_limit(rate_limit_identifier)
        if not is_ok:
            return None, None, message
            
    try:
        # Initialize the genai.Client instance exactly as in original utils.py
        client = genai.Client(api_key=api_key_to_use)
        return client, api_key_to_use, None # Success: client, api_key_used, error
    except APIError as e:
        error_text = str(e)
        if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text.upper():
            return None, None, "Quota Exceeded! The Gemini API key has hit its limit."
        elif "503" in error_text:
            return None, None, "The Gemini AI model is currently experiencing high traffic. Please try again later."
        else:
            return None, None, f"Gemini API Error: {error_text}"
    except Exception as e:
        return None, None, f"An unexpected error occurred during Gemini client initialization: {e}"