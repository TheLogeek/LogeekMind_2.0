import os
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional
from fastapi import HTTPException

load_dotenv()

# --- Environment Variables ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # This should be the ANON key
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # This should be the SERVICE_ROLE key

_auth_client: Optional[Client] = None
_service_client: Optional[Client] = None

def initialize_clients():
    """Initializes both the auth and service role Supabase clients."""
    global _auth_client, _service_client
    
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            _auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase AUTH client initialized successfully.")
        except Exception as e:
            print(f"WARNING: Supabase AUTH client initialization failed: {e}")
            _auth_client = None
    else:
        print("WARNING: SUPABASE_URL and SUPABASE_KEY (anon) not set. Auth sign-in/up may fail.")

    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            print("Supabase SERVICE client initialized successfully.")
        except Exception as e:
            print(f"FATAL: Supabase SERVICE client initialization failed: {e}")
            _service_client = None
    else:
        print("FATAL: SUPABASE_SERVICE_KEY not set. Backend database operations will fail.")

# --- FastAPI Dependencies ---

def get_auth_client() -> Client:
    """Dependency to get the Supabase client for authentication tasks."""
    if _auth_client is None:
        raise HTTPException(
            status_code=503,
            detail="Authentication service is not configured correctly."
        )
    return _auth_client

def get_service_client() -> Client:
    """
    Dependency to get the Supabase client with service_role privileges
    for all backend database operations.
    """
    if _service_client is None:
        raise HTTPException(
            status_code=503,
            detail="Database service is not configured correctly."
        )
    return _service_client
