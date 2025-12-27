from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_service_client
import os
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
SECRET_KEY = os.getenv("SUPABASE_JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 
ADMIN_ID = os.getenv("ADMIN_ID") # Load Admin ID from environment variables

def get_admin_id() -> Optional[str]:
    return ADMIN_ID

# --- OAuth2PasswordBearer for dependency injection ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/signin", auto_error=False)

# ... (existing code) ...

async def try_get_current_user_from_supabase_jwt(token: str = Depends(oauth2_scheme), supabase: Client = Depends(get_service_client)):
    if token is None:
        return None # No token provided, user is a guest

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None # Invalid token payload

        profile_response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not profile_response.data:
            return None # User not found in database

        return {
            "id": user_id,
            "email": payload.get("email"),
            "username": profile_response.data.get("username"),
            "profile": profile_response.data
        }
    except JWTError:
        return None # Token is invalid


# --- Pydantic model for token data ---
class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None

# --- JWT Functions ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user_from_supabase_jwt(token: str = Depends(oauth2_scheme), supabase: Client = Depends(get_service_client)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        username: str = payload.get("user_metadata", {}).get("username")

        if user_id is None or email is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id, email=email, username=username)
    except JWTError:
        raise credentials_exception
    
    profile_response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    if not profile_response.data:
        raise credentials_exception
    
    return {
        "id": user_id,
        "email": email,
        "username": username,
        "profile": profile_response.data
    }

async def get_current_admin_user(current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt)):
    if not ADMIN_ID:
        raise HTTPException(status_code=500, detail="Admin ID not configured on server.")
    if current_user["id"] != ADMIN_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
    return current_user
