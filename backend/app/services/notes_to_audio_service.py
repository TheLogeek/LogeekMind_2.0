from gtts import gTTS
import io
from typing import Dict, Any, Optional
from supabase import Client

from app.services.usage_service import log_usage
from app.services.summarizer_service import extract_text_from_file_content # Reusing text extraction


async def convert_text_to_audio_service(
    supabase: Client,
    user_id: str,
    username: str,
    text: str,
    file_name: Optional[str] = None
) -> Dict[str, Any]:
    
    if not text.strip():
        return {"success": False, "message": "Text cannot be empty for audio conversion."}

    try:
        tts = gTTS(text=text, lang="en")

        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)

        # Log usage
        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username, # Corrected keyword
            feature_name="Lecture Notes to Audio Converter",
            action="generated",
            metadata={"input_type": "text" if not file_name else "file", "text_length": len(text)}
        )

        return {"success": True, "audio_data": audio_buffer.getvalue()}
    except Exception as e:
        print(f"Error during audio generation: {e}")
        return {"success": False, "message": str(e)}

async def convert_file_to_audio_service(
    supabase: Client,
    user_id: str,
    username: str,
    file_content: bytes,
    file_name: str
) -> Dict[str, Any]:
    
    extracted_text = await extract_text_from_file_content(file_content, file_name)

    if not extracted_text:
        return {"success": False, "message": "Could not extract text from the provided file or unsupported file type."}

    return await convert_text_to_audio_service(supabase, user_id, username, extracted_text, file_name)
