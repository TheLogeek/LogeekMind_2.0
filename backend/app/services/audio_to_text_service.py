import os
import tempfile
from typing import Dict, Any
from supabase import Client
import asyncio
from pywhispercpp.model import Model # Import Model from pywhispercpp

from app.services.usage_service import log_usage

# Global variable to store the Whisper model instance.
_whisper_model = None
_model_lock = asyncio.Lock()

async def get_whisper_model():
    """
    Asynchronously loads the Whisper 'tiny.en' model using pywhispercpp.
    """
    global _whisper_model
    async with _model_lock:
        if _whisper_model is None:
            print("Loading Whisper model (size: tiny.en) with pywhispercpp... This will happen once on startup.")
            try:
                # Use 'tiny.en' for English-only and better memory footprint.
                # n_threads=1 or 2 is good for low-RAM systems.
                _whisper_model = Model('tiny.en', n_threads=1)
                print("Whisper 'tiny.en' model loaded successfully.")
            except Exception as e:
                print(f"FATAL: Could not load pywhispercpp model. Error: {e}")
                _whisper_model = None
        return _whisper_model

async def transcribe_audio_file(
    supabase: Client,
    user_id: str,
    username: str,
    audio_content: bytes,
    file_name: str
) -> Dict[str, Any]:
    """
    Transcribes an audio file using the locally hosted 'tiny.en' Whisper model via pywhispercpp.
    """
    model = await get_whisper_model()
    if model is None:
        return {"success": False, "message": "Transcription model is not available. Please contact support."}
    
    tmp_audio_path = None
    try:
        # pywhispercpp prefers WAV. If audio_content is not WAV,
        # we might need to convert it, but for now, assume compatible format
        # or handle as a separate pre-processing step.
        # Save the audio content to a temporary file
        suffix = os.path.splitext(file_name)[1]
        if not suffix: suffix = ".wav" # Default to wav if no suffix
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmpfile:
            tmpfile.write(audio_content)
            tmp_audio_path = tmpfile.name

        # Run the CPU-intensive transcription in a separate thread
        # pywhispercpp's transcribe method is synchronous, so we run it in a thread pool.
        segments = await asyncio.to_thread(model.transcribe, tmp_audio_path)
        
        transcribed_text = "".join([segment.text for segment in segments]).strip()

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
                "model": "pywhispercpp-tiny.en"
            }
        ))

        return {"success": True, "transcribed_text": transcribed_text}

    except Exception as e:
        print(f"Error during audio transcription with pywhispercpp: {e}")
        return {"success": False, "message": f"An unexpected error occurred during transcription: {str(e)}"}
    finally:
        # Ensure the temporary file is always cleaned up
        if tmp_audio_path and os.path.exists(tmp_audio_path):
            os.remove(tmp_audio_path)