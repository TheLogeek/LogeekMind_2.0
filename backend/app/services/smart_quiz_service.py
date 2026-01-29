import json
import uuid
import io
import re
import logging
import datetime
from typing import Dict, Any, List, Optional, Tuple
from supabase import Client
from postgrest.exceptions import APIError
from app.services.groq_service import get_groq_client, call_groq
from groq import GroqError
from app.services.usage_service import log_usage, log_performance
from docx import Document

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
    is_sharable: bool = False
) -> Dict[str, Any]:

    if not quiz_topic:
        return {"success": False, "message": "Quiz topic is required."}

    if is_sharable and user_id.startswith("guest_"):
        return {"success": False, "message": "Guest users cannot create sharable quizzes. Please log in."}

    # Get Groq client
    client, error_message = get_groq_client()
    if error_message:
        return {"success": False, "message": error_message}

    # Build quiz prompt
    quiz_prompt = f"""
You are an expert quiz creator. Create a {quiz_type} quiz on the topic: "{quiz_topic}".
Difficulty: {DIFFICULTY_MAP[difficulty]}.
Number of Questions: {num_questions}.

OUTPUT FORMAT:
Return ONLY a JSON list of dictionaries with keys:
- "question": question text
- "options": list of options (e.g., ["A","B","C","D"] or ["True","False"])
- "answer": the correct option
- "explanation": short explanation (if not available, leave empty string)
Do not include Markdown code blocks or extra text.
"""

    try:
        response = None
        models = [
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768"
        ]

        for model in models:
            try:
                response = call_groq(
                    client,
                    messages=[
                        {"role": "system", "content": "You are an expert quiz creator."},
                        {"role": "user", "content": quiz_prompt}
                    ],
                    model=model
                )
                break
            except Exception as e:
                logger.warning(f"Groq model {model} failed: {e}")

        if not response:
            return {
                "success": False,
                "message": "AI service is currently overloaded. Please try again."
            }

        content = response.choices[0].message.content.strip()
        generated_quiz_data = json.loads(content)

        # Ensure each question has an explanation
        for q in generated_quiz_data:
            if "explanation" not in q or not q["explanation"].strip():
                q["explanation"] = "No explanation provided."

        # Save sharable quiz if needed
        share_id = None
        if is_sharable:
            share_id = str(uuid.uuid4())
            try:
                supabase.table("shared_quizzes").insert({
                    "id": share_id,
                    "creator_id": user_id,
                    "title": f"{quiz_topic} Quiz ({num_questions} Qs)",
                    "quiz_data": generated_quiz_data
                }).execute()
            except APIError as db_e:
                logger.error(f"Supabase APIError saving shared quiz: {db_e.message}")
                share_id = None
            except Exception as e:
                logger.error(f"Exception saving shared quiz: {e}", exc_info=True)
                share_id = None

        # Log usage
        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Quiz Generator",
            action="generated",
            metadata={"topic": quiz_topic, "num_questions": num_questions, "is_sharable": is_sharable}
        )

        return {"success": True, "quiz_data": generated_quiz_data, "share_id": share_id}

    except GroqError as e:
        msg = str(e)
        if "429" in msg:
            return {"success": False, "message": "Too many requests. Please wait briefly."}
        logger.error(f"Groq API error during quiz generation: {msg}", exc_info=True)
        return {"success": False, "message": "AI service error. Please try again."}

    except json.JSONDecodeError:
        logger.error("Invalid JSON returned from Groq during quiz generation", exc_info=True)
        return {
            "success": False,
            "message": "AI returned an invalid quiz format. Try again."
        }

    except Exception as e:
        logger.error("Unexpected error during quiz generation", exc_info=True)
        return {
            "success": False,
            "message": "An unexpected error occurred while generating the quiz."
        }


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

def calculate_grade(score: int, total: int) -> Tuple[str, str, float]:
    if total == 0:
        return "N/A", "No questions graded.", 0.0

    percentage = (score / total) * 100
    if percentage >= 70:
        return "A", "Excellent! Distinction level.", percentage
    elif percentage >= 60:
        return "B", "Very Good. Keep it up.", percentage
    elif percentage >= 50:
        return "C", "Credit. You passed, but barely.", percentage
    elif percentage >= 45:
        return "D", "Pass. You need to study more.", percentage
    elif percentage >= 40:
        return "E", "Weak Pass. Dangerous territory.", percentage
        else:
            return "F", "Fail. You are not ready for this exam.", percentage
    
    async def get_quiz_performance_comparison(
        supabase: Client,
        shared_quiz_id: str,
        current_score_percentage: float
    ) -> Dict[str, Any]:
        """
        Calculates how the current score compares to other submissions for the same quiz.
        Returns the percentile rank.
        """
        try:
            # Fetch all submission scores for this shared quiz
            response = supabase.table("shared_quiz_submissions").select("percentage_score").eq("shared_quiz_id", shared_quiz_id).execute()
            
            all_percentages = [sub['percentage_score'] for sub in response.data if sub['percentage_score'] is not None]
    
            if not all_percentages:
                return {"success": True, "comparison_message": "No other submissions yet for comparison."}
            
            # Count how many scores are lower than or equal to the current score
            # Using strict less than for "better than"
            better_than_count = sum(1 for p in all_percentages if current_score_percentage > p)
            
            # Calculate percentile: (count of scores lower than yours / total scores) * 100
            # If there are N submissions and your score is better than K, you are better than (K/N)*100 %
            # Ensure to handle edge cases like current_score_percentage being the lowest or highest.
            # If there are other submissions, we calculate percentile.
            if len(all_percentages) > 0:
                percentile = (better_than_count / len(all_percentages)) * 100
                
                # Refine the message
                if percentile >= 90:
                    comparison_message = f"Outstanding! You performed better than {percentile:.0f}% of test takers."
                elif percentile >= 75:
                    comparison_message = f"Excellent! You performed better than {percentile:.0f}% of test takers."
                elif percentile >= 50:
                    comparison_message = f"Good job! You performed better than {percentile:.0f}% of test takers."
                else:
                    comparison_message = f"You performed better than {percentile:.0f}% of test takers. Keep studying!"
    
                return {"success": True, "comparison_message": comparison_message, "percentile": percentile}
            else:
                return {"success": True, "comparison_message": "Be the first to set the bar for this quiz!"}
    
        except APIError as e:
            logger.error(f"Supabase APIError fetching quiz submissions for comparison: {e.message}")
            return {"success": False, "message": "Could not retrieve comparison data."}
        except Exception as e:
            logger.error(f"Error calculating quiz performance comparison: {e}", exc_info=True)
            return {"success": False, "message": "An unexpected error occurred during performance comparison."}
    
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

        grade, remark, percentage = calculate_grade(score, total_questions)

        submission_data = {
            "shared_quiz_id": shared_quiz_id,
            "student_id": student_id,
            "student_identifier": student_identifier,
            "user_answers": user_answers,
            "score": score,
            "total_questions": total_questions,
            "percentage_score": percentage # Save percentage score
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
                "percentage_score": percentage, # Return percentage
                "grade": grade,
                "remark": remark
            }
        except APIError as db_e:
            logger.error(f"Supabase APIError submitting shared quiz score: {db_e.message}")
            return {"success": False, "message": "Failed to save submission."}

    except Exception as e:
        logger.error(f"Error submitting shared quiz score for quiz {shared_quiz_id}: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while submitting your score."}
