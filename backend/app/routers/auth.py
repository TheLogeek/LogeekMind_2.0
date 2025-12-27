from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from supabase import Client
from typing import Dict, Any, Optional
import os # Import os for environment variable

from app.core.database import get_auth_client
from app.services import auth_service
from app.core.security import get_current_user_from_supabase_jwt, get_admin_id # Import get_current_user_from_supabase_jwt and get_admin_id

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    responses={404: {"description": "Not found"}},
)

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    username: str
    terms_accepted: bool = False

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    new_password: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Dict[str, Any] | None = None
    profile: Dict[str, Any] | None = None
    session: Dict[str, Any] | None = None

@router.post("/signup", response_model=AuthResponse)
async def signup_route(request: SignUpRequest, supabase: Client = Depends(get_auth_client)):
    result = await auth_service.sign_up_user(
        supabase,
        request.email,
        request.password,
        request.username,
        request.terms_accepted
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )
    return AuthResponse(**result)

@router.post("/signin", response_model=AuthResponse)
async def signin_route(request: SignInRequest, supabase: Client = Depends(get_auth_client)):
    result = await auth_service.sign_in_user(
        supabase,
        request.email,
        request.password
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["message"]
        )
    return AuthResponse(**result)

@router.post("/signout", response_model=AuthResponse)
async def signout_route(supabase: Client = Depends(get_auth_client)):
    result = await auth_service.sign_out_user(supabase, access_token=None)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )
    return AuthResponse(**result)

@router.post("/forgot-password")
async def forgot_password_route(request: ForgotPasswordRequest, supabase: Client = Depends(get_auth_client)):
    FRONTEND_RESET_PASSWORD_URL = os.getenv("FRONTEND_RESET_PASSWORD_URL", "http://localhost:3000/reset-password")

    result = await auth_service.send_password_reset_email(supabase, request.email, redirect_to=FRONTEND_RESET_PASSWORD_URL)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )
    return {"message": "If an account with that email exists, a password reset link has been sent."}

@router.post("/reset-password")
async def reset_password_route(
    request: ResetPasswordRequest,
    supabase: Client = Depends(get_auth_client),
    authorization: Optional[str] = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or invalid. Requires Bearer token."
        )
    access_token = authorization.split(" ")[1]

    if len(request.new_password) < 6:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    result = await auth_service.update_password(supabase, access_token, request.new_password)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )
    return {"message": "Password updated successfully!"}

@router.get("/check-admin")
async def check_admin_status(current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt)):
    admin_id = get_admin_id()
    is_admin = (current_user and current_user["id"] == admin_id)
    return {"is_admin": is_admin}
