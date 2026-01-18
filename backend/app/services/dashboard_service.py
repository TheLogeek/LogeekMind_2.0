from typing import Dict, Any, List, Optional
import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Connection
from datetime import datetime # Import datetime for type checking

async def get_user_performance_data(conn: Connection, user_id: str) -> Dict[str, Any]:
    try:
        query = text("""
            SELECT feature, score, total_questions, correct_answers, created_at 
            FROM performance_log 
            WHERE user_id = :user_id 
            ORDER BY created_at DESC
        """)
        result = conn.execute(query, {"user_id": user_id}).fetchall()
        
        if not result:
            return {"success": True, "message": "No performance data available yet.", "data": []}

        # Convert SQLAlchemy Row objects to dictionaries for DataFrame
        data = [row._asdict() for row in result]
        df = pd.DataFrame(data)

        # Ensure correct types and calculate percentage
        df["score"] = pd.to_numeric(df.get("score", 0), errors="coerce")
        df["total_questions"] = pd.to_numeric(df.get("total_questions", 0), errors="coerce")
        df["percentage"] = (df["correct_answers"] / df["total_questions"] * 100).round(2)
        df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce") # Ensure datetime conversion

        # Convert Timestamps to ISO format string for JSON serialization
        df['created_at'] = df['created_at'].dt.isoformat()

        return {"success": True, "data": df.to_dict(orient="records")}
    except Exception as e:
        print(f"Error fetching user performance data with SQLAlchemy: {e}")
        return {"success": False, "message": str(e)}
