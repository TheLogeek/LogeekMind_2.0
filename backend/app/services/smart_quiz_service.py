from typing import Dict, Any, List, Optional, Tuple
from app.services.gemini_service import get_gemini_client
from app.services.usage_service import log_usage, log_performance
from supabase import Client
from postgrest.exceptions import APIError  # Added for Supabase v2 error handling
from google import genai
import json
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
import io
import re  # Import re for regex operations
import uuid  # For generating shareable IDs
import datetime  # For timestamping submissions
import logging

logger = logging.getLogger(__name__)

# Helper function to clean markdown text for docx
def _clean_markdown_text_for_docx(text_content: str) -> str:
    # Replace HTML <br> with newline
    text_content = text_content.replace('<br>', '\n')

    # Remove bold, italic, and strikethrough markers
    text_content = re.sub(r'(\*\*|__)(.*?)\1', r'\2', text_content)  # **bold** or __bold__
    text_content = re.sub(r'(\*|_)(.*?)\1', r'\2', text_content)    # *italic* or _italic_
    text_content = re.sub(r'~~(.*?)~~', r'\1', text_content)        # ~~strikethrough~~

    # Remove links [text](url) -> text
    text_content = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text_content)

    # Remove inline code blocks `code`
    text_content = re.sub(r'`([^`]+)`', r'\1', text_content)

    # More aggressive cleanup for math environments for simpler display if not rendering
    text_content = re.sub(r'\[a-zA-Z]+\{.*?\}', '', text_content)  # Remove LaTeX commands like \frac{..., \sqrt{...
    text_content = re.sub(r'\[a-zA-Z]+', '', text_content)  # Remove LaTeX commands like \frac, \sqrt
    text_content = re.sub(r'\{.*?\}', '', text_content)  # Remove content in curly braces after LaTeX commands
    text_content = text_content.replace('$', '')  # Catch any remaining lone $

    # Handle Markdown tables: simply strip pipes and header separators
    # This will turn tables into continuous lines of text, which is a compromise for simplicity
    text_content = re.sub(r'\|.*\|', lambda m: m.group(0).replace('|', ' '), text_content)  # Replace pipes with spaces
    text_content = re.sub(r'[-=]+\s*[-=]+\s*[-=]+', '', text_content)  # Remove table header separators (---)

    # Remove block code fences ```
    text_content = text_content.replace('```', '')

    return text_content.strip()


DIFFICULTY_MAP = {1: "introductory", 2: "beginner", 3: "intermediate", 4: "advanced", 5: "expert"}

