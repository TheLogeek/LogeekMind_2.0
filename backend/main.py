from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Import the new initialization function
from app.core.database import initialize_clients
from app.routers import (
    auth, summarizer, ai_teacher, course_outline, gpa_calculator,
    homework_assistant, audio_to_text, notes_to_audio, smart_quiz,
    study_scheduler, user_dashboard, admin_dashboard, community_chat,
    exam_simulator
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

@app.on_event("startup")
def on_startup():
    """
    This function runs when the FastAPI application starts up.
    It's the perfect place to initialize database connections.
    """
    logger.info("Application startup: Initializing database clients...")
    initialize_clients()

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include all API Routers ---
app.include_router(auth.router)
app.include_router(summarizer.router)
app.include_router(ai_teacher.router)
app.include_router(course_outline.router)
app.include_router(gpa_calculator.router)
app.include_router(homework_assistant.router)
app.include_router(audio_to_text.router)
app.include_router(notes_to_audio.router)
app.include_router(smart_quiz.router)
app.include_router(study_scheduler.router)
app.include_router(user_dashboard.router)
app.include_router(admin_dashboard.router)
app.include_router(community_chat.router)
app.include_router(exam_simulator.router)

@app.get("/")
async def root():
    """A simple root endpoint to confirm the server is running."""
    return {"message": "LogeekMind Backend is running!"}