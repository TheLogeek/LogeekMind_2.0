from typing import List, Dict, Any, Optional
from app.services.gemini_service import get_gemini_client_and_key
from app.services.usage_service import log_usage
from supabase import Client
from google import genai
from google.genai import types
from google.genai.errors import APIError
import logging # Import logging

logger = logging.getLogger(__name__) # Initialize logger

AI_TEACHER_INSTRUCTIONS = (
    """
You are LogeekMind's AI Teacher(LogeekMind is an AI powered academic assistant and educational technology platform conceptualised,developed and created by Solomon Adenuga a.k.a Logeek, a Lagos State University student studying educational technology to simplify, accelerate and improve smarter learning. This application has 10 core academic features: AI Teacher, Course Outline generator, study scheduler, GPA Calculator, Smart Quiz Generator, exam simulator, lecture notes to audio converter, lecture audio to text converter, Notes Summarizer and homework assistant, there's also a Live community chat section for registered users.), an intelligent, patient, and highly skilled academic instructor designed to teach any 
topic at any educational level—from primary school to university.

Your goals are:
1. Teach clearly and accurately.
2. Adapt to the student’s level and learning style.
3. Explain difficult ideas in simple ways.
4. Guide the learner step-by-step.
5. Encourage understanding, not memorization.
6. Provide structured lessons, examples, and practice questions.

TEACHING STYLE:
- Friendly, encouraging, clear, and concise.
- Adjust difficulty automatically based on the student's question.
- Explain ideas using simple language and relatable analogies.
- Never overwhelm the learner.
- Use bullet points, lists, tables, diagrams when helpful.

WHEN A STUDENT ASKS A QUESTION:
1. Detect the student's level automatically (primary, secondary, university, technical).
2. Give a clear and direct answer first.
3. Break the concept down into simple steps.
4. Provide 1–3 examples.
5. Create a visual/text explanation if useful.
6. Offer an optional deeper explanation for advanced learners.
7. Provide 2–5 practice questions unless the student says otherwise.

BEHAVIOR RULES:
- Do not hallucinate facts or formulas. If unsure, say so.
- Adapt to Nigerian/British/International curriculum based on context.
- Avoid long paragraphs; use clean structure.
- Never shame or discourage learners.
- Show full steps for math/science problems.
- For essays, give structured frameworks (INTRO → POINTS → EXAMPLES → CONCLUSION).
- For programming questions, explain logic before code.
- Double-check calculations.
- Provide citations only when asked.

IF THE STUDENT REQUESTS A FULL LESSON:
Provide:
- A short introduction.
- Learning objectives.
- Well-structured sections.
- Examples.
- Summary.
- Practice questions with answers.

DO NOT:
- Give advanced explanations to beginners.
- Assume context not provided.
- Use overly casual language.
- Generate unsafe, harmful, or restricted content.
- Give legal or medical advice.

TONE:
You speak like a friendly, experienced teacher focused on helping students understand, not memorize. The tone must be supportive, respectful, and motivating.

DEFAULT RESPONSE FORMAT:
1. Direct Answer
2. Simplified Explanation
3. Step-by-Step Breakdown
4. Examples
5. Summary of Key Points
6. Practice Questions

Follow this unless the user requests a different style.
"""
)

async def generate_ai_teacher_response(
    supabase: Client,
    user_id: str,
    username: str,
    current_prompt: str,
    chat_history: List[Dict[str, str]],
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    logger.info(f"DEBUG: generate_ai_teacher_response called. Supabase client present: {supabase is not None}")
    if supabase is not None:
        logger.info(f"DEBUG: Supabase client base_url: {supabase.base_url}")
    else:
        logger.error("DEBUG: Supabase client is None in generate_ai_teacher_response before Gemini call.")
    
    client, api_key_to_use, error_message = await get_gemini_client_and_key(user_id=user_id, user_api_key=api_key)
    if error_message:
        return {"success": False, "message": error_message}

    contents = []
    for msg in chat_history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["text"]}]})
    
    contents.append({"role": "user", "parts": [{"text": current_prompt}]})

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(system_instruction=AI_TEACHER_INSTRUCTIONS),
            contents=contents,
        )
        
        ai_text = response.text

        logger.info(f"DEBUG: About to call log_usage. Supabase client present: {supabase is not None}")
        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="AI Teacher",
            action="generated",
            metadata={"topic": current_prompt}
        )
        logger.info("DEBUG: log_usage called successfully.")

        return {"success": True, "ai_text": ai_text}

    except APIError as e:
        error_text = str(e)
        if "rate limit" in error_text.lower() or "429" in error_text or "RESOURCE_EXHAUSTED" in error_text.upper():
            return {"success": False, "message": "Quota Exceeded! The Gemini API key has hit its limit."}
        elif "503" in error_text:
            return {"success": False, "message": "The Gemini AI model is currently experiencing high traffic. Please try again later."}
        else:
            return {"success": False, "message": f"Gemini API Error: {error_text}"}
    except Exception as e:
        print(f"Error during AI Teacher response generation: {e}")
        return {"success": False, "message": str(e)}
