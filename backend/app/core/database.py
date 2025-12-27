import os
from supabase import create_client, Client
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
from typing import Optional, Tuple
from fastapi import HTTPException

load_dotenv()

# --- Supabase API Client (for Auth, etc.) ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# --- SQLAlchemy Database Engine (for Direct Queries) ---
DATABASE_URL = os.getenv("DATABASE_URL")

_supabase_client: Optional[Client] = None
_db_engine = None
_supabase_initialized = False

def initialize_clients():
    """Initializes both Supabase and SQLAlchemy clients."""
    global _supabase_client, _db_engine, _supabase_initialized
    if _supabase_initialized:
        return

    # Initialize Supabase Client
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase API client initialized successfully.")
        except Exception as e:
            print(f"WARNING: Supabase client initialization failed: {e}")
            _supabase_client = None
    else:
        print("WARNING: SUPABASE_URL and SUPABASE_KEY not set. Auth features will fail.")

    # Initialize SQLAlchemy Engine
    if DATABASE_URL:
        try:
            _db_engine = create_engine(DATABASE_URL, poolclass=NullPool)
            print("SQLAlchemy database engine created successfully.")
        except Exception as e:
            print(f"FATAL: Could not create SQLAlchemy engine. Error: {e}")
            _db_engine = None
    else:
        print("WARNING: DATABASE_URL not set. Direct database queries will fail.")
    
    _supabase_initialized = True

def get_supabase_client() -> Optional[Client]:
    """Returns the initialized Supabase client instance."""
    return _supabase_client

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
        raise HTTPException(
            status_code=503,
            detail="Supabase client is not available due to a server configuration error."
        )
    return client