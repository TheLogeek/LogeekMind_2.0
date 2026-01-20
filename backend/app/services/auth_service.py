from supabase import Client
import os
from typing import Dict, Any
import logging # Import logging

logger = logging.getLogger(__name__) # Initialize logger

# We will receive the Supabase client via dependency injection
# Supabase client will be initialized in app.core.database

async def check_username_availability(supabase: Client, username: str):
    try:
        response = supabase.table("profiles").select("username").eq("username", username).execute()
        if response.data:
            return False  # Username taken
        return True  # Username available
    except Exception as e:
        logger.error(f"Error checking username availability: {e}")
        return False


async def sign_up_user(supabase: Client, email: str, password: str, username: str, terms_accepted: bool):
    if not await check_username_availability(supabase, username):
        return {"success": False, "message": "Username already taken. Please choose another."}

    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "username": username,
                    "terms_accepted": terms_accepted,
                    "terms_version": "v1.0"
                }
            }
        })

        if response.user:
            return {"success": True, "message": "Account created! Please proceed to login.", "user": response.user.dict()}
        else:
            error_message = response.error.message if response.error else "An unknown error occurred with Supabase during signup."
            if "already registered" in error_message.lower() or "user already exists" in error_message.lower():
                return {"success": False, "message": "This email is already registered. Please log in or use a different email."}
            if "password should be at least" in error_message.lower():
                return {"success": False, "message": "Password must be at least 6 characters long."}
            if "invalid email format" in error_message.lower() or "email is not valid" in error_message.lower():
                return {"success": False, "message": "The email address provided is not valid. Please check the format."}
            
            # Log the unhandled Supabase error message for debugging
            logger.error(f"Unhandled Supabase signup error: {error_message}")
            return {"success": False, "message": error_message} # Default to raw error message if not specifically handled

    except Exception as e:
        logger.error(f"An unhandled exception occurred during signup: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred during signup or you entered an invalid email address. Please try again or contact support."}


async def sign_in_user(supabase: Client, email: str, password: str):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if response.user:
            profile_response = supabase.table("profiles").select("*").eq("id", response.user.id).single().execute()
            user_profile = profile_response.data if profile_response.data else {}

            return {
                "success": True,
                "message": "Login successful!",
                "user": response.user.dict(),
                "profile": user_profile,
                "session": response.session.dict()
            }
        else:
            return {"success": False, "message": "Login failed.", "error": response.error.message if response.error else "Invalid credentials"}

    except Exception as e:
        logger.error(f"Error during signin: {e}", exc_info=True)
        return {"success": False, "message": str(e)}

async def sign_out_user(supabase: Client): # Removed access_token as it's not used
    try:
        response = await supabase.auth.sign_out()
        return {"success": True, "message": "Signed out successfully."}
    except Exception as e:
        logger.error(f"Error during signout: {e}", exc_info=True)
        return {"success": False, "message": str(e)}


async def send_password_reset_email(supabase: Client, email: str, redirect_to: str = None) -> Dict[str, Any]:
    try:
        if redirect_to:
            response = supabase.auth.reset_password_for_email(email, {"redirectTo": redirect_to})
        else:
            response = supabase.auth.reset_password_for_email(email)

        return {"success": True, "message": "Password reset email sent successfully (if user exists)."}
    except Exception as e:
        logger.error(f"Error sending password reset email: {e}", exc_info=True)
        # Temporarily return the full exception representation for debugging
        return {"success": False, "message": f"Failed to send password reset email: {repr(e)}"}


async def update_password(supabase: Client, access_token: str, refresh_token: str, new_password: str) -> Dict[str, Any]:
    try:
        # Set the session using both access and refresh tokens
        supabase.auth.set_session(access_token, refresh_token) 
        
        response = supabase.auth.update_user({"password": new_password})

        if response.user:
            return {"success": True, "message": "Password updated successfully."}
        else:
            return {"success": False, "message": "Failed to update password.", "error": response.error.message if response.error else "Unknown error"}
    except Exception as e:
        logger.error(f"Error updating password: {e}", exc_info=True)
        return {"success": False, "message": f"Failed to update password: {e}"}
