from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, List, Optional

from app.core.database import get_supabase_client
from app.core.security import get_current_user_from_supabase_jwt
from app.services import lessons_service

router = APIRouter(
    prefix="/lessons",
    tags=["lessons"],
    responses={404: {"description": "Not found"}},
)

# --- Pydantic Models for Requests ---
class CreateLessonRequest(BaseModel):
    title: str
    is_public: bool
    content_config: Dict[str, bool]

class SaveContentRequest(BaseModel):
    content_type: str # 'outline', 'notes', 'quiz', 'exam'
    content_data: Any

class SubmitScoreRequest(BaseModel):
    score: int
    total_questions: int

# --- API Endpoints ---

@router.post("/create")
async def create_lesson_route(
    request: CreateLessonRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_supabase_client)
):
    """Creates a new lesson shell."""
    creator_id = current_user["id"]
    response = await lessons_service.create_lesson(
        supabase,
        creator_id=creator_id,
        title=request.title,
        is_public=request.is_public,
        content_config=request.content_config
    )
    if not response["success"]:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response["message"])
    return response

@router.get("/public")
async def get_public_lessons_route(
    search: Optional[str] = None, # Optional search query parameter
    supabase: Client = Depends(get_supabase_client)
):
    """Fetches all public lessons, with an optional search filter."""
    response = await lessons_service.get_public_lessons(supabase, search_query=search)
    if not response["success"]:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response["message"])
    return response

@router.get("/{lesson_id}")
async def get_lesson_route(
    lesson_id: str,
    supabase: Client = Depends(get_supabase_client)
):
    """Fetches a single lesson and its content by ID."""
    response = await lessons_service.get_lesson_by_id(supabase, lesson_id=lesson_id)
    if not response["success"]:
        if response["message"] == "Lesson not found.":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=response["message"])
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response["message"])
    return response

@router.post("/{lesson_id}/content")
async def save_lesson_content_route(
    lesson_id: str,
    request: SaveContentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_supabase_client)
):
    """Saves generated content to a lesson."""
    creator_id = current_user["id"]
    response = await lessons_service.save_lesson_content(
        supabase,
        lesson_id=lesson_id,
        creator_id=creator_id,
        content_type=request.content_type,
        content_data=request.content_data
    )
    if not response["success"]:
        if "Authorization error" in response["message"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=response["message"])
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response["message"])
    return response

@router.post("/{lesson_id}/submit-score")
async def submit_score_route(
    lesson_id: str,
    request: SubmitScoreRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_supabase_client)
):
    """Submits a student's score for a lesson's quiz or exam."""
    student_id = current_user["id"]
    response = await lessons_service.submit_student_score(
        supabase,
        lesson_id=lesson_id,
        student_id=student_id,
        score=request.score,
        total_questions=request.total_questions
    )
    if not response["success"]:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response["message"])
    return response
