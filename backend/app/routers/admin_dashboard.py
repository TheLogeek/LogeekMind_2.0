from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import time

from app.core.database import get_supabase_client, get_db_engine
from sqlalchemy.engine import Engine
from app.core.security import get_current_admin_user # Use the admin specific dependency
from app.services import admin_dashboard_service

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)

class MetricResponse(BaseModel):
    total_users: int
    active_users_24h: int
    top_user_username: str

class FeatureUsageItem(BaseModel):
    feature_name: str
    usage_count: int

class DailyActivityItem(BaseModel):
    date: str
    count: int

class TopUserItem(BaseModel):
    username: str
    usage_count: int

class UsageLogItem(BaseModel):
    id: str
    user_id: str
    username: str
    feature_name: str
    action: str
    metadata: Dict[str, Any]
    created_at: str

@router.get("/metrics", response_model=MetricResponse)
async def get_admin_metrics(
    admin_user: Dict[str, Any] = Depends(get_current_admin_user),
    engine: Engine = Depends(get_db_engine)
):
    try:
        with engine.connect() as conn:
            total_users = await admin_dashboard_service.get_total_users(conn)
            active_users = await admin_dashboard_service.get_active_users(conn)
            top_users_list = await admin_dashboard_service.get_top_users(conn, n=1)
        top_user_username = top_users_list[0]["username"] if top_users_list else "N/A"
        
        return MetricResponse(
            total_users=total_users,
            active_users_24h=active_users,
            top_user_username=top_user_username
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching admin metrics: {e}")

@router.get("/feature-usage", response_model=List[FeatureUsageItem])
async def get_admin_feature_usage(
    admin_user: Dict[str, Any] = Depends(get_current_admin_user),
    engine: Engine = Depends(get_db_engine)
):
    try:
        with engine.connect() as conn:
            return await admin_dashboard_service.get_feature_usage(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching feature usage: {e}")

@router.get("/daily-activity", response_model=List[DailyActivityItem])
async def get_admin_daily_activity(
    admin_user: Dict[str, Any] = Depends(get_current_admin_user),
    engine: Engine = Depends(get_db_engine)
):
    try:
        with engine.connect() as conn:
            return await admin_dashboard_service.get_daily_activity(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching daily activity: {e}")

@router.get("/top-users", response_model=List[TopUserItem])
async def get_admin_top_users(
    admin_user: Dict[str, Any] = Depends(get_current_admin_user),
    engine: Engine = Depends(get_db_engine)
):
    try:
        with engine.connect() as conn:
            return await admin_dashboard_service.get_top_users(conn, n=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching top users: {e}")

@router.get("/all-usage-logs", response_model=List[UsageLogItem])
async def get_admin_all_usage_logs(
    admin_user: Dict[str, Any] = Depends(get_current_admin_user),
    engine: Engine = Depends(get_db_engine)
):
    try:
        with engine.connect() as conn:
            return await admin_dashboard_service.get_all_usage_logs(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching all usage logs: {e}")