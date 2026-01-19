from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from sqlalchemy.engine import Engine
from app.core.database import get_db_engine
from app.core.security import get_current_user_from_supabase_jwt
from app.services import dashboard_service # Import the new service
from datetime import datetime

router = APIRouter(
    prefix="/user-dashboard",
    tags=["user-dashboard"],
    responses={404: {"description": "Not found"}},
)

# Pydantic model for a single performance item
class PerformanceItem(BaseModel):
    feature: str
    score: float
    total_questions: int
    correct_answers: int
    created_at: datetime
    percentage: float # Assuming percentage is always calculated and present

# Pydantic model for the overall response from the dashboard service
class UserPerformanceResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: List[PerformanceItem]

@router.get("/performance", response_model=UserPerformanceResponse)
async def get_user_performance_route(
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    engine: Engine = Depends(get_db_engine)
):
    """
    Fetches all performance-related usage logs for the currently authenticated user
    using a pooled SQLAlchemy connection.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view performance data.",
        )

    user_id = current_user["id"]
    
    try:
        with engine.connect() as conn:
            # The service function already returns {"success": True, "data": [...]}
            # So, we return its entire dictionary output here.
            response_data = await dashboard_service.get_user_performance_data(conn, user_id)
        
        return response_data

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error fetching user performance data with SQLAlchemy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while fetching performance data.",
        )