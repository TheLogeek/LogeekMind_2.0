from supabase import Client
import os
from typing import Dict, Any

# We will receive the Supabase client via dependency injection
# Supabase client will be initialized in app.core.database

async def check_username_availability(supabase: Client, username: str):
    try:
        response = supabase.table("profiles").select("username").eq("username", username).execute()
        if response.data:
            return False  # Username taken
        return True  # Username available
    except Exception as e:
        # Log the error, but don't expose internal details to the client
        print(f"Error checking username availability: {e}")
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
            error_message = response.error.message if response.error else "Unknown error during signup."
            if "already registered" in error_message.lower() or "user already exists" in error_message.lower():
                return {"success": False, "message": "This email is already registered. Please log in or use a different email."}
            if "password should be at least" in error_message.lower():
                return {"success": False, "message": "Password must be at least 6 characters long."}
            # Add more specific checks if other common errors are found
            return {"success": False, "message": error_message} # Default to raw error message if not specifically handled

    except Exception as e:
        print(f"Error during signup: {e}")
        # A more generic error for unexpected backend/network issues
        return {"success": False, "message": "An unexpected error occurred during signup. Please try again."}


async def sign_in_user(supabase: Client, email: str, password: str):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if response.user:
            # Load profile
            profile_response = supabase.table("profiles").select("*").eq("id", response.user.id).single().execute()
            user_profile = profile_response.data if profile_response.data else {}

            return {
                "success": True,
                "message": "Login successful!",
                "user": response.user.dict(),
                "profile": user_profile,
                "session": response.session.dict() # Contains the access_token (JWT)
            }
        else:
            return {"success": False, "message": "Login failed.", "error": response.error.message if response.error else "Invalid credentials"}

    except Exception as e:
        print(f"Error during signin: {e}")
        return {"success": False, "message": str(e)}

async def sign_out_user(supabase: Client, access_token: str):
    try:
        # Supabase's sign_out requires a valid session.
        # The client needs to handle clearing their local token.
        # This server-side sign_out is more for revoking server-side sessions if any,
        # but for JWTs, the client simply discards the token.
        # We can optionally invalidate the token on the server side if using a token blacklist,
        # but Supabase handles token invalidation on its end if using refresh tokens.

        # For simplicity, if the client sends an access_token, we can assume it's valid
        # and just call Supabase's sign_out for any cleanup they might do.
        # The primary action for JWT sign-out is client-side token deletion.
        response = await supabase.auth.sign_out()
        return {"success": True, "message": "Signed out successfully."}
    except Exception as e:
        print(f"Error during signout: {e}")
        return {"success": False, "message": str(e)}

async def send_password_reset_email(supabase: Client, email: str, redirect_to: str = None) -> Dict[str, Any]:
    try:
        # Supabase's reset_password_for_email handles sending the email
        # The `redirect_to` URL is where the user will be sent after clicking the link in the email
        # It will contain the `access_token` and `type=recovery` in the URL parameters
        if redirect_to:
            response = supabase.auth.reset_password_for_email(email, {"redirectTo": redirect_to})
        else:
            response = supabase.auth.reset_password_for_email(email)

        # Supabase's client libraries don't return an explicit success/failure for this call directly
        # If no exception is raised, it's generally considered successful.
        return {"success": True, "message": "Password reset email sent successfully (if user exists)."}
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        return {"success": False, "message": f"Failed to send password reset email: {e}"}

async def update_password(supabase: Client, access_token: str, new_password: str) -> Dict[str, Any]:
    try:
        # Set the JWT for the request (this access_token is typically from the reset email link)
        # This is crucial for Supabase to know which user's password to update
        supabase.auth.set_session(access_token) 
        
        # Update the user's password
        response = supabase.auth.update_user({"password": new_password})

        if response.user:
            return {"success": True, "message": "Password updated successfully."}
        else:
            return {"success": False, "message": "Failed to update password.", "error": response.error.message if response.error else "Unknown error"}
    except Exception as e:
        print(f"Error updating password: {e}")
        return {"success": False, "message": f"Failed to update password: {e}"}

