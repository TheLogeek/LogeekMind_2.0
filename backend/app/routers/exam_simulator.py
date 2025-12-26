from fastapi import APIRouter, Depends, HTTPException, status, Body, Form
from pydantic import BaseModel, Field
from supabase import Client
from typing import Dict, Any, List, Optional, Tuple
from starlette.responses import StreamingResponse
import json
import time # For unique filename

from app.core.database import get_safe_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt, get_current_user_from_supabase_jwt
from app.services import exam_simulator_service

router = APIRouter(
    prefix="/exam-simulator",
    tags=["exam-simulator"],
    responses={404: {"description": "Not found"}},
)

# In-memory guest usage tracker for exam generation
guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 1

class ExamSetupRequest(BaseModel):
    course_name: str
    topic: Optional[str] = None
    num_questions: int
    duration_mins: int = 30
    gemini_api_key: Optional[str] = None

class ExamQuestion(BaseModel):
    question: str
    options: List[str]
    answer: str
    explanation: str

class ExamGenerateResponse(BaseModel):
    success: bool
    exam_data: Optional[List[ExamQuestion]] = None
    message: Optional[str] = None

class ExamSubmitRequest(BaseModel):
    exam_data: List[ExamQuestion]
    user_answers: Dict[str, str]
    course_name: str
    topic: Optional[str] = None

class ExamResultsResponse(BaseModel):
    success: bool
    score: Optional[int] = None
    total_questions: Optional[int] = None
    grade: Optional[str] = None
    remark: Optional[str] = None
    message: Optional[str] = None

@router.post("/generate", response_model=ExamGenerateResponse)
async def generate_exam_route(
    request: ExamSetupRequest,
    supabase: Client = Depends(get_safe_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_exam_simulator_generate"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"Guest limit of {GUEST_LIMIT} exam generations exceeded. Please log in for unlimited access.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        response = await exam_simulator_service.generate_exam_questions(
            supabase=supabase,
            user_id=user_id,
            username=username,
            course_name=request.course_name,
            topic=request.topic,
            num_questions=request.num_questions,
            gemini_api_key=request.gemini_api_key
        )
        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        return ExamGenerateResponse(success=True, exam_data=response["exam_data"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit-results", response_model=ExamResultsResponse)
async def submit_exam_results_route(
    request: ExamSubmitRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt), # Requires login to submit/log results
    supabase: Client = Depends(get_safe_supabase_client)
):
    try:
        response = await exam_simulator_service.grade_exam_and_log_performance(
            supabase=supabase,
            user_id=current_user["id"],
            username=current_user["username"],
            exam_data=request.exam_data,
            user_answers=request.user_answers,
            course_name=request.course_name,
            topic=request.topic
        )
        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        return ExamResultsResponse(**response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/download-results-docx")
async def download_exam_results_docx(
    exam_data_json: str = Form(..., alias="examDataJson"),
    user_answers_json: str = Form(..., alias="userAnswersJson"),
    score: int = Form(...),
    total_questions: int = Form(...),
    grade: str = Form(...),
    course_name: str = Form(...),
    topic: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt), # Requires login to download
    supabase: Client = Depends(get_safe_supabase_client)
):
    if not exam_data_json:
        raise HTTPException(status_code=400, detail="Exam data is required to generate DOCX.")
    
    try:
        exam_data = json.loads(exam_data_json)
        user_answers = json.loads(user_answers_json)

        docx_io = await exam_simulator_service.create_docx_from_exam_results(
            exam_data=exam_data,
            user_answers=user_answers,
            score=score,
            total_questions=total_questions,
            grade=grade,
            course_name=course_name,
            topic=topic
        )
        file_name = f"{course_name.replace(' ', '_')}_Exam_Results_{int(time.time())}.docx"
        return StreamingResponse(
            docx_io,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format for exam data or user answers.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during DOCX creation: {e}")
