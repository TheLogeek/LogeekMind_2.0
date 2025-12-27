from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.engine import Engine
from typing import Dict, Any, List
from app.core.database import get_service_client
from app.core.security import get_current_user_from_supabase_jwt

router = APIRouter(
    prefix="/user-dashboard",
    tags=["user-dashboard"],
    responses={404: {"description": "Not found"}},
)

@router.get("/performance", response_model=List[Dict[str, Any]])
async def get_user_performance_route(
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_service_client) # Use the service client
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
        # Use the Supabase service client to execute the query
        query = supabase.table("usage_logs").select("feature_name, metadata->>score as score, metadata->>total_questions as total_questions, created_at").eq("user_id", user_id).in_("feature_name", ["Smart Quiz", "Exam Simulator"])
        response = query.execute()
        
        performance_data = response.data if response.data else []


        return performance_data

    except Exception as e:
        print(f"Error fetching user performance data with SQLAlchemy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching performance data.",
        )
