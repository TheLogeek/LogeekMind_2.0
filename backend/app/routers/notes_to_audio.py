from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from supabase import Client
from typing import Dict, Any, Optional
from starlette.responses import StreamingResponse
import time
import io

from app.core.database import get_service_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import notes_to_audio_service

router = APIRouter(
    prefix="/notes-to-audio",
    tags=["notes-to-audio"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 1

@router.post("/convert-text")
async def convert_text_to_audio_route(
    text: str = Form(...),
    supabase: Client = Depends(get_service_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_notes_to_audio_text"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"
        
    try:
        response = await notes_to_audio_service.convert_text_to_audio_service(
            supabase=supabase,
            user_id=user_id,
            username=username,
            text=text
        )

        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        
        file_name = f"notes_audio_{int(time.time())}.mp3"
        return StreamingResponse(
            io.BytesIO(response["audio_data"]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")

@router.post("/convert-file")
async def convert_file_to_audio_route(
    file: UploadFile = File(...),
    supabase: Client = Depends(get_service_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_notes_to_audio_file"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        file_content = await file.read()
        
        response = await notes_to_audio_service.convert_file_to_audio_service(
            supabase=supabase,
            user_id=user_id,
            username=username,
            file_content=file_content,
            file_name=file.filename
        )

        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        
        file_name = f"notes_audio_{int(time.time())}.mp3"
        return StreamingResponse(
            io.BytesIO(response["audio_data"]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
