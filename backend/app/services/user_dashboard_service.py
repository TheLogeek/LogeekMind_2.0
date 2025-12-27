from typing import Dict, Any, List
from sqlalchemy.engine import Connection, Engine
from sqlalchemy import text
import pandas as pd
from datetime import datetime, timedelta

async def get_user_performance(conn: Connection, user_id: str) -> List[Dict[str, Any]]:
    """
    Fetches all performance-related usage logs for the given user ID using SQLAlchemy.
    """
    query = text("""
        SELECT feature_name, metadata->>'score' as score, metadata->>'total_questions' as total_questions, created_at
        FROM usage_logs
        WHERE user_id = :user_id AND feature_name IN ('Smart Quiz', 'Exam Simulator')
        ORDER BY created_at DESC
    """)
    result = conn.execute(query, {"user_id": user_id}).fetchall()

    if result:
        # Convert SQLAlchemy Row objects to dictionaries
        performance_data = [row._asdict() for row in result]
        return performance_data
    return []

# No other service functions for now, but they can be added here if needed for the dashboard.
