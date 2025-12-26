from io import BytesIO
from typing import Optional, Tuple, Any
from pypdf import PdfReader
from docx import Document
from google import genai
from google.genai.errors import APIError
from app.services.gemini_service import get_gemini_client_and_key, DEFAULT_MODEL
import os

async def extract_text_from_file_content(file_content: bytes, file_name: str) -> Optional[str]:
    """Extracts text from a file content based on its extension, adapted for backend."""
    if file_name.lower().endswith('.pdf'):
        pdf_reader = PdfReader(BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text: # Ensure text is not None
                text += page_text + "\n"
        return text

    elif file_name.lower().endswith('.docx'):
        document = Document(BytesIO(file_content))
        text = ""
        for paragraph in document.paragraphs:
            text += paragraph.text + "\n"
        return text

    elif file_name.lower().endswith('.txt'):
        return file_content.decode("utf-8")

    else:
        return None

async def summarize_text_content(text_content: str, user_id: str, user_api_key: Optional[str] = None) -> Tuple[str, Optional[str]]:
    """
    Summarizes text using the Gemini API.
    Adapts the logic from the user-provided Streamlit summarizer.
    """
    
    # get_gemini_client_and_key is an async function, so it must be awaited.
    # It returns a synchronous genai.Client object.
    gemini_client, api_key_used, gemini_error = await get_gemini_client_and_key(user_id, user_api_key)

    if gemini_error:
        return "", gemini_error

    if not gemini_client: # Should not happen if gemini_error is checked, but for safety
        return "", "Failed to initialize Gemini client."

    prompt = (
        "Summarize the following lecture notes thoroughly. "
        "Output the most important key points as a clear, **bolded** bulleted list, "
        "and follow it with a one-paragraph summary overview. Use professional academic language. "
        f"\n\n--- NOTES ---\n\n{text_content}"
    )

    try:
        # Corrected: Use gemini_client.models.generate_content directly,
        # and DO NOT AWAIT IT, as it returns a synchronous response object,
        # matching the working pattern from course_outline_service.py.
        response = gemini_client.models.generate_content(
            model=DEFAULT_MODEL, # DEFAULT_MODEL is imported from gemini_service
            contents=[prompt]
        )
        return response.text, None
    except APIError as e:
        error_text = str(e)
        if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text.upper():
            return "", "Quota Exceeded! The Gemini API key has hit its limit."
        elif "503" in error_text:
            return "", "The Gemini AI model is currently experiencing high traffic. Please try again later."
        else:
            return "", f"Gemini API Error: {error_text}"
    except Exception as e:
        return "", f"An unexpected error occurred during Gemini summarization: {e}"