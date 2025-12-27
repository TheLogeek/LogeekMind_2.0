from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine # Import Connection and Engine

# Update the functions to accept a SQLAlchemy connection instead of Supabase client

async def get_total_users(conn: Connection) -> int:
    query = text("SELECT COUNT(id) FROM profiles")
    result = conn.execute(query).scalar()
    return result if result is not None else 0

async def get_active_users(conn: Connection) -> int:
    one_day_ago = datetime.now() - timedelta(days=1)
    query = text("""
        SELECT COUNT(DISTINCT username) 
        FROM usage_logs 
        WHERE created_at >= :one_day_ago
    """)
    result = conn.execute(query, {"one_day_ago": one_day_ago.isoformat()}).scalar()
    return result if result is not None else 0

async def get_feature_usage(conn: Connection) -> List[Dict[str, Any]]:
    query = text("SELECT feature_name FROM usage_logs")
    result = conn.execute(query).fetchall()
    
    if result:
        df = pd.DataFrame([row._asdict() for row in result])
        feature_counts = df.groupby("feature_name").size().reset_index(name="usage_count")
        return feature_counts.to_dict(orient="records")
    return []

async def get_top_users(conn: Connection, n: int = 5) -> List[Dict[str, Any]]:
    query = text("""
        SELECT username, COUNT(id) as usage_count
        FROM usage_logs
        GROUP BY username
        ORDER BY usage_count DESC
        LIMIT :n
    """)
    result = conn.execute(query, {"n": n}).fetchall()
    return [row._asdict() for row in result] if result else []

async def get_daily_activity(conn: Connection, days: int = 7) -> List[Dict[str, Any]]:
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days - 1)
    
    query = text("""
        SELECT DATE(created_at) as date, COUNT(id) as count
        FROM usage_logs
        WHERE DATE(created_at) BETWEEN :start_date AND :end_date
        GROUP BY DATE(created_at)
        ORDER BY date
    """)
    result = conn.execute(query, {"start_date": start_date, "end_date": end_date}).fetchall()
    
    # Fill in missing dates with 0 activity
    activity_dict = {str(row.date): row.count for row in result}
    full_activity_list = []
    for d in pd.date_range(start_date, end_date):
        date_str = str(d.date())
        full_activity_list.append({'date': date_str, 'count': activity_dict.get(date_str, 0)})
        
    return full_activity_list

async def get_all_usage_logs(conn: Connection) -> List[Dict[str, Any]]:
    query = text("SELECT id, user_id, username, feature_name, action, metadata, created_at FROM usage_logs ORDER BY created_at DESC")
    result = conn.execute(query).fetchall()
    
    if result:
        logs = []
        for row in result:
            log_dict = row._asdict()
            # Convert datetime to ISO format string
            if isinstance(log_dict.get('created_at'), datetime):
                log_dict['created_at'] = log_dict['created_at'].isoformat()
            logs.append(log_dict)
        return logs
    return []
