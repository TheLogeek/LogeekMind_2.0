from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, List, Optional

from app.core.database import get_safe_supabase_client # Updated import
from app.core.security import try_get_current_user_from_supabase_jwt # Correct import
from app.services import ai_teacher_service

router = APIRouter(
    prefix="/ai-teacher",
    tags=["ai-teacher"],
    responses={404: {"description": "Not found"}},
)

# A simple in-memory store for guest usage.
guest_usage_tracker: Dict[str, int] = {}
GUEST_LIMIT = 2

class ChatMessage(BaseModel):
    role: str
    text: str

class AIChatRequest(BaseModel):
    current_prompt: str
    chat_history: List[ChatMessage]
    gemini_api_key: Optional[str] = None

class AIChatResponse(BaseModel):
    success: bool
    ai_text: Optional[str] = None
    message: Optional[str] = None

@router.post("/chat", response_model=AIChatResponse)
async def ai_teacher_chat_route(
    request: AIChatRequest,
    supabase: Client = Depends(get_safe_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        # Handle Guest User
        guest_id = "guest_ai_teacher" # A generic ID for this feature
        usage = guest_usage_tracker.get(guest_id, 0)
        if usage >= GUEST_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Guest limit of {GUEST_LIMIT} uses exceeded. Please log in for unlimited access."
            )
        guest_usage_tracker[guest_id] = usage + 1
        user_id = guest_id
        username = "Guest"

    try:
        response = await ai_teacher_service.generate_ai_teacher_response(
            supabase=supabase,
            user_id=user_id,
            username=username,
            current_prompt=request.current_prompt,
            chat_history=[msg.dict() for msg in request.chat_history],
            api_key=request.gemini_api_key
        )
        if not response["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response["message"]
            )
        return AIChatResponse(success=True, ai_text=response["ai_text"])
    except Exception as e:
        # Catch-all for other potential errors
        raise HTTPException(status_code=500, detail=str(e))
