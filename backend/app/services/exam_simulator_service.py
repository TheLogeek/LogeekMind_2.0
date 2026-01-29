from typing import Dict, Any, List, Optional, Tuple
from app.services.groq_service import get_groq_client, call_groq
from groq import GroqError
from app.services.usage_service import log_usage, log_performance
from supabase import Client
from postgrest.exceptions import APIError  # Added for Supabase v2 error handling
import json
from docx import Document
import io
import time  # For timestamp in DOCX filename
import re  # Import re for regex operations
import uuid  # For generating shareable IDs
import datetime  # For timestamping submissions
import logging  # Import logging
from io import BytesIO
from PyPDF2 import PdfReader

logger = logging.getLogger(__name__)

# Helper function to extract text from file content
async def _extract_text_from_file_content(file_content: bytes, file_name: str) -> Optional[str]:
    """Extracts text from a file content based on its extension."""
    try:
        if file_name.lower().endswith('.pdf'):
            pdf_reader = PdfReader(BytesIO(file_content))
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:  # Ensure text is not None
                    text += page_text + "\n"
            if not text.strip():  # Check if extraction yielded any text
                return "Error: Could not extract text from PDF. The file might be image-based or corrupted."
            return text

        elif file_name.lower().endswith('.docx'):
            document = Document(BytesIO(file_content))
            text = ""
            for paragraph in document.paragraphs:
                text += paragraph.text + "\n"
            if not text.strip():
                return "Error: Could not extract text from DOCX. The file might be empty or corrupted."
            return text

        elif file_name.lower().endswith('.txt'):
            return file_content.decode("utf-8")
        else:
            return None  # Unsupported file type
    except Exception as e:
        print(f"Error extracting text from file {file_name}: {e}")
        return f"Error processing file {file_name}: {e}"


GRADE_POINTS = {  # Used in GPA Calculator, but good for reference
    "A": 5.0, "B": 4.0, "C": 3.0, "D": 2.0, "E": 1.0, "F": 0.0
}

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

async def get_exam_performance_comparison(
    supabase: Client,
    shared_exam_id: str,
    current_score_percentage: float
) -> Dict[str, Any]:
    """
    Calculates how the current score compares to other submissions for the same exam.
    Returns the percentile rank.
    """
    try:
        # Fetch all submission scores for this shared exam
        response = supabase.table("shared_exam_submissions").select("percentage_score").eq("shared_exam_id", shared_exam_id).execute()
        
        all_percentages = [sub['percentage_score'] for sub in response.data if sub['percentage_score'] is not None]

        if not all_percentages:
            return {"success": True, "comparison_message": "No other submissions yet for comparison."}
        
        # Count how many scores are lower than or equal to the current score
        better_than_count = sum(1 for p in all_percentages if current_score_percentage > p)
        
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
            return {"success": True, "comparison_message": "Be the first to set the bar for this exam!"}

    except APIError as e:
        logger.error(f"Supabase APIError fetching exam submissions for comparison: {e.message}")
        return {"success": False, "message": "Could not retrieve comparison data."}
    except Exception as e:
        logger.error(f"Error calculating exam performance comparison: {e}", exc_info=True)
        return {"success": False, "message": "An unexpected error occurred during performance comparison."}

