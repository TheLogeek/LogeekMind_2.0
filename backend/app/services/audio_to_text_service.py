import os
import requests
from typing import Dict, Any
from supabase import Client
import asyncio
from dotenv import load_dotenv

from app.services.usage_service import log_usage

load_dotenv()

# Hugging Face Inference API details
API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3"
HF_TOKEN = os.getenv("HF_TOKEN")

async def transcribe_audio_file(
    supabase: Client,
    user_id: str,
    username: str,
    audio_content: bytes,
    file_name: str
) -> Dict[str, Any]:
    
    if not HF_TOKEN:
        return {"success": False, "message": "Hugging Face API token is not configured on the server."}

    headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    try:
        # Make the API call to Hugging Face
        response = requests.post(API_URL, headers=headers, data=audio_content)
        
        # Check for errors from Hugging Face
        if response.status_code != 200:
            error_data = response.json()
            error_message = error_data.get("error", "An unknown error occurred with the transcription service.")
            # Handle model loading state
            if "is currently loading" in error_message:
                estimated_time = error_data.get("estimated_time", 20)
                return {"success": False, "message": f"The transcription model is warming up. Please try again in {int(estimated_time)} seconds."}
            return {"success": False, "message": f"Transcription Error: {error_message}"}

        result = response.json()
        transcribed_text = result.get("text")

        if not transcribed_text:
            return {"success": False, "message": "Transcription failed. The model did not return any text."}

        # Log usage to Supabase
        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Lecture Audio to Text Converter",
            action="transcribed",
            metadata={"file_name": file_name, "transcribed_length": len(transcribed_text), "model": "whisper-large-v3"}
        )

        return {"success": True, "transcribed_text": transcribed_text}

    except requests.exceptions.RequestException as e:
        print(f"Error during Hugging Face API call: {e}")
        return {"success": False, "message": "Could not connect to the transcription service. Please check your network connection."}
    except Exception as e:
        print(f"An unexpected error occurred during audio transcription: {e}")
        return {"success": False, "message": f"An unexpected error occurred: {str(e)}"}