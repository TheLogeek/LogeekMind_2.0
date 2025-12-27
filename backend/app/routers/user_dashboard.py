from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.engine import Engine
from typing import Dict, Any, List
from app.core.database import get_db_engine # Import the new engine dependency
from app.core.security import get_current_user_from_supabase_jwt

router = APIRouter(
    prefix="/user-dashboard",
    tags=["user-dashboard"],
    responses={404: {"description": "Not found"}},
)

@router.get("/performance", response_model=List[Dict[str, Any]])
async def get_user_performance_route(
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    engine: Engine = Depends(get_db_engine) # Use the new SQLAlchemy engine dependency
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
        # Use the SQLAlchemy engine to execute a raw SQL query
        with engine.connect() as connection:
            query = text("""
                SELECT feature_name, metadata->>'score' as score, metadata->>'total_questions' as total_questions, created_at
                FROM usage_logs
                WHERE user_id = :user_id AND feature_name IN ('Smart Quiz', 'Exam Simulator')
            """)
            result = connection.execute(query, {"user_id": user_id})
            performance_data = [row._asdict() for row in result]

        return performance_data

    except Exception as e:
        print(f"Error fetching user performance data with SQLAlchemy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching performance data.",
        )
