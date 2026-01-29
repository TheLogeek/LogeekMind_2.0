from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel

from app.core.security import get_current_user_from_supabase_jwt
from app.core.database import get_db_engine
from app.services import ai_insights_service

router = APIRouter()

class QuizInsightsRequest(BaseModel):
    quiz_topic: str
    quiz_data: List[Dict[str, Any]]
    user_answers: Dict[str, Any]
    user_score: int
    total_questions: int

class ExamInsightsRequest(BaseModel):
    quiz_topic: str # Reusing for exam topic
    quiz_data: List[Dict[str, Any]] # Reusing for exam data (questions/answers)
    user_answers: Dict[str, Any]
    user_score: int
    total_questions: int

@router.post("/ai-insights/quiz")
async def get_ai_quiz_insights_route(
    request: QuizInsightsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_db_supabase)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to get AI insights.")

    user_id = current_user["id"]
    username = current_user.get("username", "Unknown User") # Get username for logging

    insights_response = await ai_insights_service.get_quiz_ai_insights(
        supabase=supabase,
        user_id=user_id,
        username=username,
        quiz_topic=request.quiz_topic,
        quiz_data=request.quiz_data,
        user_answers=request.user_answers,
        user_score=request.user_score,
        total_questions=request.total_questions,
    )

    if not insights_response["success"]:
        raise HTTPException(status_code=500, detail=insights_response["message"])
    
    return {"success": True, "insights": insights_response["insights"]}

@router.post("/ai-insights/exam")
async def get_ai_exam_insights_route(
    request: ExamInsightsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_db_supabase)
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to get AI insights.")

    user_id = current_user["id"]
    username = current_user.get("username", "Unknown User") # Get username for logging

    insights_response = await ai_insights_service.get_quiz_ai_insights( # Reusing the quiz insights service
        supabase=supabase,
        user_id=user_id,
        username=username,
        quiz_topic=request.quiz_topic, # This will be the exam topic
        quiz_data=request.quiz_data, # This will be the exam data
        user_answers=request.user_answers,
        user_score=request.user_score,
        total_questions=request.total_questions,
    )

    if not insights_response["success"]:
        raise HTTPException(status_code=500, detail=insights_response["message"])
    
    return {"success": True, "insights": insights_response["insights"]}