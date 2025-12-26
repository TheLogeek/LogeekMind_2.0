import whisper
import tempfile
import os
from typing import Dict, Any
from supabase import Client
import asyncio
from app.services.usage_service import log_usage

# Global variable to store the Whisper model instance.
# This ensures the model is loaded only once on server startup.
_whisper_model = None
_model_lock = asyncio.Lock()

async def get_whisper_model():
    """
    Asynchronously loads the Whisper 'small' model. Uses a lock to prevent
    multiple concurrent loads on startup.
    """
    global _whisper_model
    async with _model_lock:
        if _whisper_model is None:
            print("Loading Whisper model (size: small)... This will happen once on startup.")
            try:
                # Using "small" model for a good balance of performance and memory
                _whisper_model = whisper.load_model("small")
                print("Whisper 'small' model loaded successfully.")
            except Exception as e:
                print(f"FATAL: Could not load Whisper model. Error: {e}")
                _whisper_model = None # Ensure it remains None on failure
        return _whisper_model

async def transcribe_audio_file(
    supabase: Client,
    user_id: str,
    username: str,
    audio_content: bytes,
    file_name: str
) -> Dict[str, Any]:
    """
    Transcribes an audio file using the locally hosted 'small' Whisper model.
    The CPU-bound transcription task is run in a separate thread to avoid
    blocking the main server event loop.
    """
    model = await get_whisper_model()
    if model is None:
        return {"success": False, "message": "Transcription model is not available. Please contact support."}
    
    tmp_audio_path = None
    try:
        # Create a temporary file to store the audio content for Whisper
        suffix = os.path.splitext(file_name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmpfile:
            tmpfile.write(audio_content)
            tmp_audio_path = tmpfile.name

        # Run the CPU-intensive transcription in a separate thread
        result = await asyncio.to_thread(model.transcribe, tmp_audio_path)
        transcribed_text = result.get("text")

        if not transcribed_text:
            return {"success": False, "message": "Transcription failed to produce text."}

        # Log usage in the background
        asyncio.create_task(log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Lecture Audio to Text Converter",
            action="transcribed",
            metadata={
                "file_name": file_name,
                "transcribed_length": len(transcribed_text),
                "model": "whisper-small"
            }
        ))

        return {"success": True, "transcribed_text": transcribed_text}

    except Exception as e:
        print(f"Error during audio transcription: {e}")
        return {"success": False, "message": f"An unexpected error occurred during transcription: {str(e)}"}
    finally:
        # Ensure the temporary file is always cleaned up
        if tmp_audio_path and os.path.exists(tmp_audio_path):
            os.remove(tmp_audio_path)