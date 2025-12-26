from supabase import Client
from typing import Dict, Any, List, Optional
import pandas as pd

async def get_user_performance_data(supabase: Client, user_id: str) -> Dict[str, Any]:
    try:
        response = supabase.table("performance_log") \
            .select("feature, score, total_questions, correct_answers, created_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()
        
        data = response.data

        if not data:
            return {"success": True, "message": "No performance data available yet.", "data": []}

        df = pd.DataFrame(data)

        # Ensure correct types and calculate percentage
        df["score"] = pd.to_numeric(df.get("score", 0), errors="coerce")
        df["total_questions"] = pd.to_numeric(df.get("total_questions", 0), errors="coerce")
        df["percentage"] = (df["correct_answers"] / df["total_questions"] * 100).round(2)
        df["created_at"] = pd.to_datetime(df.get("created_at"), errors="coerce")
        df = df.dropna(subset=["score", "total_questions", "percentage", "created_at"])
        
        # Convert Timestamps to ISO format string for JSON serialization
        df['created_at'] = df['created_at'].dt.isoformat()

        return {"success": True, "data": df.to_dict(orient="records")}
    except Exception as e:
        print(f"Error fetching user performance data: {e}")
        return {"success": False, "message": str(e)}