async def generate_exam_questions(
    supabase: Client,
    user_id: str,
    username: str,
    course_name: str,
    num_questions: int,
    topic: Optional[str] = None,
    lecture_notes_content: Optional[str] = None,
    file_name: Optional[str] = None,
    is_sharable: bool = False  # Add is_sharable flag
) -> Dict[str, Any]:
    
    if not course_name:
        return {"success": False, "message": "Course Name is required."}
    
    if not topic and not lecture_notes_content:
        return {"success": False, "message": "Either a topic or lecture notes must be provided."}

    if is_sharable and user_id.startswith("guest_"):
        return {"success": False, "message": "Guest users cannot create sharable exams. Please log in to use this feature."}

    client, error_message = get_groq_client()
    if error_message:
        return {"success": False, "message": error_message}
    
    # Construct prompt dynamically
    system_prompt = "You are an expert university professor setting an exam."
    user_prompt_content = ""

    if lecture_notes_content:
        user_prompt_content = f"""
Generate {num_questions} examination-standard multiple-choice questions
based on the provided lecture notes. Do not include any information that is not explicitly mentioned in the text. Focus on the key terms, dates, and logical relationships defined in the notes. Make sure the questions test the student's ability to connect different parts of the lecture.
Ensure questions are relevant ONLY to the content within the provided notes. Employ methods to prevent hitting rate limit like first summarising the notes before setting the questions.

Course: {course_name}

Lecture Notes:
---\n{lecture_notes_content}
---

OUTPUT FORMAT:
Return ONLY a raw JSON list of dictionaries. Do NOT use Markdown code blocks.
For mathematical questions, Do NOT use LaTex commands and make sure the explanation includes a detailed step by step solving
the exact mathematics question after your normal explanation
Each dictionary must have these keys:
- "question": follow the instructions provided and introduce at least one complex scenario or problem statement question where needed and relevant to context without making the question too long
- "options": A list of strings
- "answer": The exact string of the correct option, MUST be the option label (A, B, C, or D). Do NOT return option text.
- "explanation": A short explanation of why it is correct, referencing the notes where applicable.
        """
    else:  # Use topic if no lecture notes are provided
        user_prompt_content = f"""
Course: {course_name}
Topic: {topic if topic else 'General'}

Generate {num_questions} examination-standard multiple-choice questions.
Ensure the questions vary in difficulty from basic facts to complex problem-solving. Include multiple-choice questions with four distinct options where only one is correct. Create distractors that represent common mistakes students make. Use formal and clear language suitable for a high-level academic exam.
OUTPUT FORMAT:
Return ONLY a raw JSON list of dictionaries. Do NOT use Markdown code blocks.
For mathematical questions, Do NOT use LaTex commands and make sure the explanation includes a detailed step by step solving
the exact mathematics question after your normal explanation
Each dictionary must have these keys:
- "question": follow the instructions provided and introduce at least one complex scenario or problem statement question where needed and relevant to context without making the question too long
- "options": A list of strings (e.g., ["Option A", "Option B", "Option C", "Option D"])
- "answer": The exact string of the correct option, MUST be the option label (A, B, C, or D). Do NOT return option text.
- "explanation": A short explanation of why it is correct
        """
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_content}
    ]

    generated_exam_data = None
    share_id = None

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
                    messages=messages,
                    model=model,
                    temperature=0.4
                )
                break
            except Exception as e:
                logger.warning(f"Groq model {model} failed for Exam Simulator: {e}")

        if not response:
            return {
                "success": False,
                "message": "AI service is currently overloaded. Please try again."
            }
        
        # Handle potential empty or malformed response text
        response_content = response.choices[0].message.content.strip()
        if not response_content:
            logger.error("Groq API returned an empty response.")
            return {"success": False, "message": "Groq API returned an empty response. Please try again."}

        cleaned_text = response_content.replace("```json", "").replace("```", "").strip()
        generated_exam_data = json.loads(cleaned_text)

        # Save to shared_exams if sharable
        if is_sharable:
            share_id = str(uuid.uuid4())
            try:
                # Updated for Supabase v2: wrap in try/except, remove .error check
                supabase.table("shared_exams").insert({
                    "id": share_id,
                    "creator_id": user_id,
                    "title": f"{course_name} Exam ({num_questions} Qs)",
                    "exam_data": generated_exam_data
                }).execute()
                
            except APIError as db_e:
                logger.error(f"Supabase error saving shared exam: {db_e.message}")
                share_id = None
            except Exception as db_e:
                logger.error(f"Exception during Supabase insertion for shared exam: {db_e}", exc_info=True)
                share_id = None

        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Exam Simulator",
            action="generated_exam",
            metadata={"course": course_name, "topic": topic if topic else "notes", "num_questions": num_questions, "is_sharable": is_sharable, "source_file": file_name}
        )

        return {"success": True, "exam_data": generated_exam_data, "share_id": share_id}

    except json.JSONDecodeError:
        logger.error(f"JSON Decode Error from Groq: {response_content if response_content else 'No response content'}")
        return {"success": False, "message": "The AI generated an invalid exam format. Please try generating again or check your input."}
    except GroqError as e:
        msg = str(e)
        if "429" in msg:
            return {"success": False, "message": "Too many requests. Please wait briefly."}
        logger.error(f"Groq API error during exam generation: {msg}", exc_info=True)
        return {"success": False, "message": "AI service error. Please try again."}
    except Exception as e:
        logger.error(f"Error during exam generation: {e}", exc_info=True)
        return {"success": False, "message": "An unexpected error occurred while generating the exam."}

