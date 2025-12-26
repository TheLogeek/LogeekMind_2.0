import os
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional, Tuple

load_dotenv() # Load environment variables from .env file

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Global variables to store the Supabase client and its availability status
_supabase_client: Optional[Client] = None
_supabase_error_message: Optional[str] = None
_supabase_initialized = False

def get_supabase_client() -> Tuple[Optional[Client], Optional[str]]:
    global _supabase_client, _supabase_error_message, _supabase_initialized
    
    if _supabase_initialized:
        return _supabase_client, _supabase_error_message

    if not SUPABASE_URL or not SUPABASE_KEY:
        _supabase_error_message = "Supabase URL and Key must be set in environment variables."
        _supabase_initialized = True
        return None, _supabase_error_message
    
    try:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        _supabase_error_message = None
    except Exception as e:
        _supabase_client = None
        _supabase_error_message = f"Supabase connection failed during initialization: {e}"
        print(f"WARNING: {_supabase_error_message}") # Log to console
    finally:
        _supabase_initialized = True
        return _supabase_client, _supabase_error_message

# Dependency to inject Supabase client, raising error if not available
def get_safe_supabase_client() -> Client:
    client, error = get_supabase_client()
    if client is None:
        raise ValueError(f"Supabase client is not available: {error}")
    return client
