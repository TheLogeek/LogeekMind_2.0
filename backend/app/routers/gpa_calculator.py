from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client
from typing import Dict, Any, List, Optional

from app.core.database import get_supabase_client
from app.core.security import try_get_current_user_from_supabase_jwt
from app.services import gpa_service
from app.services import usage_service

router = APIRouter(
    prefix="/gpa",
    tags=["gpa"],
    responses={404: {"description": "Not found"}},
)

guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 5

class CourseItem(BaseModel):
    name: Optional[str] = ""
    grade: str
    units: int

class GPACalculateRequest(BaseModel):
    courses: List[CourseItem]

class GPACalculateResponse(BaseModel):
    success: bool
    gpa: Optional[float] = None
    message: Optional[str] = None

@router.post("/calculate", response_model=GPACalculateResponse)
async def calculate_gpa_route(
    request: GPACalculateRequest,
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        guest_id = "guest_gpa_calculator"
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Guest limit exceeded.")
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        courses_data = [course.dict() for course in request.courses]
        gpa = await gpa_service.calculate_gpa_service(courses_data)

        await usage_service.log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username, # Corrected keyword
            feature_name="GPA Calculator",
            action="calculated",
            metadata={"num_courses": len(request.courses), "calculated_gpa": gpa}
        )
        return GPACalculateResponse(success=True, gpa=gpa)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
