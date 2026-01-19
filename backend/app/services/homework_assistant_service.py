from typing import Dict, Any, Optional
from app.services.gemini_service import get_gemini_client
from app.services.usage_service import log_usage
from supabase import Client
from docx import Document
import io
from google import genai
from PIL import Image # Import PIL Image as in original utils.py


async def generate_homework_solution(
    supabase: Client,
    user_id: str,
    username: str,
    image_content: bytes, # Passed as bytes from FastAPI UploadFile
    image_mime_type: str, # mime_type is needed by PIL to identify the image format
    context: Optional[str] = None
) -> Dict[str, Any]:
    
    client, error_message = await get_gemini_client(user_id=user_id)
    if error_message:
        return {"success": False, "message": error_message}
    
    try:
        pil_image = Image.open(io.BytesIO(image_content))
    except Exception as e:
        return {"success": False, "message": f"Could not open image file: {e}"}
    
    full_prompt = f"""
    You are a rigorous academic solver. Based on the image and the user's instructions (if any),
    provide a complete and accurate solution. The output must be in a clean, professional, and easily 
    readable **Markdown format**.

    Instructions:
    {context if context else "The user provided no instructions"}
    """
    
    # Contents list is [PIL Image, prompt_text] as in the original Streamlit code
    contents = [pil_image, full_prompt]

    try:
        # Calling client.models.generate_content exactly as in the original utils.py and feature page
        response = client.models.generate_content(
            model="gemini-pro-vision", # Using gemini-pro-vision for multimodal input
            contents=contents
        )
        
        solution_text = response.text

        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="Homework Assistant",
            action="generated",
            metadata={"context": context}
        )

        return {"success": True, "solution_text": solution_text}

    except Exception as e:
        print(f"Error during homework solution generation: {e}")
        # A more specific check for multimodal model errors might be needed if they differ
        if "gemini-pro-vision" in str(e):
             return {"success": False, "message": "The vision model is currently unavailable. Please try again later."}
        return {"success": False, "message": "An unexpected error occurred while generating the solution."}

async def create_docx_from_solution(solution_text: str, context: Optional[str] = None) -> io.BytesIO:
    doc = Document()
    doc.add_heading("Homework Solution", 0)
    if context:
        doc.add_heading(f"Instructions: {context}", 1)
    
    # Process the markdown line by line
    for line in solution_text.split('\n'):
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
