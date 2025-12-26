import os
import requests
from typing import Dict, Any
from supabase import Client
import asyncio
from dotenv import load_dotenv

from app.services.usage_service import log_usage

load_dotenv()

# Hugging Face Inference API details for the 'base' model
API_URL = "https://api-inference.huggingface.co/models/openai/whisper-base"
HF_TOKEN = os.getenv("HF_TOKEN")

# Add a check on startup to log if the token is missing
if not HF_TOKEN:
    print("WARNING: HF_TOKEN environment variable is not set. Transcription service will not work.")

async def transcribe_audio_file(
    supabase: Client,
    user_id: str,
    username: str,
    audio_content: bytes,
    file_name: str
) -> Dict[str, Any]:
    
    if not HF_TOKEN:
        return {"success": False, "message": "Audio transcription service is currently not configured by the administrator."}

    headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    try:
        # Make the API call to Hugging Face. Added a timeout for safety.
        response = requests.post(API_URL, headers=headers, data=audio_content, timeout=120) # 120-second timeout
        
        # Check for authentication or other client-side errors first
        if response.status_code == 401:
            print("FATAL: Hugging Face API call failed with 401 Unauthorized. The HF_TOKEN is likely invalid or missing permissions.")
            return {"success": False, "message": "Transcription service authentication failed. Please contact support."}
        
        # Check for other non-successful status codes
        if response.status_code != 200:
            error_data = response.json()
            error_message = error_data.get("error", "An unknown error occurred with the transcription service.")
            print(f"Hugging Face API Error: Status {response.status_code}, Response: {error_message}") # Detailed log for admin

            if "is currently loading" in error_message:
                estimated_time = error_data.get("estimated_time", 25)
                return {"success": False, "message": f"The transcription model is warming up. Please try again in {int(estimated_time)} seconds."}
            
            return {"success": False, "message": f"Transcription Service Error: {error_message}"}

        result = response.json()
        transcribed_text = result.get("text")

        if transcribed_text is None:
            return {"success": False, "message": "Transcription failed. The model did not return any text."}

        # Log usage to Supabase in the background
        asyncio.create_task(log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Lecture Audio to Text Converter",
            action="transcribed",
            metadata={"file_name": file_name, "transcribed_length": len(transcribed_text), "model": "whisper-base-hf"}
        ))

        return {"success": True, "transcribed_text": transcribed_text}

    except requests.exceptions.RequestException as e:
        print(f"FATAL: Could not connect to Hugging Face API. Error: {e}")
        return {"success": False, "message": "Could not connect to the transcription service. Please check your network connection."}
    except Exception as e:
        print(f"An unexpected error occurred during audio transcription: {e}")
        return {"success": False, "message": f"An unexpected error occurred: {str(e)}"}
