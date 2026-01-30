import logging
from typing import Dict, Any, List, Optional
from supabase import Client
from groq import GroqError

from app.services.groq_service import get_groq_client, call_groq
from app.services.usage_service import log_usage

logger = logging.getLogger(__name__)

async def get_quiz_ai_insights(
    supabase: Client,
    user_id: str,
    username: str,
    quiz_topic: str,
    quiz_data: List[Dict[str, Any]],
    user_answers: Dict[str, Any],
    user_score: int,
    total_questions: int,
) -> Dict[str, Any]:
    """
    Analyzes quiz results using AI to provide insights on weak points and improvement tips.
    """
    try:
        client, error_message = get_groq_client()
        if error_message:
            return {"success": False, "message": error_message}

        # Prepare a detailed context for the AI
        quiz_context_str = f"Quiz Topic: {quiz_topic}\n"
        quiz_context_str += f"Overall Score: {user_score}/{total_questions}\n\n"
        quiz_context_str += "Questions, Correct Answers, and User's Answers:\n"

        weak_points_identified = []

        for idx, question_obj in enumerate(quiz_data):
            question_text = question_obj.get('question', 'N/A')
            correct_answer = question_obj.get('answer', 'N/A')
            user_answered = user_answers.get(str(idx), 'No Answer')
            is_correct = (user_answered == correct_answer)

            quiz_context_str += f"- Q{idx + 1}: {question_text}\n"
            quiz_context_str += f"  Correct: {correct_answer}\n"
            quiz_context_str += f"  Your Answer: {user_answered} ({'Correct' if is_correct else 'Incorrect'})\n"
            
            if not is_correct:
                weak_points_identified.append(f"Q{idx + 1} (Topic: {quiz_topic}) - Incorrect answer: '{user_answered}', Correct answer: '{correct_answer}'")


        prompt = f"""
You are an expert educational AI tutor. Your task is to analyze a student's quiz performance,
identify their weak points, and provide actionable tips for improvement.

Here is the quiz context and the student's performance:
{quiz_context_str}

Based on this data, please provide the following in a well-structured Markdown format:

1.  **Overall Performance Summary:** A brief summary of the student's performance.
2.  **Identified Weak Points:** List specific topics or question types where the student struggled, referencing particular questions if relevant.
3.  **Targeted Improvement Tips:** Provide 3-5 concrete, actionable tips or strategies for the student to improve in their identified weak areas. These should be educational and encouraging.
4.  **Recommended Resources (Optional):** If applicable, suggest general types of resources (e.g., "review your notes on X", "practice more problems involving Y")
5. In all you do, remember this educational platform is LogeekMind and try not to drive our users away by suggesting other platforms, our AI Teacher feature can easily breakdown complex concepts for students,our LogeekMind homework assistant can solve complex questions, students can use our smart quiz and exam simulator to self assess themselves.

Ensure your response is clear, concise, and directly addresses the student's performance.
"""

        response = None
        models = [
            "llama-3.1-8b-instant", # Prioritize faster models for insights
            "mixtral-8x7b-32768"
        ]

        for model in models:
            try:
                response = call_groq(
                    client,
                    messages=[
                        {"role": "system", "content": "You are an expert educational AI tutor analyzing quiz results."},
                        {"role": "user", "content": prompt}
                    ],
                    model=model,
                    temperature=0.7 # A bit more creative for insights
                )
                break
            except Exception as e:
                logger.warning(f"Groq model {model} failed for AI insights: {e}")

        if not response:
            return {
                "success": False,
                "message": "AI service is currently overloaded or unavailable. Please try again."
            }

        insights_content = response.choices[0].message.content.strip()

        # Log usage
        await log_usage(
            supabase=supabase,
            user_id=user_id,
            user_name=username,
            feature_name="AI Insights (Quiz)",
            action="generated",
            metadata={"quiz_topic": quiz_topic, "user_score": user_score, "total_questions": total_questions}
        )

        return {"success": True, "insights": insights_content}

    except GroqError as e:
        msg = str(e)
        logger.error(f"Groq API error during AI insights generation: {msg}", exc_info=True)
        return {"success": False, "message": "AI service error. Please try again."}
    except Exception as e:
        logger.error(f"Unexpected error during AI insights generation: {e}", exc_info=True)
        return {"success": False, "message": "An unexpected error occurred while generating AI insights."}
