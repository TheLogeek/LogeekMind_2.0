from datetime import datetime, timedelta
from typing import Optional, Dict, Any
# REMOVED: from jose import JWTError, jwt # No longer decoding JWTs manually
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase_client # Using the single supabase client
import os
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

load_dotenv()

# --- Configuration ---
# REMOVED: SECRET_KEY = os.getenv("SUPABASE_JWT_SECRET") # No longer needed for manual JWT decode
ALGORITHM = "HS256" # Kept for consistency, though less relevant
ACCESS_TOKEN_EXPIRE_MINUTES = 30 
ADMIN_ID = os.getenv("ADMIN_ID") # Load Admin ID from environment variables

def get_admin_id() -> Optional[str]:
    return ADMIN_ID

# --- OAuth2PasswordBearer for dependency injection ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/signin", auto_error=False)

# --- Updated: Use Supabase Client's Session Management ---

async def get_current_user_from_supabase_jwt(token: str = Depends(oauth2_scheme), supabase: Client = Depends(get_supabase_client)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        logger.warning("Authentication token is None. Raising credentials_exception.")
        raise credentials_exception

    logger.info(f"DEBUG: get_current_user_from_supabase_jwt called. Token received (first 20 chars): '{token[:20]}...' (length: {len(token)})")
    
    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user

        if not user:
            logger.warning(f"DEBUG: get_user() failed for token. Supabase response: {user_response.json()}")
            raise credentials_exception
        
        logger.info(f"DEBUG: Successfully validated user ID: {user.id} with Supabase.")
        
        # Load profile
        profile_response = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
        if not profile_response.data:
            logger.warning(f"DEBUG: Profile not found for user ID: {user.id}")
            raise credentials_exception
        
        logger.info(f"DEBUG: Successfully fetched profile for user ID: {user.id}")

        return {
            "id": user.id,
            "email": user.email,
            "username": profile_response.data.get("username"),
            "profile": profile_response.data
        }
    except Exception as e:
        logger.error(f"DEBUG: Error validating token with Supabase auth.get_user: {e}", exc_info=True)
        raise credentials_exception


async def try_get_current_user_from_supabase_jwt(token: str = Depends(oauth2_scheme), supabase: Client = Depends(get_supabase_client)):
    # This dependency is for optional authentication (e.g., guest mode with optional login)
    if token is None:
        return None # No token provided, user is a guest

    logger.info(f"DEBUG: try_get_current_user_from_supabase_jwt called. Token received: {token is not None}")
    logger.info(f"DEBUG: Token starts with: {token[:10]}... (length: {len(token)})")

    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user

        if not user:
            logger.info(f"DEBUG: get_user() failed (optional auth). Response: {user_response.json()}")
            return None # Invalid token payload for optional auth
        
        # Load profile
        profile_response = supabase.table("profiles").select("*").eq("id", user.id).single().execute()
        if not profile_response.data:
            logger.warning(f"DEBUG: Profile not found for user ID: {user.id} (optional auth)")
            return None

        return {
            "id": user.id,
            "email": user.email,
            "username": profile_response.data.get("username"),
            "profile": profile_response.data
        }
    except Exception as e: # Catch any exception from Supabase API call
        logger.warning(f"DEBUG: Error validating token with Supabase auth.get_user (optional auth): {e}")
        return None # Token is invalid for optional auth


# REMOVED: Pydantic model for token data (TokenData) no longer needed
# REMOVED: JWT Functions (create_access_token) no longer needed

async def get_current_admin_user(current_user: Dict[str, Any] = Depends(get_current_user_from_supabase_jwt)):
    if not ADMIN_ID:
        logger.error("ADMIN_ID environment variable is not set.")
        raise HTTPException(status_code=500, detail="Admin ID not configured on server.")
    
    logger.info(f"DEBUG: get_current_admin_user called.")
    logger.info(f"DEBUG: Current User ID from JWT: {current_user.get('id')}")
    logger.info(f"DEBUG: Configured ADMIN_ID: {ADMIN_ID}")

    if current_user["id"] != ADMIN_ID:
        logger.warning(f"DEBUG: Unauthorized attempt to access admin page by user_id: {current_user.get('id')}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
    return current_user