async def generate_quiz_service(
    supabase: Client,
    user_id: str,
    username: str,
    quiz_topic: str,
    num_questions: int,
    quiz_type: str,
    difficulty: int,
    is_sharable: bool = False  # New parameter added
) -> Dict[str, Any]:

    if not quiz_topic:
        return {"success": False, "message": "Quiz topic is required."}

    if is_sharable and user_id.startswith("guest_"):
        return {"success": False, "message": "Guest users cannot create sharable quizzes. Please log in to use this feature."}

    client, error_message = await get_gemini_client(user_id=user_id)
    if error_message:
        return {"success": False, "message": error_message}

    quiz_prompt = f"""
    You are an expert quiz creator. Create a {quiz_type} quiz on the topic: \"{quiz_topic}\".
    Difficulty: {DIFFICULTY_MAP[difficulty]}.
    Number of Questions: {num_questions}.

    OUTPUT FORMAT:
    Return ONLY a raw JSON list of dictionaries. Do NOT use Markdown code blocks (like ```json).
    Each dictionary must have these keys:
    - \"question\": The question text
    - \"options\": A list of strings (e.g., [\"Option A\", \"Option B\", \"Option C\", \"Option D\"] or [\"True\", \"False\"])
    - \"answer\": The exact string of the correct option
    - \"explanation\": A short explanation of why it is correct
    """

    generated_quiz_data = None
    share_id = None  # Initialize share_id to None

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[quiz_prompt]
        )

        if not response.text:
            print("Gemini API returned an empty response.")
            return {"success": False, "message": "Gemini API returned an empty response. Please try again."}

        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        generated_quiz_data = json.loads(cleaned_text)

        # Save to shared_quizzes if sharable
        if is_sharable:
            share_id = str(uuid.uuid4())  # Generate a unique share ID
            try:
                # Updated for Supabase v2: wrapped in try/except APIError
                supabase.table("shared_quizzes").insert({
                    "id": share_id,
                    "creator_id": user_id,
                    "title": f"{quiz_topic} Quiz ({num_questions} Qs)",  # Basic title for shared quiz
                    "quiz_data": generated_quiz_data
                }).execute()
                
            except APIError as db_e:
                logger.error(f"Supabase error saving shared quiz: {db_e.message}")
                print(f"Failed to save shared quiz to Supabase: {db_e.message}")
                share_id = None  # Ensure share_id is None if saving failed
            except Exception as db_e:
                logger.error(f"Exception during Supabase insertion for shared quiz: {db_e}", exc_info=True)
                print(f"Exception during Supabase insertion for shared quiz: {db_e}")
                share_id = None  # Ensure share_id is None if DB operation fails

        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Quiz Generator",
            action="generated",
            metadata={"topic": quiz_topic, "num_questions": num_questions, "is_sharable": is_sharable}
        )

        # Return share_id only if it was successfully generated and saved
        return {"success": True, "quiz_data": generated_quiz_data, "share_id": share_id}

    except genai.errors.APIError as e:
        error_message = str(e)
        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message.upper():
            print(f"Gemini API rate limit exceeded during quiz generation: {e}")
            return {"success": False, "message": "Gemini API rate limit exceeded. Please try again in a moment."}
        elif "503" in error_message:
            print(f"AI is currently experiencing high traffic. Try again shortly.")
            return {"success": False, "message": "AI is currently experiencing high traffic. Please try again shortly."}
        else:
            print(f"An API error occurred: {e}")
            return {"success": False, "message": f"A Gemini API error occurred: {e}"}
    except json.JSONDecodeError:
        print(f"JSON Decode Error: {response.text if response.text else 'No response text'}")
        return {"success": False, "message": "The AI generated an invalid quiz format. Please try generating again or check your input."}
    except Exception as e:
        # This catches errors during the generate_content call itself, Supabase insertion, or other unexpected issues.
        print(f"Error during quiz generation or saving: {e}")
        logger.error(f"Error during quiz generation or saving: {e}", exc_info=True)
        return {"success": False, "message": "An unexpected error occurred while generating or saving the quiz."}

async def log_quiz_performance_service(
    supabase: Client,
    user_id: str,
    feature: str,
    score: int,
    total_questions: int,
    correct_answers: int,
    extra: Optional[Dict[str, Any]] = None
):
    return await log_performance(supabase, user_id, feature, score, total_questions, correct_answers, extra)


async def create_docx_from_quiz_results(
    quiz_data: List[Dict[str, Any]],
    quiz_topic: str,
    user_score: int,
    total_questions: int
) -> io.BytesIO:
    doc = Document()
    doc.add_heading(f"Quiz Results: {quiz_topic}", 0)
    doc.add_paragraph(f"Final Score: {user_score}/{total_questions}\n")

    for idx, q in enumerate(quiz_data):
        # Process Question
        question_text = q['question']
        doc.add_heading(f"Q{idx + 1}: {_clean_markdown_text_for_docx(question_text)}", level=2)

        # Process Options
        doc.add_paragraph("Options:")
        for option in q['options']:
            doc.add_paragraph(_clean_markdown_text_for_docx(option), style='List Bullet')

        # Process Correct Answer
        doc.add_paragraph(f"Correct Answer: {_clean_markdown_text_for_docx(q['answer'])}")

        # Process Explanation
        doc.add_paragraph("Explanation:")
        explanation_text = q['explanation']
        for exp_line in explanation_text.split('\n'):
            stripped_exp_line = exp_line.strip()
            if stripped_exp_line:
                doc.add_paragraph(_clean_markdown_text_for_docx(stripped_exp_line))

        doc.add_paragraph("-" * 20)

    doc_io = io.BytesIO()
    doc.save(doc_io)
    doc_io.seek(0)
    return doc_io

