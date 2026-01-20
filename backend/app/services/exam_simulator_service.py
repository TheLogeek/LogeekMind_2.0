from typing import Dict, Any, List, Optional, Tuple
from app.services.gemini_service import get_gemini_client
from app.services.usage_service import log_usage, log_performance
from google import genai
from supabase import Client
import json
from docx import Document
import io
import time # For timestamp in DOCX filename

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
    topic: str,
    num_questions: int
) -> Dict[str, Any]:
    
    if not course_name:
        return {"success": False, "message": "Course Name is required."}

    client, error_message = await get_gemini_client(user_id=user_id)
    if error_message:
        return {"success": False, "message": error_message}
    
    prompt = f"""
You are a strict university professor setting a final exam.
Course: {course_name}
Topic: {topic if topic else 'General'}

Generate {num_questions} HARD, examination-standard multiple-choice questions.
These should not be simple definitions. They should require critical thinking or application of concepts.

OUTPUT FORMAT:
Return ONLY a raw JSON list of dictionaries. Do NOT use Markdown code blocks.
Each dictionary must have these keys:
- \"question\": complex scenario or problem statement
- \"options\": A list of strings (e.g., ["Option A", "Option B", "Option C", "Option D"])
- \"answer\": The exact string of the correct option
- \"explanation\": A short explanation of why it is correct
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt]
        )
        
        cleaned_text = response.text.replace("```json", "").replace("```", "").strip()
        exam_data = json.loads(cleaned_text)

        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Exam Simulator",
            action="generated_exam",
            metadata={"course": course_name, "topic": topic, "num_questions": num_questions}
        )

        return {"success": True, "exam_data": exam_data}

    except json.JSONDecodeError:
        return {"success": False, "message": "The AI generated an invalid format. Please try again."}
    except genai.errors.APIError as e:
        error_message = str(e)
        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message.upper():
            print(f"Gemini API rate limit exceeded during summarization: {e}")
            return "", "Gemini API rate limit exceeded. Please try again in a moment."
        elif "503" in error_message:
            print(f"AI is currently eperiencing high traffic. Try again shortly.")
            return "", "AI is currently eperiencing high traffic. Please try again shortly."
        else:
            print(f"An API error occurred: {e}")
            return "", f"An API error occurred: {e}"
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
    topic: str
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
        extra={"course": course_name, "topic": topic}
    )
    
    await log_usage(
        supabase=supabase,
        user_id=user_id,
        user_name=username,
        feature_name="Exam Simulator",
        action="submitted_exam",
        metadata={"course": course_name, "score": score, "total": total_questions}
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
    topic: str
) -> io.BytesIO:
    doc = Document()
    doc.add_heading(f"Exam Results: {course_name}", 0)
    if topic:
        doc.add_paragraph(f"Topic: {topic}")
    doc.add_paragraph(f"Final Score: {score}/{total_questions}\nGrade: {grade}")
    doc.add_paragraph("-" * 20)

    for idx, q in enumerate(exam_data):
        user_choice = user_answers.get(str(idx))
        
        # Process Question
        clean_question = q['question'].replace('**', '').replace('__', '').replace('*', '').replace('_', '')
        clean_question = clean_question.replace('$', '')
        clean_question = re.sub(r'\\[a-zA-Z]+', '', clean_question)
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
            text_content = text_content.replace('$', '')
            text_content = re.sub(r'\\[a-zA-Z]+', '', text_content)
            text_content = re.sub(r'\{.*?\}', '', text_content)
            if text_content:
                doc.add_paragraph(text_content)

        doc.add_paragraph("-" * 20)

    doc_io = io.BytesIO()
    doc.save(doc_io)
    doc_io.seek(0)
    return doc_io
