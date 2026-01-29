from fastapi import APIRouter, Depends, HTTPException, status, Form
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, List, Optional
from starlette.responses import StreamingResponse
import json
import logging

from app.core.database import get_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt, get_current_user_from_supabase_jwt
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
    creator_id: Optional[str] = None
    title: str
    quiz_data: List[Dict[str, Any]]
    created_at: str
    creator_username: str

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

        return SharedQuizData(**response)

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



@router.get("/shared-quizzes/{share_id}/submissions/{submission_id}/download")
async def download_shared_quiz_results(
    share_id: str,
    submission_id: str,
    supabase: Client = Depends(get_supabase_client),
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt) # Strict authentication
):
    """
    Downloads the results of a specific shared quiz submission as a DOCX file.
    Requires authentication, and the current user must be the owner of the submission.
    """
    try:
        # Use the service function to get all necessary data
        download_data_response = await smart_quiz_service.get_shared_quiz_submission_for_download(
            supabase=supabase,
            user_id=current_user["id"], # Pass authenticated user's ID
            shared_quiz_id=share_id,
            submission_id=submission_id
        )

        if not download_data_response["success"]:
            status_code = status.HTTP_404_NOT_FOUND if "not found" in download_data_response["message"].lower() else status.HTTP_403_FORBIDDEN
            raise HTTPException(status_code=status_code, detail=download_data_response["message"])

        # Generate the DOCX file
        docx_buffer = await smart_quiz_service.create_docx_from_quiz_results(
            quiz_data=download_data_response["quiz_data"],
            quiz_topic=download_data_response["quiz_topic"],
            user_score=download_data_response["user_score"],
            total_questions=download_data_response["total_questions"],
            user_answers=download_data_response["user_answers"]
        )

        # Log usage
        await smart_quiz_service.log_usage(
            supabase=supabase,
            user_id=current_user["id"],
            user_name=current_user.get("username", "Authenticated User"),
            feature_name="Quiz Download",
            action="downloaded",
            metadata={"shared_quiz_id": share_id, "submission_id": submission_id}
        )

        filename = f"quiz_results_{share_id}_{submission_id}.docx"
        return StreamingResponse(
            docx_buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error downloading shared quiz results for submission {submission_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred while processing the download.")

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


