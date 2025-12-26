from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.core.database import get_safe_supabase_client
from app.core.security import get_current_user_from_supabase_jwt
from app.services import dashboard_service

router = APIRouter(
    prefix="/user-dashboard",
    tags=["user-dashboard"],
    responses={404: {"description": "Not found"}},
)

class PerformanceRecord(BaseModel):
    feature: str
    score: float
    total_questions: int
    percentage: float
    created_at: str # ISO formatted string

class PerformanceDataResponse(BaseModel):
    success: bool
    data: List[PerformanceRecord] = []
    message: Optional[str] = None

@router.get("/performance", response_model=PerformanceDataResponse)
async def get_performance_data_route(
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_safe_supabase_client)
):
    try:
        response = await dashboard_service.get_user_performance_data(
            supabase=supabase,
            user_id=current_user["id"]
        )

        if not response["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response["message"]
            )
        
        return PerformanceDataResponse(success=True, data=response["data"])
    except HTTPException:
        raise # Re-raise HTTPException
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
