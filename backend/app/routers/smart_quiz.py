from fastapi import APIRouter, Depends, HTTPException, status, Form
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, List, Optional
from starlette.responses import StreamingResponse
import json

from app.core.database import get_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import smart_quiz_service

router = APIRouter(
    prefix="/smart-quiz",
    tags=["smart-quiz"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 1

class QuizGenerateRequest(BaseModel):
    quiz_topic: str
    num_questions: int
    quiz_type: str
    difficulty: int
    gemini_api_key: Optional[str] = None

class QuizGenerateResponse(BaseModel):
    success: bool
    quiz_data: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None

class QuizPerformanceLogRequest(BaseModel):
    feature: str = "Quiz Generator"
    score: int
    total_questions: int
    correct_answers: int
    extra: Optional[Dict[str, Any]] = None

@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz_route(
    request: QuizGenerateRequest,
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_smart_quiz"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        response = await smart_quiz_service.generate_quiz_service(
            supabase=supabase,
            user_id=user_id,
            username=username,
            quiz_topic=request.quiz_topic,
            num_questions=request.num_questions,
            quiz_type=request.quiz_type,
            difficulty=request.difficulty,
            api_key=request.gemini_api_key
        )

        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        return QuizGenerateResponse(success=True, quiz_data=response["quiz_data"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")

@router.post("/log-performance")
async def log_quiz_performance_route(
    request: QuizPerformanceLogRequest,
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if not current_user:
        # Guests do not log performance
        return {"success": True, "message": "Performance not logged for guest users."}
        
    try:
        await smart_quiz_service.log_quiz_performance_service(
            supabase=supabase,
            user_id=current_user["id"],
            feature=request.feature,
            score=request.score,
            total_questions=request.total_questions,
            correct_answers=request.correct_answers,
            extra=request.extra
        )
        return {"success": True, "message": "Performance logged successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while logging performance: {e}")

@router.post("/download-results-docx")
async def download_quiz_results_docx(
    quiz_data_json: str = Form(..., alias="quizDataJson"),
    quiz_topic: str = Form(...),
    user_score: int = Form(...),
    total_questions: int = Form(...),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_supabase_client)
):
    if not quiz_data_json:
        raise HTTPException(status_code=400, detail="Quiz data is required to generate DOCX.")
    
    try:
        quiz_data = json.loads(quiz_data_json)
        docx_io = await smart_quiz_service.create_docx_from_quiz_results(quiz_data, quiz_topic, user_score, total_questions)
        file_name = f"{quiz_topic.replace(' ', '_')}_Quiz_Results.docx"
        return StreamingResponse(
            docx_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for quiz data.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during DOCX creation: {e}")