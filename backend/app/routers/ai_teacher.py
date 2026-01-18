from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client
from typing import Dict, Any, List, Optional

from app.core.database import get_supabase_client
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

class AIChatResponse(BaseModel):
    success: bool
    ai_text: Optional[str] = None
    message: Optional[str] = None

@router.post("/chat", response_model=AIChatResponse)
async def ai_teacher_chat_route(
    request: AIChatRequest,
    supabase: Client = Depends(get_supabase_client),
    current_user: Optional[Dict[str, Any]] = Depends(try_get_current_user_from_supabase_jwt)
):
    if current_user:
        user_id = current_user["id"]
        username = current_user["username"]
    else:
        # Handle Guest User
        guest_id = f"guest_ai_teacher_{request.current_prompt[:20]}" # More specific guest ID
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
            chat_history=[msg.dict() for msg in request.chat_history]
        )
        if not response["success"]:
            # Check for rate limit message from service
            if "Rate Limit Hit" in response.get("message", ""):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=response["message"]
                )
            # Check for generic API unavailability message
            if "feature is currently unavailable" in response.get("message", ""):
                 raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=response["message"]
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=response["message"]
            )
        return AIChatResponse(success=True, ai_text=response["ai_text"])
    except HTTPException as e:
        raise e # Re-raise HTTPException to preserve status code and detail
    except Exception as e:
        # Catch-all for other potential errors
        raise HTTPException(status_code=500, detail=str(e))