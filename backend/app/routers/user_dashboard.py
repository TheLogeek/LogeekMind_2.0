from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from typing import Dict, Any, List, Optional
from app.core.database import get_safe_supabase_client
from app.core.security import get_current_user_from_supabase_jwt

router = APIRouter(
    prefix="/user-dashboard",
    tags=["user-dashboard"],
    responses={404: {"description": "Not found"}},
)

@router.get("/performance", response_model=List[Dict[str, Any]])
async def get_user_performance_route(
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt),
    supabase: Client = Depends(get_safe_supabase_client)
):
    """
    Fetches all performance-related usage logs for the currently authenticated user.
    This includes logs from 'Smart Quiz' and 'Exam Simulator'.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to view performance data.",
        )

    user_id = current_user["id"]
    
    try:
        # Query the usage_logs table for records related to performance
        query = supabase.table("usage_logs").select("*").eq("user_id", user_id).in_("feature_name", ["Smart Quiz", "Exam Simulator"])
        response = query.execute()

        if not response.data:
            return [] # Return an empty list if no performance data is found

        # Extract the metadata and relevant fields
        performance_data = []
        for record in response.data:
            metadata = record.get("metadata", {})
            performance_data.append({
                "feature_name": record.get("feature_name"),
                "score": metadata.get("score"),
                "total_questions": metadata.get("total_questions"),
                "created_at": record.get("created_at"),
            })

        return performance_data

    except Exception as e:
        print(f"Error fetching user performance data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching performance data.",
        )