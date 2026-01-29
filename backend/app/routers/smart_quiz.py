from fastapi import APIRouter, Depends, HTTPException, status, Form
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, List, Optional
from starlette.responses import StreamingResponse
import json
import logging

from app.core.database import get_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import smart_quiz_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/smart-quiz",
    tags=["smart-quiz"],
    responses={404: {"description": "Not found"}},
)

# Guest usage tracker
guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 1


# -----------------------------
# Request & Response Models
# -----------------------------
class QuizGenerateRequest(BaseModel):
    quiz_topic: str
    num_questions: int
    quiz_type: str
    difficulty: int
    is_sharable: bool = False

class QuizGenerateResponse(BaseModel):
    success: bool
    quiz_data: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None
    share_id: Optional[str] = None

class QuizPerformanceLogRequest(BaseModel):
    feature: str = "Quiz Generator"
    score: int
    total_questions: int
    correct_answers: int
    extra: Optional[Dict[str, Any]] = None

class SharedQuizData(BaseModel):
    id: str
    creator_id: str
    title: str
    quiz_data: List[Dict[str, Any]]
    created_at: str

class SharedQuizSubmissionRequest(BaseModel):
    user_answers: Dict[str, str]
    student_identifier: Optional[str] = None

class SharedQuizSubmissionResponse(BaseModel):
    success: bool
    submission_id: Optional[str] = None
    score: Optional[int] = None
    total_questions: Optional[int] = None
    grade: Optional[str] = None
    remark: Optional[str] = None
    message: Optional[str] = None


# -----------------------------
# Endpoints
# -----------------------------
@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz_route(
    request: QuizGenerateRequest,
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    # Determine user context
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_smart_quiz"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Guest limit exceeded. Please log in for unlimited access."
            )
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    # Generate quiz using Groq-powered service
    try:
        response = await smart_quiz_service.generate_quiz_service(
            supabase=supabase,
            user_id=user_id,
            username=username,
            quiz_topic=request.quiz_topic,
            num_questions=request.num_questions,
            quiz_type=request.quiz_type,
            difficulty=request.difficulty,
            is_sharable=request.is_sharable
        )

        if not response["success"]:
            msg = response.get("message", "Failed to generate quiz.")
            if "rate limit" in msg.lower():
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=msg)
            elif "unavailable" in msg.lower():
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=msg)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

        return QuizGenerateResponse(
            success=True,
            quiz_data=response["quiz_data"],
            share_id=response.get("share_id")
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during quiz generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unexpected error during quiz generation.")


@router.get("/shared-quizzes/{share_id}", response_model=SharedQuizData)
async def get_shared_quiz_route(
    share_id: str,
    supabase: Client = Depends(get_supabase_client)
):
    try:
        response = await smart_quiz_service.get_shared_quiz(supabase, share_id)
        if not response["success"]:
            msg = response.get("message", "Quiz not found.")
            if "not found" in msg.lower():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg)

        return SharedQuizData(
            id=share_id,
            creator_id=response.get("creator_id"),
            title=response.get("title"),
            quiz_data=response["quiz_data"],
            created_at=response.get("created_at")
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error fetching shared quiz {share_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unexpected error fetching shared quiz.")


@router.post("/shared-quizzes/{share_id}/submit", response_model=SharedQuizSubmissionResponse)
async def submit_shared_quiz_route(
    share_id: str,
    request: SharedQuizSubmissionRequest,
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    student_id = current_user["id"] if current_user else None
    try:
        submission_response = await smart_quiz_service.save_shared_quiz_submission(
            supabase=supabase,
            shared_quiz_id=share_id,
            student_id=student_id,
            user_answers=request.user_answers,
            student_identifier=request.student_identifier if not student_id else None
        )

        if not submission_response["success"]:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=submission_response.get("message"))

        return SharedQuizSubmissionResponse(**submission_response)

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error submitting shared quiz {share_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unexpected error submitting shared quiz.")



@router.get("/shared-quizzes/{share_id}/performance")
async def get_shared_quiz_performance_route(
    share_id: str,
    supabase: Client = Depends(get_supabase_client)
):
    """
    Fetches performance comparison data for a shared quiz.
    """
    try:
        # Determine the current user's score percentage if logged in, or handle guest scenario if needed.
        # For now, this endpoint is assumed to be called by frontend AFTER submission, so it will likely fetch all scores.
        # The backend service `get_quiz_performance_comparison` itself doesn't need the current user's score,
        # but rather queries all scores for the given share_id.
        
        response = await smart_quiz_service.get_quiz_performance_comparison(supabase, shared_quiz_id=share_id, current_score_percentage=0.0) # Dummy percentage, as this endpoint will fetch all data
        
        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=response.get("message"))
            
        return {
            "success": True,
            "comparison_message": response.get("comparison_message"),
            "percentile": response.get("percentile") # Include percentile if available
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error fetching shared quiz performance {share_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unexpected error fetching performance data.")

@router.post("/shared-quizzes/{share_id}/submit", response_model=SharedQuizSubmissionResponse)
async def submit_shared_quiz_route(
    share_id: str,
    request: SharedQuizSubmissionRequest,
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    student_id = current_user["id"] if current_user else None
    try:
        submission_response = await smart_quiz_service.save_shared_quiz_submission(
            supabase=supabase,
            shared_quiz_id=share_id,
            student_id=student_id,
            user_answers=request.user_answers,
            student_identifier=request.student_identifier if not student_id else None
        )

        if not submission_response["success"]:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=submission_response.get("message"))
        
        # Fetch performance comparison data *after* submission
        # We need the percentage score from the submission_response to pass to the comparison function if needed for direct comparison,
        # but the service function `get_quiz_performance_comparison` recalculates based on all submissions.
        # So, we just need the `shared_quiz_id` and the current user's percentage.
        
        # The percentage score is available in submission_response
        current_percentage = submission_response.get("percentage_score", 0.0) 

        # Fetch comparison data using the submission's share_id
        comparison_response = await smart_quiz_service.get_quiz_performance_comparison(
            supabase=supabase,
            shared_quiz_id=share_id,
            current_score_percentage=current_percentage
        )
        
        # Add comparison data to the response
        submission_response["comparison_message"] = comparison_response.get("comparison_message")
        submission_response["percentile"] = comparison_response.get("percentile")

        return SharedQuizSubmissionResponse(**submission_response)

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error submitting shared quiz {share_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unexpected error submitting shared quiz.")
