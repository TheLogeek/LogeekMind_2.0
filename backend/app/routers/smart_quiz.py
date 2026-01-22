from fastapi import APIRouter, Depends, HTTPException, status, Form
from pydantic import BaseModel, Field
from supabase import Client
from typing import Dict, Any, List, Optional, Tuple
from starlette.responses import StreamingResponse
import json
import uuid # Import uuid for generating share IDs
import datetime # For timestamping submissions

from app.core.database import get_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt, get_current_user_from_supabase_jwt
from app.services import smart_quiz_service
import logging # Import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/smart-quiz",
    tags=["smart-quiz"],
    responses={404: {"description": "Not found"}},
)

# In-memory guest usage tracker for quiz generation
guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 1

class QuizGenerateRequest(BaseModel):
    quiz_topic: str
    num_questions: int
    quiz_type: str
    difficulty: int
    is_sharable: bool = False # Add flag for sharable quizzes

class QuizGenerateResponse(BaseModel):
    success: bool
    quiz_data: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None
    share_id: Optional[str] = None # Add share_id to response

class QuizPerformanceLogRequest(BaseModel):
    feature: str = "Quiz Generator"
    score: int
    total_questions: int
    correct_answers: int
    extra: Optional[Dict[str, Any]] = None

# --- New Models for Shared Quizzes ---
class SharedQuizData(BaseModel):
    id: str
    creator_id: str
    title: str
    quiz_data: List[Dict[str, Any]]
    created_at: str

class SharedQuizSubmissionRequest(BaseModel):
    user_answers: Dict[str, str]

class SharedQuizSubmissionResponse(BaseModel):
    success: bool
    submission_id: Optional[str] = None
    score: Optional[int] = None
    total_questions: Optional[int] = None
    grade: Optional[str] = None
    remark: Optional[str] = None
    message: Optional[str] = None

# --- API Endpoints ---

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
        # Re-introduce guest usage tracking
        guest_id = "guest_smart_quiz"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded. Please log in or sign up for unlimited access.")
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
            is_sharable=request.is_sharable # Pass the sharable flag
        )
        if not response["success"]:
            if "Rate Limit Hit" in response.get("message", ""):
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=response["message"])
            if "feature is currently unavailable" in response.get("message", ""):
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=response["message"])
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        
        # Return share_id only if it was successfully generated and saved
        return QuizGenerateResponse(success=True, quiz_data=response["quiz_data"], share_id=response.get("share_id"))

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"An unexpected error occurred during quiz generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred during quiz generation.")

@router.get("/shared-quizzes/{share_id}")
async def get_shared_quiz_route(
    share_id: str,
    supabase: Client = Depends(get_supabase_client)
):
    """Fetches a specific shared quiz by its share_id."""
    try:
        response = await smart_quiz_service.get_shared_quiz(supabase, share_id=share_id)
        if not response["success"]:
            if response["message"] == "Quiz not found.":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=response["message"])
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response["message"])
        
        # Return only necessary data for the taker
        return SharedQuizResponse(success=True, quiz_data=response["quiz_data"], creator_username=response.get("creator_username"))
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"An unexpected error occurred fetching shared quiz {share_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching the shared quiz.")

@router.post("/shared-quizzes/{share_id}/submit")
async def submit_shared_quiz_route(
    share_id: str,
    request: SharedQuizSubmissionRequest,
    supabase: Client = Depends(get_supabase_client)
):
    """Submits answers for a shared quiz and returns the score."""
    try:
        # Fetch the quiz data first to grade correctly
        quiz_fetch_response = await smart_quiz_service.get_shared_quiz(supabase, share_id=share_id)
        if not quiz_fetch_response["success"]:
            if quiz_fetch_response["message"] == "Quiz not found.":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=quiz_fetch_response["message"])
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=quiz_fetch_response["message"])
        
        quiz_data = quiz_fetch_response["quiz_data"]
        
        # Grade the quiz
        score = 0
        total_questions = len(quiz_data)
        for idx, q in enumerate(quiz_data):
            if request.user_answers.get(str(idx)) == q.get('answer'):
                score += 1
        
        # Use the helper function from the service for grading logic
        grade, remark = smart_quiz_service.calculate_grade(score, total_questions) 

        # Save submission (allow anonymous if student_id is null)
        submission_payload = {
            "shared_quiz_id": share_id,
            "score": score,
            "total_questions": total_questions,
            "user_answers": request.user_answers,
            "submitted_at": datetime.datetime.utcnow().isoformat() + "Z" # Use ISO format with Z for UTC
        }
        # Note: Currently, shared quizzes are intended for anonymous taking via link.
        # If a logged-in user takes it, their ID could be appended. For now, it will be null.

        submission_response = await smart_quiz_service.save_shared_quiz_submission(
            supabase=supabase,
            shared_quiz_id=share_id,
            student_id=None, # Anonymous submission for now
            user_answers=request.user_answers,
            score=score,
            total_questions=total_questions
        )

        if not submission_response["success"]:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=submission_response["message"])
        
        return SharedQuizSubmissionResponse(
            success=True,
            submission_id=submission_response["submission"]["id"],
            score=score,
            total_questions=total_questions,
            grade=grade,
            remark=remark
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON format for user answers.")
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"An unexpected error occurred during shared quiz submission: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while submitting your quiz answers.")


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
        logger.error(f"An error occurred while logging performance: {e}", exc_info=True)
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
        logger.error(f"An error occurred during DOCX creation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An error occurred during DOCX creation: {e}")