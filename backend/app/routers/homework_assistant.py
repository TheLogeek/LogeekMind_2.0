from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from supabase import Client
from typing import Dict, Any, Optional
from starlette.responses import StreamingResponse
import time

from app.core.database import get_service_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import homework_assistant_service
from app.services import usage_service

router = APIRouter(
    prefix="/homework-assistant",
    tags=["homework-assistant"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 1

@router.post("/solve")
async def solve_homework_route(
    file: UploadFile = File(...),
    context: Optional[str] = Form(None),
    gemini_api_key: Optional[str] = Form(None),
    supabase: Client = Depends(get_service_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_homework_assistant"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        image_content = await file.read()
        
        response = await homework_assistant_service.generate_homework_solution(
            supabase=supabase,
            user_id=user_id,
            username=username,
            image_content=image_content,
            image_mime_type=file.content_type,
            context=context,
            api_key=gemini_api_key
        )

        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        return {"solution_text": response["solution_text"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")

@router.post("/download-docx")
async def download_homework_solution_docx(
    solution_text: str = Form(...),
    context: Optional[str] = Form(None),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_service_client)
):
    if not solution_text:
        raise HTTPException(status_code=400, detail="Solution text is required to generate DOCX.")
    
    try:
        docx_io = await homework_assistant_service.create_docx_from_solution(solution_text, context)
        username = current_user["username"] if current_user else "guest"
        file_name = f"homework_solution_{username}_{int(time.time())}.docx"
        return StreamingResponse(
            docx_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during DOCX creation: {e}")