async def grade_exam_and_log_performance(
    supabase: Client,
    user_id: str,
    username: str,
    exam_data: List[Dict[str, Any]],
    user_answers: Dict[str, str],
    course_name: str,
    topic: Optional[str] = None, # Make topic optional for logging
    lecture_notes_source: bool = False # Flag to indicate if notes were used
) -> Dict[str, Any]:

    score = 0
    total_questions = len(exam_data)

    for idx, q in enumerate(exam_data):
        user_selected_label = user_answers.get(str(idx))
        correct_answer_value = q.answer # Direct access to attribute

        if user_selected_label and correct_answer_value:
            try:
                if len(user_selected_label) == 1 and user_selected_label.isalpha():
                    option_index = ord(user_selected_label.upper()) - ord('A')

                    if 0 <= option_index < len(q['options']):
                        user_selected_option_value = q['options'][option_index]
                        if user_selected_option_value == correct_answer_value:
                            score += 1
                # Fallback: if the frontend sends the full string instead of a letter
                elif user_selected_label == correct_answer_value:
                    score += 1
            except Exception:
                # If logic fails (e.g., unexpected format), skip grading this specific question
                continue

    # This line caused the error. It is now aligned with the 'score = 0' line above.
    grade, remark, _ = calculate_grade(score, total_questions)

    await log_performance(
        supabase=supabase,
        user_id=user_id,
        feature="Exam Simulator",
        score=score,
        total_questions=total_questions,
        correct_answers=score,
        extra={"course": course_name, "topic": topic if topic else ("notes" if lecture_notes_source else "general")}
    )

    await log_usage(
        supabase=supabase,
        user_id=user_id,
        user_name=username,
        feature_name="Exam Simulator",
        action="submitted_exam",
        metadata={"course": course_name, "score": score, "total": total_questions, "used_notes": lecture_notes_source}
    )

    return {
        "success": True,
        "score": score,
        "total_questions": total_questions,
        "grade": grade,
        "remark": remark
    }


