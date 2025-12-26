from typing import Dict, Any, Optional
from app.services.gemini_service import get_gemini_client_and_key, APIError
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
    context: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    
    client, api_key_to_use, error_message = await get_gemini_client_and_key(user_id=user_id, user_api_key=api_key)
    if error_message:
        return {"success": False, "message": error_message}
    
    # Strictly replicating the original logic for constructing contents
    # Original: contents=[st.session_state.hw_image, full_prompt]
    # Here, we adapt st.session_state.hw_image (PIL Image) to its byte representation
    # Pass image as PIL Image object
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
            model="gemini-2.5-flash", # STRICTLY using "gemini-2.5-flash" as per original
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

    except APIError as e:
        error_text = str(e)
        if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text.upper():
            return {"success": False, "message": "Quota Exceeded! The Gemini API key has hit its limit."}
        elif "503" in error_text:
            return {"success": False, "message": "The Gemini AI model is currently experiencing high traffic. Please try again later."}
        elif "Unsupported argument: 'model' value" in error_text: # Specific error if gemini-2.5-flash doesn't handle multimodal
            return {"success": False, "message": "Model 'gemini-2.5-flash' does not support multimodal input. Please ensure your API key allows access to 'gemini-pro-vision' for image processing."}
        else:
            return {"success": False, "message": f"Gemini API Error: {error_text}"}
    except Exception as e:
        print(f"Error during homework solution generation: {e}")
        return {"success": False, "message": str(e)}

async def create_docx_from_solution(solution_text: str, context: Optional[str] = None) -> io.BytesIO:
    doc = Document()
    doc.add_heading("Homework Solution", 0)
    if context:
        doc.add_heading(f"Instructions: {context}", 1)
    
    for line in solution_text.split('\n'):
        if line.strip().startswith('###'):
            doc.add_heading(line.replace('###', '').strip(), level=3)
        elif line.strip().startswith('##'):
            doc.add_heading(line.replace('##', '').strip(), level=2)
        elif line.strip().startswith('*') or line.strip().startswith('-'):
            doc.add_paragraph(line.strip(), style='List Bullet')
        else:
            doc.add_paragraph(line.strip())

    doc_io = io.BytesIO()
    doc.save(doc_io)
    doc_io.seek(0)
    return doc_io
