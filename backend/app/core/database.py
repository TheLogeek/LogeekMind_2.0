import os
from supabase import create_client, Client
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
from typing import Optional, Tuple
from fastapi import HTTPException

load_dotenv()

# --- Environment Variables ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # This should be the ANON key or project API key
DATABASE_URL = os.getenv("DATABASE_URL") # For direct SQL via SQLAlchemy

_supabase_client: Optional[Client] = None
_db_engine: Optional[Engine] = None
_initialized = False

def initialize_clients():
    """Initializes the main Supabase client and SQLAlchemy engine."""
    global _supabase_client, _db_engine, _initialized
    if _initialized:
        return

    # Initialize Supabase Client (using SUPABASE_KEY which should be anon key)
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase client (anon key) initialized successfully.")
        except Exception as e:
            print(f"WARNING: Supabase client initialization failed: {e}")
            _supabase_client = None
    else:
        print("WARNING: SUPABASE_URL and SUPABASE_KEY (anon) not set. All Supabase features may fail.")

    # Initialize SQLAlchemy Engine
    if DATABASE_URL:
        try:
            _db_engine = create_engine(DATABASE_URL, poolclass=NullPool)
            print(f"SQLAlchemy database engine created successfully. Connected to: {DATABASE_URL.split('@')[-1]}")
        except Exception as e:
            print(f"FATAL: Could not create SQLAlchemy engine with URL '{DATABASE_URL}'. Error: {e}")
            _db_engine = None
    else:
        print("WARNING: DATABASE_URL not set. Direct database queries via SQLAlchemy will fail.")
    
    _initialized = True

# --- FastAPI Dependencies ---

def get_supabase_client() -> Client:
    """Dependency to get the main Supabase client."""
    if _supabase_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase client is not available due to a server configuration error."
        )
    return _supabase_client

def get_db_engine() -> Engine:
    """
    Dependency to get the SQLAlchemy engine for direct database queries.
    """
    if _db_engine is None:
        raise HTTPException(
            status_code=503,
            detail="SQLAlchemy database engine is not available due to a server configuration error."
        )
    return _db_engine