async def create_docx_from_exam_results(
    exam_data: List[Dict[str, Any]],
    user_answers: Dict[str, str],
    score: int,
    total_questions: int,
    grade: str,
    course_name: str,
    topic: Optional[str] = None, # Make topic optional for docx filename
    lecture_notes_source: bool = False
) -> io.BytesIO:
    doc = Document()
    doc.add_heading(f"Exam Results: {course_name}", 0)
    
    if lecture_notes_source and topic: # If notes used and topic is provided (as context for notes)
        doc.add_paragraph(f"Source Context: {topic}")
    elif topic: # If topic is used (and not notes)
        doc.add_paragraph(f"Topic: {topic}")

    doc.add_paragraph(f"Final Score: {score}/{total_questions}\nGrade: {grade}")
    doc.add_paragraph("-" * 20)

    for idx, q in enumerate(exam_data):
        user_choice = user_answers.get(str(idx))
        
        # Process Question
        clean_question = q['question'].replace('**', '').replace('__', '').replace('*', '').replace('_', '')
        clean_question = clean_question.replace('$', '')
        clean_question = re.sub(r'\\a-zA-Z+', '', clean_question)
        clean_question = re.sub(r'\{.*?\}', '', clean_question)
        doc.add_heading(f"Q{idx+1}: {clean_question}", level=2)
        
        # Process Options
        doc.add_paragraph("Options:")
        for option in q['options']:
            clean_option = option.replace('**', '').replace('__', '').replace('*', '').replace('_', '')
            doc.add_paragraph(clean_option, style='List Bullet')
        
        # Process User Answer
        clean_user_choice = user_choice.replace('**', '').replace('__', '').replace('*', '').replace('_', '') if user_choice else '(No answer)'
        doc.add_paragraph(f"Your Answer: {clean_user_choice}")
        
        # Process Correct Answer
        clean_correct_answer = q['answer'].replace('**', '').replace('__', '').replace('*', '').replace('_', '')
        doc.add_paragraph(f"Correct Answer: {clean_correct_answer}")
        
        # Process Explanation
        explanation_text = q.get('explanation', 'No explanation provided.')
        for exp_line in explanation_text.split('\n'):
            stripped_exp_line = exp_line.strip()
            text_content = stripped_exp_line.replace('**', '').replace('__', '').replace('*', '').replace('_', '')
            text_content = text_content.replace('$', '')
            text_content = re.sub(r'\\a-zA-Z+', '', text_content)
            text_content = re.sub(r'\{.*?\}', '', text_content)
            if text_content:
                doc.add_paragraph(text_content)

        doc.add_paragraph("-" * 20)

    doc_io = io.BytesIO()
    doc.save(doc_io)
    doc_io.seek(0)
    return doc_io

async def get_shared_exam(supabase: Client, share_id: str) -> Dict[str, Any]:
    """Fetches a shared exam and its creator's username."""
    try:
        # Updated for Supabase v2: wrap in try/except for APIError
        # .single() raises an exception if 0 or >1 rows found
        response = supabase.table("shared_exams").select("*").eq("id", share_id).single().execute()
        
        # If we reach here, response.data exists
        creator_username = "A user"
        if response.data.get("creator_id"):
            try:
                profile_response = supabase.table("profiles").select("username").eq("id", response.data["creator_id"]).single().execute()
                if profile_response.data:
                    creator_username = profile_response.data.get("username", "A user")
            except APIError:
                pass # Fallback to default username if profile fetch fails
        
        return {"success": True, "exam_data": response.data["exam_data"], "creator_username": creator_username}
            
    except APIError as e:
        logger.error(f"Supabase APIError fetching shared exam {share_id}: {e.message}")
        return {"success": False, "message": "Exam not found or unavailable."}
    except Exception as e:
        logger.error(f"Error fetching shared exam {share_id}: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while fetching the exam."}

