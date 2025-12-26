import whisper
import tempfile
import os
from typing import Dict, Any, Optional
from supabase import Client
import asyncio

from app.services.usage_service import log_usage

# Global variable to store the Whisper model instance
# This ensures the model is loaded only once when the module is imported
_whisper_model = None
_model_lock = asyncio.Lock() # To ensure thread-safe model loading

async def get_whisper_model():
    global _whisper_model
    async with _model_lock:
        if _whisper_model is None:
            # You might want to consider a smaller model like "base.en" or "tiny.en"
            # for faster loading and less memory usage if "base" is too heavy.
            print("Loading Whisper model (base)... This may take a moment.")
            _whisper_model = whisper.load_model("base")
            print("Whisper model loaded.")
        return _whisper_model

async def transcribe_audio_file(
    supabase: Client,
    user_id: str,
    username: str,
    audio_content: bytes,
    file_name: str
) -> Dict[str, Any]:
    
    model = await get_whisper_model()
    
    # Save the audio content to a temporary file
    suffix = os.path.splitext(file_name)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmpfile:
        tmpfile.write(audio_content)
        tmp_audio_path = tmpfile.name

    transcribed_text = None
    try:
        # Perform transcription
        # run in a separate thread to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, # Use the default ThreadPoolExecutor
            model.transcribe,
            tmp_audio_path
        )
        transcribed_text = result["text"]

        # Log usage
        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username, # Corrected keyword
            feature_name="Lecture Audio to Text Converter",
            action="transcribed",
            metadata={"file_name": file_name, "audio_length": "N/A", "transcribed_length": len(transcribed_text)}
        )

        return {"success": True, "transcribed_text": transcribed_text}

    except Exception as e:
        print(f"Error during audio transcription: {e}")
        return {"success": False, "message": str(e)}
    finally:
        # Clean up the temporary file
        if os.path.exists(tmp_audio_path):
            os.remove(tmp_audio_path)
