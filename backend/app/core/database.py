import os
from supabase import create_client, Client
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
from typing import Optional
from fastapi import HTTPException

load_dotenv()

# --- Environment Variables ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") # This should be the ANON key
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # This should be the SERVICE_ROLE key
DATABASE_URL = os.getenv("DATABASE_URL")

_auth_client: Optional[Client] = None
_service_client: Optional[Client] = None
_db_engine: Optional[Engine] = None # Initialize db_engine
_initialized = False

def initialize_clients():
    """Initializes all Supabase and SQLAlchemy clients."""
    global _auth_client, _service_client, _db_engine, _initialized
    if _initialized:
        return

    # Initialize Supabase Auth Client
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            _auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            print("Supabase AUTH client initialized successfully.")
        except Exception as e:
            print(f"WARNING: Supabase AUTH client initialization failed: {e}")
            _auth_client = None
    else:
        print("WARNING: SUPABASE_URL and SUPABASE_KEY (anon) not set. Auth sign-in/up may fail.")

    # Initialize Supabase Service Client
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            _service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            print("Supabase SERVICE client initialized successfully.")
        except Exception as e:
            print(f"WARNING: Supabase SERVICE client initialization failed: {e}")
            _service_client = None
    else:
        print("WARNING: SUPABASE_URL and SUPABASE_SERVICE_KEY not set. Backend database operations may fail.")

    # Initialize SQLAlchemy Engine
    if DATABASE_URL:
        try:
            _db_engine = create_engine(DATABASE_URL, poolclass=NullPool)
            print("SQLAlchemy database engine created successfully with connection pooling.")
        except Exception as e:
            print(f"FATAL: Could not create SQLAlchemy engine. Error: {e}")
            _db_engine = None
    else:
        print("WARNING: DATABASE_URL not set. Direct database queries via SQLAlchemy will fail.")
    
    _initialized = True

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
    for all backend database operations. (For supabase-py client methods)
    """
    if _service_client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase Service client is not available due to a server configuration error."
        )
    return _service_client

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