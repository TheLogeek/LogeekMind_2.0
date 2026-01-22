from supabase import Client
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

async def create_lesson(supabase: Client, creator_id: str, title: str, is_public: bool, content_config: Dict[str, bool]) -> Dict[str, Any]:
    """Creates a new lesson in the database."""
    try:
        response = supabase.table("lessons").insert({
            "creator_id": creator_id,
            "title": title,
            "is_public": is_public,
            "content_config": content_config
        }).execute()
        
        if response.data:
            return {"success": True, "lesson": response.data[0]}
        else:
            logger.error(f"Supabase error on lesson creation: {response.error.message if response.error else 'Unknown error'}")
            return {"success": False, "message": "Failed to create lesson."}
            
    except Exception as e:
        logger.error(f"Error creating lesson: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while creating the lesson."}

async def get_lesson_by_id(supabase: Client, lesson_id: str) -> Dict[str, Any]:
    """Fetches a single lesson and its associated content by ID."""
    try:
        # Fetch the main lesson details
        lesson_response = supabase.table("lessons").select("*").eq("id", lesson_id).single().execute()
        if not lesson_response.data:
            return {"success": False, "message": "Lesson not found."}
        
        lesson = lesson_response.data
        
        # Fetch associated content based on content_config
        content_config = lesson.get("content_config", {})
        
        if content_config.get("has_outline"):
            outline_res = supabase.table("lesson_outlines").select("outline_text").eq("lesson_id", lesson_id).single().execute()
            lesson["outline"] = outline_res.data.get("outline_text") if outline_res.data else None

        if content_config.get("has_notes"):
            notes_res = supabase.table("lesson_notes").select("notes_text").eq("lesson_id", lesson_id).single().execute()
            lesson["notes"] = notes_res.data.get("notes_text") if notes_res.data else None

        if content_config.get("has_quiz"):
            quiz_res = supabase.table("lesson_quizzes").select("quiz_data_json").eq("lesson_id", lesson_id).single().execute()
            lesson["quiz"] = quiz_res.data.get("quiz_data_json") if quiz_res.data else None

        if content_config.get("has_exam"):
            exam_res = supabase.table("lesson_exams").select("exam_data_json").eq("lesson_id", lesson_id).single().execute()
            lesson["exam"] = exam_res.data.get("exam_data_json") if exam_res.data else None

        return {"success": True, "lesson": lesson}

    except Exception as e:
        logger.error(f"Error fetching lesson by ID {lesson_id}: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while fetching the lesson."}


async def get_public_lessons(supabase: Client, search_query: Optional[str] = None) -> Dict[str, Any]:
    """Fetches all public lessons, with an optional search filter."""
    try:
        query = supabase.table("lessons").select("id, title, creator_id, created_at, profiles(username)").eq("is_public", True).order("created_at", desc=True)
        
        if search_query:
            # Using 'ilike' for case-insensitive search
            query = query.ilike("title", f"%{search_query}%")
            
        response = query.execute()
        
        if response.data:
            lessons_transformed = []
            for lesson_data in response.data:
                # Extract profile data, handling cases where profiles might be null
                creator_username = lesson_data.get("profiles", {}).get("username")

                # Create the 'creator' object as expected by the frontend
                creator_info = {"username": creator_username} if creator_username else {"username": "Unknown"}

                transformed_lesson = {
                    "id": lesson_data["id"],
                    "title": lesson_data["title"],
                    "created_at": lesson_data["created_at"],
                    "creator": creator_info
                }
                lessons_transformed.append(transformed_lesson)

            return {"success": True, "lessons": lessons_transformed}
        else:
            return {"success": True, "lessons": []} # Return empty list if no public lessons found
            
    except Exception as e:
        logger.error(f"Error fetching public lessons: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while fetching public lessons."}


async def save_lesson_content(supabase: Client, lesson_id: str, creator_id: str, content_type: str, content_data: Any) -> Dict[str, Any]:
    """Saves generated content (outline, notes, quiz, exam) to its respective table."""
    
    table_map = {
        "outline": ("lesson_outlines", "outline_text"),
        "notes": ("lesson_notes", "notes_text"),
        "quiz": ("lesson_quizzes", "quiz_data_json"),
        "exam": ("lesson_exams", "exam_data_json")
    }

    if content_type not in table_map:
        return {"success": False, "message": "Invalid content type specified."}
        
    table_name, column_name = table_map[content_type]
    
    try:
        # Verify that the user is the creator of the lesson before saving
        lesson_res = supabase.table("lessons").select("creator_id").eq("id", lesson_id).single().execute()
        if not lesson_res.data or lesson_res.data.get("creator_id") != creator_id:
            return {"success": False, "message": "Authorization error: You are not the creator of this lesson."}

        # Upsert logic: update if exists, insert if not. `on_conflict` needs a unique constraint.
        # Let's use a simpler delete-then-insert for now, or assume one-time insertion.
        # For this implementation, we'll assume we are inserting for the first time.
        response = supabase.table(table_name).insert({
            "lesson_id": lesson_id,
            column_name: content_data
        }).execute()
        
        if response.data:
            return {"success": True, "message": f"{content_type.capitalize()} content saved successfully."}
        else:
            logger.error(f"Supabase error saving {content_type}: {response.error.message if response.error else 'Unknown error'}")
            return {"success": False, "message": f"Failed to save {content_type} content."}

    except Exception as e:
        logger.error(f"Error saving lesson content for lesson {lesson_id}: {e}", exc_info=True)
        return {"success": False, "message": f"A server error occurred while saving {content_type}."}


async def submit_student_score(
    supabase: Client,
    lesson_id: str,
    student_id: str,
    score: int,
    total_questions: int
) -> Dict[str, Any]:
    """Saves a student's submission for a quiz or exam."""
    try:
        response = supabase.table("student_submissions").insert({
            "lesson_id": lesson_id,
            "student_id": student_id,
            "score": score,
            "total_questions": total_questions
        }).execute()
        
        if response.data:
            return {"success": True, "submission": response.data[0]}
        else:
            logger.error(f"Supabase error submitting score: {response.error.message if response.error else 'Unknown error'}")
            return {"success": False, "message": "Failed to submit score."}

    except Exception as e:
        logger.error(f"Error submitting student score for lesson {lesson_id}: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while submitting your score."}
