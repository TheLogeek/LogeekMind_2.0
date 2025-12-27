from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client
from typing import Dict, Any, List, Optional

from app.core.database import get_service_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import study_scheduler_service

router = APIRouter(
    prefix="/study-scheduler",
    tags=["study-scheduler"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 5

class SubjectInput(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the subject")
    priority: int = Field(..., ge=1, le=5, description="Priority level (1-5)")
    time_hr: float = Field(..., ge=0.5, description="Estimated study time per week in hours")

class ScheduleGenerateRequest(BaseModel):
    subjects: List[SubjectInput]

class ScheduleItem(BaseModel):
    day: str
    study_plan: str

class ScheduleGenerateResponse(BaseModel):
    success: bool
    schedule: Optional[List[ScheduleItem]] = None
    total_time_allocated_hr: Optional[float] = None
    message: Optional[str] = None

@router.post("/generate", response_model=ScheduleGenerateResponse)
async def generate_schedule_route(
    request: ScheduleGenerateRequest,
    supabase: Client = Depends(get_service_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_study_scheduler"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        subjects_data = [subject.dict() for subject in request.subjects]

        response = await study_scheduler_service.generate_schedule_service(
            supabase=supabase,
            user_id=user_id,
            username=username,
            subjects=subjects_data
        )

        if not response["success"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response["message"])
        
        return ScheduleGenerateResponse(
            success=True,
            schedule=response["schedule"],
            total_time_allocated_hr=response["total_time_allocated_hr"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
