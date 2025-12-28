from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List
from sqlalchemy.engine import Engine # Add this import
from app.core.database import get_db_engine # Import the new engine dependency
from app.core.security import get_current_user_from_supabase_jwt
from app.services import dashboard_service # Import the new service

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
        with engine.connect() as conn: # Get a connection from the engine
            performance_data = await dashboard_service.get_user_performance(conn, user_id)
        
        return performance_data

    except Exception as e:
        print(f"Error fetching user performance data with SQLAlchemy: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching performance data.",
        )