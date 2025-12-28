from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from supabase import Client
from typing import Dict, Any, Optional

from app.core.database import get_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import audio_to_text_service

router = APIRouter(
    prefix="/audio-to-text",
    tags=["audio-to-text"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 2

@router.post("/transcribe")
async def transcribe_audio_route(
    file: UploadFile = File(...),
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_audio_to_text"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        audio_content = await file.read()
        
        response = await audio_to_text_service.transcribe_audio_file(
            supabase=supabase,
            user_id=user_id,
            username=username,
            audio_content=audio_content,
            file_name=file.filename
        )

        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        return {"transcribed_text": response["transcribed_text"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
