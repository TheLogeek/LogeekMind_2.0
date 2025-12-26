from typing import Dict, Any, List, Optional
from app.services.gemini_service import get_gemini_client_and_key
from app.services.usage_service import log_usage, log_performance
from supabase import Client
import json
from docx import Document
import io
from google import genai
from google.genai.errors import APIError

DIFFICULTY_MAP = {1: "introductory", 2: "beginner", 3: "intermediate", 4: "advanced", 5: "expert"}

async def generate_quiz_service(
    supabase: Client,
    user_id: str,
    username: str,
    quiz_topic: str,
    num_questions: int,
    quiz_type: str,
    difficulty: int,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    
    if not quiz_topic:
        return {"success": False, "message": "Quiz topic is required."}

    client, api_key_to_use, error_message = await get_gemini_client_and_key(user_id=user_id, user_api_key=api_key)
    if error_message:
        return {"success": False, "message": error_message}
    
    quiz_prompt = f"""
    You are an expert quiz creator. Create a {quiz_type} quiz on the topic: "{quiz_topic}".
    Difficulty: {DIFFICULTY_MAP[difficulty]}.
    Number of Questions: {num_questions}.

    OUTPUT FORMAT:
    Return ONLY a raw JSON list of dictionaries. Do NOT use Markdown code blocks (like ```json).
    Each dictionary must have these keys:
    - "question": The question text
    - "options": A list of strings (e.g., ["Option A", "Option B", "Option C", "Option D"] or ["True", "False"])
    - "answer": The exact string of the correct option
    - "explanation": A short explanation of why it is correct
    """

    try:
        response = client.models.generate_content( # Call client.models.generate_content directly
            model="gemini-2.5-flash", # Use the specific model name
            contents=[quiz_prompt]
        )
        
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        quiz_data = json.loads(cleaned_text)

        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Quiz Generator",
            action="generated",
            metadata={"topic": quiz_topic, "num_questions": num_questions}
        )

        return {"success": True, "quiz_data": quiz_data}

    except json.JSONDecodeError:
        return {"success": False, "message": "AI generated invalid JSON. Please try again."}
    except APIError as e:
        error_text = str(e)
        if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text.upper():
            return {"success": False, "message": "Quota Exceeded! The Gemini API key has hit its limit."}
        elif "503" in error_text:
            return {"success": False, "message": "The Gemini AI model is currently experiencing high traffic. Please try again later."}
        else:
            return {"success": False, "message": f"Gemini API Error: {error_text}"}
    except Exception as e:
        print(f"Error during quiz generation: {e}")
        return {"success": False, "message": str(e)}

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
        doc.add_heading(f"Q{idx + 1}: {q['question']}", level=2)
        doc.add_paragraph(f"Options: {', '.join(q['options'])}")
        doc.add_paragraph(f"Correct Answer: {q['answer']}")
        doc.add_paragraph(f"Explanation: {q['explanation']}")
        doc.add_paragraph("-" * 20)

    doc_io = io.BytesIO()
    doc.save(doc_io)
    doc_io.seek(0)
    return doc_io