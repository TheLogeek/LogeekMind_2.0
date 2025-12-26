from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, Optional

from app.core.database import get_safe_supabase_client # Updated import
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import course_outline_service
from starlette.responses import StreamingResponse

router = APIRouter(
    prefix="/course-outline",
    tags=["course-outline"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 2

class CourseOutlineRequest(BaseModel):
    course_full_name: str
    course_code: Optional[str] = None
    university_name: Optional[str] = None
    gemini_api_key: Optional[str] = None
    outline_text: Optional[str] = None # For download endpoint

class CourseOutlineResponse(BaseModel):
    success: bool
    outline_text: Optional[str] = None
    message: Optional[str] = None

@router.post("/generate", response_model=CourseOutlineResponse)
async def generate_course_outline_route(
    request: CourseOutlineRequest,
    supabase: Client = Depends(get_safe_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_course_outline"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        response = await course_outline_service.generate_course_outline(
            supabase=supabase,
            user_id=user_id,
            username=username,
            course_full_name=request.course_full_name,
            course_code=request.course_code,
            university_name=request.university_name,
            api_key=request.gemini_api_key
        )
        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        return CourseOutlineResponse(success=True, outline_text=response["outline_text"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/download-docx")
async def download_course_outline_docx(
    request: CourseOutlineRequest,
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_safe_supabase_client)
):
    if not request.course_full_name or not request.outline_text:
        raise HTTPException(status_code=400, detail="Course full name and outline text are required.")
    
    try:
        docx_io = await course_outline_service.create_docx_from_outline(request.outline_text, request.course_full_name)
        file_name = f"{request.course_full_name.replace(' ', '_')}_Outline.docx"
        return StreamingResponse(
            docx_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during DOCX creation: {e}")