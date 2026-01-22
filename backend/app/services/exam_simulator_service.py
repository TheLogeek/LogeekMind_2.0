from typing import Dict, Any, List, Optional, Tuple
from app.services.gemini_service import get_gemini_client
from app.services.usage_service import log_usage, log_performance
from google import genai
from supabase import Client
import json
from docx import Document
import io
import time # For timestamp in DOCX filename
import re # Import re for regex operations

# Helper function to extract text from file content
async def _extract_text_from_file_content(file_content: bytes, file_name: str) -> Optional[str]:
    """Extracts text from a file content based on its extension."""
    try:
        if file_name.lower().endswith('.pdf'):
            pdf_reader = PdfReader(BytesIO(file_content))
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text: # Ensure text is not None
                    text += page_text + "\n"
            if not text.strip(): # Check if extraction yielded any text
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
            return None # Unsupported file type
    except Exception as e:
        print(f"Error extracting text from file {file_name}: {e}")
        return f"Error processing file {file_name}: {e}"


GRADE_POINTS = { # Used in GPA Calculator, but good for reference
    "A": 5.0, "B": 4.0, "C": 3.0, "D": 2.0, "E": 1.0, "F": 0.0
}

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

async def generate_exam_questions(

    supabase: Client,

    user_id: str,

    username: str,

    course_name: str,

    num_questions: int, # num_questions moved up for clarity

    topic: Optional[str] = None, # Make topic optional

    lecture_notes_content: Optional[str] = None, # New parameter for notes

    file_name: Optional[str] = None, # For logging if notes are provided

    is_sharable: bool = False # New parameter for sharing

) -> Dict[str, Any]:

    

    share_id = None # Initialize share_id to None

    

    if not course_name:

        return {"success": False, "message": "Course Name is required."}

    

    if not topic and not lecture_notes_content:

        return {"success": False, "message": "Either a topic or lecture notes must be provided."}



    client, error_message = await get_gemini_client(user_id=user_id)

    if error_message:

        return {"success": False, "message": error_message}

    

    # Construct prompt dynamically

    if lecture_notes_content:

        prompt = f"""

You are a strict university professor. Generate {num_questions} examination-standard multiple-choice questions

based on the provided lecture notes. The questions should be a mix of requiring critical thinking or application of concepts from the notes and definitions, types, examples and other concepts from the notes.

Ensure questions are relevant ONLY to the content within the provided notes.



Course: {course_name}



Lecture Notes:

---\n{lecture_notes_content}

---



OUTPUT FORMAT:

Return ONLY a raw JSON list of dictionaries. Do NOT use Markdown code blocks.

Each dictionary must have these keys:

- \"question\": complex scenario or problem statement derived from the notes

- \"options\": A list of strings

- \"answer\": The exact string of the correct option

- \"explanation\": A short explanation of why it is correct, referencing the notes where applicable.

        """

    else: # Use topic if no lecture notes are provided

        prompt = f"""

You are a strict university professor setting a final exam.

Course: {course_name}

Topic: {topic if topic else 'General'}



Generate {num_questions} examination-standard multiple-choice questions.

The questions should be a mix of requiring critical thinking or application of concepts from the notes and definitions, types, examples and other concepts relevant to the subject and topic if any

OUTPUT FORMAT:

Return ONLY a raw JSON list of dictionaries. Do NOT use Markdown code blocks.

Each dictionary must have these keys:

- \"question\": complex scenario or problem statement

- \"options\": A list of strings (e.g., [\"Option A\", \"Option B\", \"Option C\", \"Option D\"])

- \"answer\": The exact string of the correct option

- \"explanation\": A short explanation of why it is correct

        """

    

    try:

        response = client.models.generate_content(

            model="gemini-2.5-flash",

            contents=[prompt]

        )

        

        # Handle potential empty or malformed response text

        if not response.text:

            print("Gemini API returned an empty response.")

            return {"success": False, "message": "Gemini API returned an empty response. Please try again."}



        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()

        exam_data = json.loads(cleaned_text)



        # --- Sharing logic ---

        if is_sharable:

            import uuid # Import uuid for generating share IDs

            share_id = str(uuid.uuid4())

            try:

                # Save to shared_exams table in Supabase

                await supabase.table("shared_exams").insert({

                    "id": share_id,

                    "creator_id": user_id,

                    "course_name": course_name,

                    "topic": topic if topic else (file_name if file_name else "Notes"), # Use file_name or "Notes" as topic if no explicit topic

                    "num_questions": num_questions,

                    "exam_data": exam_data # Store the generated questions

                }).execute()

                print(f"Exam shared successfully with ID: {share_id}") # Log for debugging

            except Exception as db_e:

                print(f"Error saving shared exam to Supabase: {db_e}") # Log DB errors

                # Decide whether to raise an error or just not share

                # For now, we'll log and proceed, returning success=True but without share_id

                share_id = None # Ensure share_id is None if DB save fails





        await log_usage(

            supabase=supabase,

            user_id=user_id,

            user_name=username,

            feature_name="Exam Simulator",

            action="generated_exam",

            metadata={"course": course_name, "topic": topic if topic else "notes", "num_questions": num_questions, "source_file": file_name, "is_sharable": is_sharable}

        )



        return {"success": True, "exam_data": exam_data, "share_id": share_id} # Return share_id if generated



    except json.JSONDecodeError:

        print(f"JSON Decode Error: {response.text if response.text else 'No response text'}")

        return {"success": False, "message": "The AI generated an invalid quiz format. Please try generating again or check your input."}

    except genai.errors.APIError as e:

        error_message = str(e)

        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message.upper():

            print(f"Gemini API rate limit exceeded during exam generation: {e}")

            return {"success": False, "message": "AI is currently experiencing high traffic. Please try again shortly."}

        elif "503" in error_message:

            print(f"AI is currently experiencing high traffic. Try again shortly.")

            return {"success": False, "message": "AI is currently experiencing high traffic. Please try again shortly."}

        else:

            print(f"An API error occurred: {e}")

            return {"success": False, "message": f"A Gemini API error occurred: {e}"}

    except Exception as e:

        print(f"Error during exam generation: {e}")

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

        if user_answers.get(str(idx)) == q.answer:

            score += 1



    grade, remark = calculate_grade(score, total_questions)



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

        clean_question = clean_question.replace(', '')

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

        doc.add_paragraph("Explanation:")

        explanation_text = q.get('explanation', 'No explanation provided.')

        for exp_line in explanation_text.split('\n'):

            stripped_exp_line = exp_line.strip()

            text_content = stripped_exp_line.replace('**', '').replace('__', '').replace('*', '').replace('_', '')

            text_content = text_content.replace(', '')

            text_content = re.sub(r'\\a-zA-Z+', '', text_content)

            text_content = re.sub(r'\{.*?\}', '', text_content)

            if text_content:

                doc.add_paragraph(text_content)



        doc.add_paragraph("-" * 20)



    doc_io = io.BytesIO()

    doc.save(doc_io)

    doc_io.seek(0)

    return doc_io



# --- New functions for shared exams ---

import uuid # Import uuid for generating share IDs



async def get_shared_exam(supabase: Client, share_id: str) -> Dict[str, Any]:

    """Fetches a specific shared exam by its share_id."""

    try:

        response = await supabase.table("shared_exams").select("*").eq("id", share_id).single().execute()

        if response.data:

            # Fetch creator username for display. Assumes 'profiles' table and 'username' column.

            creator_username = None

            if response.data.get("creator_id"):

                profile_response = await supabase.table("profiles").select("username").eq("id", response.data["creator_id"]).single().execute()

                if profile_response.data:

                    creator_username = profile_response.data.get("username")

            

            # Return exam data and creator username

            return {"success": True, "exam_data": response.data["exam_data"], "creator_username": creator_username}

        else:

            return {"success": False, "message": "Exam not found."}

    except Exception as e:

        print(f"Error fetching shared exam {share_id}: {e}")

        return {"success": False, "message": "A server error occurred while fetching the exam."}



async def submit_shared_exam_results(

    supabase: Client,

    share_id: str,

    user_answers: Dict[str, str]

) -> Dict[str, Any]:

    """Submits answers for a shared exam and returns the score."""

    try:

        # Fetch the original exam data to grade the answers

        exam_fetch_response = await get_shared_exam(supabase, share_id)

        if not exam_fetch_response["success"]:

            return {"success": False, "message": exam_fetch_response["message"]}

        

        exam_data = exam_fetch_response["exam_data"]

        

        # Grade the exam

        score = 0

        total_questions = len(exam_data)

        for idx, q in enumerate(exam_data):

            # Compare user's answer (as string index) with the correct answer

            if user_answers.get(str(idx)) == q.get('answer'): # Use .get for safety

                score += 1

        

        # Calculate grade and remark

        grade, remark = calculate_grade(score, total_questions)



        # Save submission to shared_exam_submissions table

        submission_payload = {

            "shared_exam_id": share_id,

            "student_id": None, # Anonymous submission for now

            "user_answers": user_answers,

            "score": score,

            "total_questions": total_questions,

            "submitted_at": datetime.utcnow().isoformat() + "Z" # Use ISO format with Z for UTC

        }

        

        response = await supabase.table("shared_exam_submissions").insert(submission_payload).execute()

        

        if response.data:

            return {

                "success": True,

                "submission_id": response.data[0]["id"], # Assuming 'id' is the primary key

                "score": score,

                "total_questions": total_questions,

                "grade": grade,

                "remark": remark

            }

        else:

            print(f"Supabase error saving shared exam submission: {response.error.message if response.error else 'Unknown error'}")

            return {"success": False, "message": "Failed to save submission."}



    except Exception as e:

        print(f"Error during shared exam submission processing: {e}")

        return {"success": False, "message": "A server error occurred while processing your exam submission."}
