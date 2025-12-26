from supabase import Client
from typing import Dict, Any, Optional

async def log_usage(supabase: Client, user_id: str, user_name: str, feature_name: str, action: str, metadata: Optional[Dict[str, Any]] = None):
    if metadata is None:
        metadata = {}

    try:
        response = supabase.table("usage_log").insert({
            "user_id": user_id,
            "username": user_name,
            "feature_name": feature_name,
            "action": action,
            "metadata": metadata
        }).execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        print(f"Error logging usage: {e}")
        return {"success": False, "message": str(e)}

async def log_performance(supabase: Client, user_id: str, feature: str, score: float, total_questions: int, correct_answers: int, extra: Optional[Dict[str, Any]] = None):
    if extra is None:
        extra = {}

    try:
        response = supabase.table("performance_log").insert({
            "user_id": user_id,
            "feature": feature,
            "score": score,
            "total_questions": total_questions,
            "correct_answers": correct_answers,
            "extra": extra
        }).execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        print(f"Error logging performance: {e}")
        return {"success": False, "message": str(e)}

async def get_user_performance(supabase: Client, user_id: str):
    try:
        response = supabase.table("performance_log") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        print(f"Error getting user performance: {e}")
        return {"success": False, "message": str(e)}
