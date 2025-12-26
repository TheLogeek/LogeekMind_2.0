from supabase import Client
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

async def get_total_users(supabase: Client) -> int:
    response = supabase.table("profiles").select("id", count="exact").execute()
    return response.count if response.count is not None else 0

async def get_active_users(supabase: Client) -> int:
    # Fetch usage logs from the last 24 hours
    one_day_ago = datetime.now() - timedelta(days=1)
    response = supabase.table("usage_log").select("username").gte("created_at", one_day_ago.isoformat()).execute()
    
    if response.data:
        df = pd.DataFrame(response.data)
        return df['username'].nunique()
    return 0

async def get_feature_usage(supabase: Client) -> List[Dict[str, Any]]:
    response = supabase.table("usage_log").select("feature_name").execute()
    if response.data:
        df = pd.DataFrame(response.data)
        feature_counts = df.groupby("feature_name").size().reset_index(name="usage_count")
        return feature_counts.to_dict(orient="records")
    return []

async def get_top_users(supabase: Client, n: int = 5) -> List[Dict[str, Any]]:
    response = supabase.table("usage_log").select("username").execute()
    if response.data:
        df = pd.DataFrame(response.data)
        top_users_df = df.groupby("username").size().reset_index(name="usage_count").sort_values("usage_count", ascending=False)
        return top_users_df.head(n).to_dict(orient="records")
    return []

async def get_daily_activity(supabase: Client, days: int = 7) -> List[Dict[str, Any]]:
    response = supabase.table("usage_log").select("created_at").execute()
    if response.data:
        df = pd.DataFrame(response.data)
        df['created_at'] = pd.to_datetime(df['created_at']).dt.tz_convert(None).dt.date
        
        # Generate a range of recent days to ensure all days are represented, even if no activity
        recent_days = pd.date_range(end=datetime.now().date(), periods=days).date
        
        activity = df[df['created_at'].isin(recent_days)].groupby('created_at').size()
        activity = activity.reindex(recent_days, fill_value=0).reset_index(name='count')
        activity.columns = ['date', 'count'] # Rename columns
        activity['date'] = activity['date'].astype(str) # Convert date objects to string for JSON serialization
        return activity.to_dict(orient="records")
    
    # Return empty data for all days if no logs exist
    return [{'date': str(d.date()), 'count': 0} for d in pd.date_range(end=datetime.now().date(), periods=days)]

async def get_all_usage_logs(supabase: Client) -> List[Dict[str, Any]]:
    response = supabase.table("usage_log").select("*").order("created_at", desc=True).execute()
    if response.data:
        df = pd.DataFrame(response.data)
        df['created_at'] = pd.to_datetime(df['created_at']).dt.tz_convert(None).dt.isoformat() # Convert to ISO format string
        return df.to_dict(orient="records")
    return []

