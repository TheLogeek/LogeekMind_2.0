from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, List, Optional

from app.core.database import get_safe_supabase_client
from app.core.security import get_current_user_from_supabase_jwt, try_get_current_user_from_supabase_jwt
from app.services import community_chat_service

router = APIRouter(
    prefix="/community-chat",
    tags=["community-chat"],
    responses={404: {"description": "Not found"}},
)

class ChatMessage(BaseModel):
    id: int
    created_at: str
    username: str
    message: str
    group_name: str

class SendMessageRequest(BaseModel):
    group_name: str
    message: str

class TypingStatusRequest(BaseModel):
    group_name: str
    is_typing: bool

@router.get("/messages/{group_name}", response_model=List[ChatMessage])
async def get_messages_route(
    group_name: str,
    supabase: Client = Depends(get_safe_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt) # Optional auth for viewing
):
    try:
        messages = await community_chat_service.get_messages(supabase, group_name)
        return messages
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-message")
async def post_message_route(
    request: SendMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt), # Strict auth to send
    supabase: Client = Depends(get_safe_supabase_client)
):
    try:
        username = current_user["username"]
        # Assuming user_id is required by community_chat_service.post_message for message ownership
        new_message = await community_chat_service.post_message(supabase, request.group_name, username, request.message)
        return new_message
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-message/{message_id}")
async def delete_message_route(
    message_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt), # Strict auth to delete
    supabase: Client = Depends(get_safe_supabase_client)
):
    try:
        user_id = current_user["id"] # Required for ownership check in service
        success = await community_chat_service.delete_message(supabase, message_id, user_id)
        if not success:
            raise HTTPException(status_code=403, detail="You can only delete your own messages.")
        return {"success": True, "message": "Message deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/presence")
async def upsert_presence_route(
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt), # Strict auth for presence
    supabase: Client = Depends(get_safe_supabase_client)
):
    try:
        await community_chat_service.upsert_presence(supabase, current_user["username"])
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/online-users", response_model=List[str])
async def get_online_users_route(
    supabase: Client = Depends(get_safe_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt) # Optional auth for viewing
):
    # Only show online users if logged in, or a limited view for guests perhaps
    # For now, allowing all to see, but Supabase call is protected by get_safe_supabase_client
    try:
        online_users = await community_chat_service.get_online_users(supabase)
        return online_users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/typing-status")
async def set_typing_status_route(
    request: TypingStatusRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt), # Strict auth for typing status
    supabase: Client = Depends(get_safe_supabase_client)
):
    try:
        await community_chat_service.set_typing_status(supabase, current_user["username"], request.group_name, request.is_typing)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/typing-users/{group_name}", response_model=List[str])
async def get_typing_users_route(
    group_name: str,
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt), # Optional auth for viewing
    supabase: Client = Depends(get_safe_supabase_client)
):
    # For guests, typing users might not be relevant or should be restricted
    # Assuming for now, if the user is authenticated, we exclude their own typing status
    exclude_username = current_user["username"] if current_user else None
    try:
        typing_users = await community_chat_service.get_typing_users(supabase, group_name, exclude_username=exclude_username)
        return typing_users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))