# --- New functions for shared quizzes ---

def calculate_grade(score: int, total: int) -> Tuple[str, str]:
    if total == 0:
        return "N/A", "No questions graded."

    percentage = (score / total) * 100
    if percentage >= 70:
        return "A", "Excellent! Distinction level."
    elif percentage >= 60:
        return "B", "Very Good. Keep it up."
    elif percentage >= 50:
        return "C", "Credit. You passed, but barely."
    elif percentage >= 45:
        return "D", "Pass. You need to study more."
    elif percentage >= 40:
        return "E", "Weak Pass. Dangerous territory."
    else:
        return "F", "Fail. You are not ready for this exam."

async def get_shared_quiz(supabase: Client, share_id: str) -> Dict[str, Any]:
    """Fetches a specific shared quiz by its share_id."""
    try:
        # Updated for Supabase v2: wrap in try/except for APIError
        # .single() raises an exception if 0 or >1 rows found
        response = supabase.table("shared_quizzes").select("*, profiles(username)").eq("id", share_id).single().execute()
        
        # If we reach here, response.data exists
        creator = response.data.get("profiles")
        creator_username = creator.get("username") if creator else "A user"

        return {
            "success": True, 
            "quiz_data": response.data["quiz_data"], 
            "creator_username": creator_username,
            "title": response.data.get("title"),
            "creator_id": response.data.get("creator_id"),
            "created_at": response.data.get("created_at")
        }
            
    except APIError as e:
        logger.error(f"Supabase APIError fetching shared quiz {share_id}: {e.message}")
        return {"success": False, "message": "Quiz not found or unavailable."}
    except Exception as e:
        logger.error(f"Error fetching shared quiz {share_id}: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while fetching the quiz."}

async def save_shared_quiz_submission(
    supabase: Client,
    shared_quiz_id: str,
    user_answers: Dict[str, str],
    student_id: Optional[str],
    student_identifier: Optional[str] = None
) -> Dict[str, Any]:
    """Saves a student's submission for a shared quiz."""
    try:
        quiz_fetch_response = await get_shared_quiz(supabase, shared_quiz_id)
        if not quiz_fetch_response["success"]:
            return quiz_fetch_response

        quiz_data = quiz_fetch_response["quiz_data"]
        total_questions = len(quiz_data)

        score = 0
        for idx, q in enumerate(quiz_data):
            if user_answers.get(str(idx)) == q.get('answer'):
                score += 1

        grade, remark = calculate_grade(score, total_questions)

        submission_data = {
            "shared_quiz_id": shared_quiz_id,
            "student_id": student_id,
            "student_identifier": student_identifier,
            "user_answers": user_answers,
            "score": score,
            "total_questions": total_questions
        }
        
        try:
            # Updated for Supabase v2: wrap in try/except
            # Ensure we await the execute call to avoid 'coroutine not subscriptable' error
            response = await supabase.table("shared_quiz_submissions").insert(submission_data).execute()

            return {
                "success": True, 
                "submission_id": response.data[0]['id'],
                "score": score,
                "total_questions": total_questions,
                "grade": grade,
                "remark": remark
            }
        except APIError as db_e:
            logger.error(f"Supabase APIError submitting shared quiz score: {db_e.message}")
            return {"success": False, "message": "Failed to save submission."}

    except Exception as e:
        logger.error(f"Error submitting shared quiz score for quiz {shared_quiz_id}: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while submitting your score."}
