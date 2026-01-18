from io import BytesIO
from typing import Optional, Tuple, Any
from pypdf import PdfReader
from docx import Document
from google import genai
from app.services.gemini_service import get_gemini_client, DEFAULT_MODEL
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

async def summarize_text_content(text_content: str, user_id: str) -> Tuple[str, Optional[str]]:
    """
    Summarizes text using the Gemini API.
    Returns a tuple of (summary_text, error_message).
    """
    
    gemini_client, gemini_error = await get_gemini_client(user_id)

    if gemini_error:
        return "", gemini_error

    if not gemini_client:
        return "", "Failed to initialize Gemini client due to a server error."

    prompt = (
        "Summarize the following lecture notes thoroughly. "
        "Output the most important key points as a clear, **bolded** bulleted list, "
        "and follow it with a one-paragraph summary overview. Use professional academic language. "
        f"\n\n--- NOTES ---\n\n{text_content}"
    )

    try:
        response = gemini_client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=[prompt]
        )
        return response.text, None
    except Exception as e:
        print(f"An unexpected error occurred during Gemini summarization: {e}")
        return "", "An unexpected error occurred while generating the summary."