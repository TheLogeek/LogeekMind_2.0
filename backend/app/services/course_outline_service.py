from typing import Dict, Any, Optional
from app.services.gemini_service import get_gemini_client
from app.services.usage_service import log_usage
from supabase import Client
from docx import Document
import io
from google import genai

async def generate_course_outline(
    supabase: Client,
    user_id: str,
    username: str,
    course_full_name: str,
    course_code: Optional[str] = None,
    university_name: Optional[str] = None
) -> Dict[str, Any]:
    
    if not course_full_name:
        return {"success": False, "message": "Course Full Name is required."}

    client, error_message = await get_gemini_client(user_id=user_id)
    if error_message:
        return {"success": False, "message": error_message}
    
    uni_context = f"taught at {university_name}." if university_name else "taught at a major Nigerian University."
    code_context = f"(Code: {course_code})" if course_code else ""

    outline_prompt = f"""
    You are an expert curriculum designer. Generate a comprehensive, 12-week university_level course outline for the 
    course: "{course_full_name}" {code_context}. The course should reflect standards {uni_context}.

    **REQUIRED SECTIONS:**
    1. **Course Description:** (2-3 sentences)
    2. **Course Objectives:** (4-5 bullet points)
    3. **12-Week Schedule:** Use a **Markdown table** with the columns: **Week**, **Topic**, and **Key Learning Objectives**.

    Ensure the output is formatted cleanly using **Markdown**.
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[outline_prompt]
        )
        
        outline_text = response.text

        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Course Outline Generator",
            action="generated",
            metadata={"course": course_full_name}
        )

        return {"success": True, "outline_text": outline_text}

    except Exception as e:
        print(f"Error during course outline generation: {e}")
        return {"success": False, "message": "An unexpected error occurred while generating the AI response."}

async def create_docx_from_outline(outline_text: str, course_full_name: str) -> io.BytesIO:
    doc = Document()
    doc.add_heading(f"Course Outline: {course_full_name}", 0) 
    
    # Process the markdown line by line
    for line in outline_text.split('\n'):
        stripped_line = line.strip()

        # Handle Headers
        if stripped_line.startswith('###'):
            doc.add_heading(stripped_line.replace('###', '').strip(), level=3)
        elif stripped_line.startswith('##'):
            doc.add_heading(stripped_line.replace('##', '').strip(), level=2)
        elif stripped_line.startswith('#'):
            doc.add_heading(stripped_line.replace('#', '').strip(), level=1)
        # Handle List Items
        elif stripped_line.startswith('* ') or stripped_line.startswith('- '):
            # Remove Markdown list prefix
            text_content = stripped_line[2:].strip()
            # Clean up inline formatting for list items
            text_content = text_content.replace('**', '').replace('__', '').replace('*', '').replace('_', '') # Remove bold/italic markers
            text_content = text_content.replace('$', '') # Remove inline math markers
            doc.add_paragraph(text_content, style='List Bullet')
        # Handle regular paragraphs and other formatting
        else:
            # Clean up inline formatting for paragraphs
            text_content = stripped_line.replace('**', '').replace('__', '').replace('*', '').replace('_', '') # Remove bold/italic markers
            text_content = text_content.replace('$', '') # Remove inline math markers
            # More aggressive cleanup for math environments for simpler display if not rendering
            text_content = re.sub(r'\\[a-zA-Z]+', '', text_content) # Remove LaTeX commands like \frac, \sqrt
            text_content = re.sub(r'\{.*?\}', '', text_content) # Remove content in curly braces after LaTeX commands

            if text_content: # Only add if there's content after stripping
                doc.add_paragraph(text_content)

    doc_io = io.BytesIO()
    doc.save(doc_io)
    doc_io.seek(0)
    return doc_io
