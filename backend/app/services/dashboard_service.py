from typing import Dict, Any, List, Optional
import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Connection
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

async def get_user_performance_data(conn: Connection, user_id: str) -> Dict[str, Any]:
    try:
        query = text("""
            SELECT feature, score, total_questions, correct_answers, created_at 
            FROM performance_log 
            WHERE user_id = :user_id 
            ORDER BY created_at DESC
        """
        )
        result = conn.execute(query, {"user_id": user_id}).fetchall()
        
        if not result:
            return {"success": True, "message": "No performance data available yet.", "data": []}

        processed_data = []
        for row in result:
            log_dict = row._asdict()
            if isinstance(log_dict.get('created_at'), datetime):
                log_dict['created_at'] = log_dict['created_at'].isoformat()
            processed_data.append(log_dict)

        df = pd.DataFrame(processed_data)

        df["score"] = pd.to_numeric(df.get("score", 0), errors="coerce")
        df["total_questions"] = pd.to_numeric(df.get("total_questions", 0), errors="coerce")
        df["percentage"] = (df["correct_answers"] / df["total_questions"] * 100).round(2)
        # created_at is already a string at this point, no need for pd.to_datetime here
        
        df = df.dropna(subset=["score", "total_questions", "percentage"]) # created_at already handled as string

        # No need for df['created_at'].dt.isoformat() as it's already a string

        return {"success": True, "data": df.to_dict(orient="records")}
    except Exception as e:
        logger.error(f"Error fetching user performance data for user_id {user_id}: {e}")
        raise ValueError("Failed to retrieve user performance data.")
