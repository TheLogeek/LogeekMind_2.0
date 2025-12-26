from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.database import get_supabase_client, get_safe_supabase_client, Client
from app.routers import auth as auth_router
from app.routers import summarizer as summarizer_router
from app.routers import ai_teacher as ai_teacher_router
from app.routers import course_outline as course_outline_router
from app.routers import gpa_calculator as gpa_calculator_router
from app.routers import homework_assistant as homework_assistant_router
from app.routers import audio_to_text as audio_to_text_router
from app.routers import notes_to_audio as notes_to_audio_router
from app.routers import smart_quiz as smart_quiz_router
from app.routers import study_scheduler as study_scheduler_router
from app.routers import user_dashboard as user_dashboard_router
from app.routers import admin_dashboard as admin_dashboard_router
from app.routers import community_chat as community_chat_router
from app.routers import exam_simulator as exam_simulator_router
from app.core.security import get_current_user_from_supabase_jwt

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- CORS Middleware ---
# For debugging, allow all origins
origins = ["*"] 

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client globally (will be None if connection fails)
global_supabase_client, supabase_init_error = get_supabase_client()
if supabase_init_error:
    logger.warning(f"Supabase connection error on startup: {supabase_init_error}. Supabase-dependent features may not work.")
else:
    logger.info("Supabase client initialized successfully.")

# Include all the routers
app.include_router(auth_router.router)
app.include_router(summarizer_router.router)
app.include_router(ai_teacher_router.router)
app.include_router(course_outline_router.router)
app.include_router(gpa_calculator_router.router)
app.include_router(homework_assistant_router.router)
app.include_router(audio_to_text_router.router)
app.include_router(notes_to_audio_router.router)
app.include_router(smart_quiz_router.router)
app.include_router(study_scheduler_router.router)
app.include_router(user_dashboard_router.router)
app.include_router(admin_dashboard_router.router)
app.include_router(community_chat_router.router)
app.include_router(exam_simulator_router.router)

@app.get("/")
async def root():
    if global_supabase_client is None:
        return {"message": "LogeekMind Backend is running! (Supabase connection failed)"}
    return {"message": "LogeekMind Backend is running! (Supabase connected)"}

# Example of a route that *might* still work without Supabase if it doesn't need it
# For now, /users/me still requires Supabase, but it will use the injected dependency
@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user_from_supabase_jwt), supabase: Client = Depends(get_safe_supabase_client)):
    return {"message": "Authenticated successfully!", "user": current_user}
