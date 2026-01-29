from io import BytesIO
from typing import Optional, Tuple, Any
from pypdf import PdfReader
from docx import Document
from app.services.groq_service import get_groq_client, call_groq
from groq import GroqError
import os
import json
import logging

logger = logging.getLogger(__name__)

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
    Summarizes text using the Groq API.
    Returns a tuple of (summary_text, error_message).
    """
    
    client, error_message = get_groq_client()

    if error_message:
        return "", error_message

    system_prompt = "You are a professional text summarizer. Summarize the following lecture notes thoroughly."

    user_prompt = (
        "Output the most important key points as a clear, **bolded** bulleted list, "
        "and follow it with a one-paragraph summary overview. Use professional academic language. "
        f"\n\n--- NOTES ---\n\n{text_content}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        response = None
        models = [
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768"
        ]

        for model in models:
            try:
                response = call_groq(
                    client,
                    messages=messages,
                    model=model,
                    temperature=0.4
                )
                break
            except Exception as e:
                logger.warning(f"Groq model {model} failed for Summarizer: {e}")

        if not response:
            return "", "AI service is currently overloaded. Please try again."
        
        summary_text = response.choices[0].message.content.strip()
        return summary_text, None

    except GroqError as e:
        msg = str(e)
        if "429" in msg:
            logger.warning(f"Groq API rate limit exceeded during summarization: {e}")
            return "", "AI is currently experiencing high traffic. Please try again shortly."
        logger.error(f"Groq API error during summarization: {msg}", exc_info=True)
        return "", "AI service error. Please try again."
    except Exception as e:
        logger.error(f"An unexpected error occurred during summarization: {e}", exc_info=True)
        return "", "An unexpected error occurred while generating the summary."