async def get_shared_exam_submission_for_download(
    supabase: Client,
    user_id: str,
    shared_exam_id: str,
    submission_id: str
) -> Dict[str, Any]:
    """
    Fetches a specific shared exam submission and prepares data for DOCX generation.
    Authenticates that the current user is the owner of the submission.
    """
    try:
        # 1. Fetch the submission details
        submission_response = await supabase.table("shared_exam_submissions").select("*").eq("id", submission_id).single().execute()
        
        if not submission_response.data:
            logger.warning(f"Submission {submission_id} not found.")
            return {"success": False, "message": "Submission not found."}
        
        submission = submission_response.data

        # 2. Authenticate: Check if the current user is the owner of the submission
        if submission.get("student_id") != user_id:
            logger.warning(f"Unauthorized attempt to download submission {submission_id} by user {user_id}. Owner: {submission.get('student_id')}")
            return {"success": False, "message": "Unauthorized access to submission."}

        # 3. Fetch the shared exam data
        exam_fetch_response = await get_shared_exam(supabase, shared_exam_id)
        if not exam_fetch_response["success"]:
            return {"success": False, "message": exam_fetch_response.get("message", "Shared exam not found.")}
        
        # The title is stored in the 'shared_exams' table, not directly in exam_fetch_response.data
        shared_exam_title_response = await supabase.table("shared_exams").select("title").eq("id", shared_exam_id).single().execute()
        if not shared_exam_title_response.data:
            logger.warning(f"Shared exam {shared_exam_id} title not found.")
            return {"success": False, "message": "Shared exam title not found."}

        exam_data = exam_fetch_response["exam_data"]
        course_name_and_topic = shared_exam_title_response.data.get("title", "Unknown Exam Topic") # Use title for docx

        # Extract course_name and topic from the title if it follows a pattern, otherwise use the whole title.
        # Example title: "Course: Mathematics - Topic: Algebra Exam (10 Qs)"
        # This parsing is heuristic; adjust if the title format changes
        course_name_match = re.search(r"Course: (.*?)(?: - Topic:|$)", course_name_and_topic)
        topic_match = re.search(r"Topic: (.*?)(?: Exam|$)", course_name_and_topic)

        course_name = course_name_match.group(1).strip() if course_name_match else course_name_and_topic
        topic = topic_match.group(1).strip() if topic_match else None

        return {
            "success": True,
            "exam_data": exam_data,
            "score": submission["score"],
            "total_questions": submission["total_questions"],
            "grade": submission["grade"], # Assuming grade is saved in submission
            "course_name": course_name,
            "topic": topic,
            "user_answers": submission["user_answers"]
        }

    except APIError as e:
        logger.error(f"Supabase APIError fetching submission {submission_id}: {e.message}")
        return {"success": False, "message": "Failed to retrieve submission data from database."}
    except Exception as e:
        logger.error(f"Error fetching shared exam submission for download {submission_id}: {e}", exc_info=True)
        return {"success": False, "message": "An unexpected error occurred while preparing download."}

async def submit_shared_exam_results(
    supabase: Client,
    share_id: str,
    user_answers: Dict[str, str],
    student_id: Optional[str] = None, # Optional student_id for logged-in users
    student_identifier: Optional[str] = None # Optional identifier for anonymous users
) -> Dict[str, Any]:
    """Grades and saves a submission for a shared exam."""
    try:
        # 1. Fetch the shared exam to get the correct answers
        exam_response = await get_shared_exam(supabase, share_id)
        if not exam_response["success"]:
            return exam_response # Return the error message ("Exam not found." or server error)

        exam_data = exam_response["exam_data"]
        total_questions = len(exam_data)
        
        # 2. Grade the submission
        score = 0
        for idx, q in enumerate(exam_data):
            user_selected_label = user_answers.get(str(idx))
            correct_answer_value = q.answer # Direct access to attribute

            if user_selected_label and correct_answer_value:
                option_index = ord(user_selected_label.upper()) - ord('A')

                if 0 <= option_index < len(q['options']):
                    user_selected_option_value = q['options'][option_index]
                    if user_selected_option_value == correct_answer_value:
                        score += 1
        
        grade, remark, percentage = calculate_grade(score, total_questions)

        # 3. Save the submission results
        submission_data = {
            "shared_exam_id": share_id,
            "student_id": student_id, # Can be null for anonymous users
            "student_identifier": student_identifier, # Add the identifier
            "user_answers": user_answers,
            "score": score,
            "total_questions": total_questions,
            "percentage_score": percentage, # Save percentage score
            "submitted_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
        
        try:
            # Updated for Supabase v2: wrap in try/except
            insert_response = await supabase.table("shared_exam_submissions").insert(submission_data).execute()
            
            # If successful, return the result
            return {
                "success": True, 
                "submission_id": insert_response.data[0]['id'],
                "score": score,
                "total_questions": total_questions,
                "percentage_score": percentage, # Return percentage
                "grade": grade,
                "remark": remark
            }
        except APIError as db_e:
            logger.error(f"Supabase APIError submitting score: {db_e.message}")
            return {"success": False, "message": "Failed to save submission."}

    except Exception as e:
        logger.error(f"Error submitting shared exam score for exam {share_id}: {e}", exc_info=True)
        return {"success": False, "message": "A server error occurred while submitting your score."}
