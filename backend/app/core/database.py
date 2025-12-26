import os
import psycopg2
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional, Tuple

load_dotenv()

# Use the full DATABASE_URL for a pooled connection
DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

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
        # Check database connection using the full DATABASE_URL
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL)
            conn.close()
            
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        _supabase_error_message = None
        print("Supabase client initialized successfully.")

    except Exception as e:
        _supabase_client = None
        _supabase_error_message = f"Supabase connection failed: {e}"
        print(f"WARNING: {_supabase_error_message}")
    finally:
        _supabase_initialized = True
        return _supabase_client, _supabase_error_message

def get_safe_supabase_client() -> Client:
    client, error = get_supabase_client()
    if client is None:
        raise ValueError(f"Supabase client is not available: {error}")
    return client