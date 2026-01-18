from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from supabase import Client
from typing import Dict, Any, Optional

from app.core.database import get_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import summarizer_service
from app.services import usage_service

router = APIRouter(
    prefix="/summarize",
    tags=["summarize"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 2

@router.post("/upload")
async def summarize_upload(
    file: UploadFile = File(...),
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_summarizer_upload"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"
    
    try:
        file_content = await file.read()
        extracted_text = await summarizer_service.extract_text_from_file_content(file_content, file.filename)

        if not extracted_text:
            raise HTTPException(status_code=400, detail="Could not extract text from the provided file or unsupported file type.")

        summary, gemini_error = await summarizer_service.summarize_text_content(extracted_text, user_id)

        if gemini_error:
            if "Rate Limit Hit" in gemini_error:
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=gemini_error)
            if "feature is currently unavailable" in gemini_error:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=gemini_error)
            raise HTTPException(status_code=500, detail=gemini_error)

        await usage_service.log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Summarizer",
            action="uploaded_file_summary",
            metadata={"file_name": file.filename, "text_length": len(extracted_text)}
        )
        return {"summary": summary}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@router.post("/text")
async def summarize_text_route(
    text: str = Form(...),
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_summarizer_text"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"
        
    try:
        if not text.strip():
            raise HTTPException(status_code=400, detail="Text to summarize cannot be empty.")

        summary, gemini_error = await summarizer_service.summarize_text_content(text, user_id)

        if gemini_error:
            if "Rate Limit Hit" in gemini_error:
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=gemini_error)
            if "feature is currently unavailable" in gemini_error:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=gemini_error)
            raise HTTPException(status_code=500, detail=gemini_error)

        await usage_service.log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Summarizer",
            action="text_summary",
            metadata={"text_length": len(text)}
        )
        return {"summary": summary}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")