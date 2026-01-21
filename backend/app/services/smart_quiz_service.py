from typing import Dict, Any, List, Optional
from app.services.gemini_service import get_gemini_client
from app.services.usage_service import log_usage, log_performance
from supabase import Client
from google import genai
import json
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
import io
import re # Import re for regex operations

# Helper function to clean markdown text for docx
def _clean_markdown_text_for_docx(text_content: str) -> str:
    # Replace HTML <br> with newline
    text_content = text_content.replace('<br>', '\n')
    
    # Remove bold, italic, and strikethrough markers
    text_content = re.sub(r'(\*\*|__)(.*?)\1', r'\2', text_content) # **bold** or __bold__
    text_content = re.sub(r'(\*|_)(.*?)\1', r'\2', text_content)   # *italic* or _italic_
    text_content = re.sub(r'~~(.*?)~~', r'\1', text_content)       # ~~strikethrough~~

    # Remove links [text](url) -> text
    text_content = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text_content)

    # Remove inline code blocks `code`
    text_content = re.sub(r'`([^`]+)`', r'\1', text_content)

    # More aggressive cleanup for math environments for simpler display if not rendering
    text_content = re.sub(r'\[a-zA-Z]+\{.*?\}', '', text_content) # Remove LaTeX commands like \frac{..., \sqrt{...}
    text_content = re.sub(r'\[a-zA-Z]+', '', text_content) # Remove LaTeX commands like \frac, \sqrt
    text_content = re.sub(r'\{.*?\}', '', text_content) # Remove content in curly braces after LaTeX commands
    text_content = text_content.replace('$', '') # Catch any remaining lone $

    # Handle Markdown tables: simply strip pipes and header separators
    # This will turn tables into continuous lines of text, which is a compromise for simplicity
    text_content = re.sub(r'\|.*\|', lambda m: m.group(0).replace('|', ' '), text_content) # Replace pipes with spaces
    text_content = re.sub(r'[-=]+\s*[-=]+\s*[-=]+', '', text_content) # Remove table header separators (---)
    
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
    difficulty: int
) -> Dict[str, Any]:
    
    if not quiz_topic:
        return {"success": False, "message": "Quiz topic is required."}

    client, error_message = await get_gemini_client(user_id=user_id)
    if error_message:
        return {"success": False, "message": error_message}
    
    quiz_prompt = f"""
    You are an expert quiz creator. Create a {quiz_type} quiz on the topic: "{quiz_topic}".
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

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
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

    except genai.errors.APIError as e:
        error_message = str(e)
        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message.upper():
            print(f"Gemini API rate limit exceeded during summarization: {e}")
            return {"success": False, "message": "AI is currently experiencing high traffic. Please try again shortly."}
        elif "503" in error_message:
            print(f"AI is currently eperiencing high traffic. Try again shortly.")
            return {"success": False, "message": "AI is currently experiencing high traffic. Please try again shortly."}
        else:
            print(f"An API error occurred: {e}")
            return "", f"An API error occurred: {e}"
    except json.JSONDecodeError:
        return {"success": False, "message": "The AI generated an invalid quiz format. Please try generating again or try a different topic."}
    except Exception as e:
        print(f"Error during quiz generation: {e}")
        return {"success": False, "message": "An unexpected error occurred while generating the quiz."}

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