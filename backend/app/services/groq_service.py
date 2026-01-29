from groq import Groq
import os
from tenacity import retry, stop_after_attempt, wait_exponential
from groq import GroqError
import logging

logger = logging.getLogger(__name__)

def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.error("GROQ_API_KEY environment variable not set.")
        return None, "AI service not configured: GROQ_API_KEY is missing."

    return Groq(
        api_key=api_key,
        timeout=20
    ), None

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(), # Corrected from wait_after_attempt(1)
    reraise=True
)
def call_groq(client: Groq, messages: list, model: str, temperature: float = 0.4):
    """
    Wrapper for Groq API call with retry logic.
    """
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature
        )
        return response
    except GroqError as e:
        logger.error(f"Groq API call failed for model {model}: {e}")
        raise # Re-raise to be caught by tenacity
    except Exception as e:
        logger.error(f"An unexpected error occurred during Groq API call for model {model}: {e}")
        raise