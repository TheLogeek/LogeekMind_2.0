import os
from supabase import create_client, Client
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
from typing import Optional, Tuple

load_dotenv()

# --- Supabase API Client (for Auth, etc.) ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
_supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Supabase API client initialized.")
else:
    print("WARNING: SUPABASE_URL and SUPABASE_KEY not set. Auth-related features may fail.")

def get_supabase_client() -> Optional[Client]:
    """Returns the initialized Supabase client instance."""
    return _supabase_client

# --- SQLAlchemy Database Engine (for Direct Queries) ---
# This uses the pooled connection string for serverless environments.
DATABASE_URL = os.getenv("DATABASE_URL")
_db_engine = None
if DATABASE_URL:
    try:
        _db_engine = create_engine(DATABASE_URL, poolclass=NullPool)
        print("SQLAlchemy database engine created successfully with connection pooling.")
    except Exception as e:
        print(f"FATAL: Could not create SQLAlchemy engine. Error: {e}")
else:
    print("WARNING: DATABASE_URL not set. Direct database queries will fail.")

def get_db_engine():
    """
    Returns the SQLAlchemy engine.
    Raises an exception if the engine is not available.
    """
    if _db_engine is None:
        raise HTTPException(
            status_code=503, 
            detail="Database connection is not configured correctly on the server."
        )
    return _db_engine

# --- Dependency for FastAPI ---
def get_safe_supabase_client() -> Client:
    """Dependency to get the Supabase client, raising an error if unavailable."""
    client = get_supabase_client()
    if client is None:
        raise ValueError("Supabase client is not available.")
    return client
