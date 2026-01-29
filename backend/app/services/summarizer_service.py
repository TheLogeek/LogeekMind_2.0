from io import BytesIO
from typing import Optional, Tuple, Any, List
from pypdf import PdfReader
from docx import Document
from app.services.groq_service import get_groq_client, call_groq
from groq import GroqError
import os
import json
import logging

logger = logging.getLogger(__name__)

# Configuration for chunking
MAX_CHUNK_SIZE = 6000  # Characters per chunk (conservative for 8k context models)
CHUNK_OVERLAP = 500    # Overlap between chunks to maintain context


async def extract_text_from_file_content(file_content: bytes, file_name: str) -> Optional[str]:
    """Extracts text from a file content based on its extension, adapted for backend."""
    if file_name.lower().endswith('.pdf'):
        pdf_reader = PdfReader(BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:  # Ensure text is not None
                text += page_text + "\n"
        return text

    elif file_name.lower().endswith('.docx'):
        document = Document(BytesIO(file_content))
        text = ""
        for paragraph in document.paragraphs:
            text += paragraph.text + "\n"
        return text

    elif file_name.lower().endswith('.txt'):
        return file_content.decode("utf-8")

    else:
        return None


def create_intelligent_chunks(text: str, max_chunk_size: int = MAX_CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Splits text into chunks intelligently, respecting paragraph and sentence boundaries.
    
    Args:
        text: The text to chunk
        max_chunk_size: Maximum size of each chunk in characters
        overlap: Number of characters to overlap between chunks
    
    Returns:
        List of text chunks
    """
    if len(text) <= max_chunk_size:
        return [text]
    
    chunks = []
    
    # Split by paragraphs first (double newlines)
    paragraphs = text.split('\n\n')
    
    current_chunk = ""
    
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        
        # If adding this paragraph would exceed the limit
        if len(current_chunk) + len(paragraph) + 2 > max_chunk_size:
            # If current chunk has content, save it
            if current_chunk:
                chunks.append(current_chunk.strip())
                
                # Create overlap by taking last 'overlap' characters
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + "\n\n" + paragraph
            else:
                # Single paragraph is too large, split by sentences
                sentences = split_into_sentences(paragraph)
                temp_chunk = ""
                
                for sentence in sentences:
                    if len(temp_chunk) + len(sentence) + 1 > max_chunk_size:
                        if temp_chunk:
                            chunks.append(temp_chunk.strip())
                            overlap_text = temp_chunk[-overlap:] if len(temp_chunk) > overlap else temp_chunk
                            temp_chunk = overlap_text + " " + sentence
                        else:
                            # Single sentence too large, force split
                            chunks.append(sentence[:max_chunk_size])
                            temp_chunk = sentence[max_chunk_size - overlap:]
                    else:
                        temp_chunk += " " + sentence if temp_chunk else sentence
                
                current_chunk = temp_chunk
        else:
            # Add paragraph to current chunk
            current_chunk += "\n\n" + paragraph if current_chunk else paragraph
    
    # Add any remaining content
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks


def split_into_sentences(text: str) -> List[str]:
    """
    Splits text into sentences using common sentence delimiters.
    """
    import re
    
    # Simple sentence splitting (can be enhanced with nltk if needed)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]


async def summarize_chunk(chunk: str, chunk_index: int, total_chunks: int, client: Any, model: str) -> Optional[str]:
    """
    Summarizes a single chunk of text.
    
    Args:
        chunk: The text chunk to summarize
        chunk_index: Index of current chunk (0-based)
        total_chunks: Total number of chunks
        client: Groq client
        model: Model name to use
    
    Returns:
        Summary text or None if failed
    """
    if total_chunks == 1:
        context = "Summarize the following content thoroughly."
    else:
        context = f"This is part {chunk_index + 1} of {total_chunks} from a larger document. Summarize this section's key points."
    
    system_prompt = "You are a professional text summarizer. Extract and summarize the most important information."
    
    user_prompt = f"""{context}

Focus on:
- Main ideas and key concepts
- Important details and facts
- Critical information

Text to summarize:
{chunk}

Provide a clear, concise summary."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        response = call_groq(
            client,
            messages=messages,
            model=model,
            temperature=0.3
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Failed to summarize chunk {chunk_index + 1}: {e}")
        return None


async def create_final_summary(chunk_summaries: List[str], client: Any, model: str) -> Optional[str]:
    """
    Creates a final comprehensive summary from all chunk summaries.
    
    Args:
        chunk_summaries: List of summaries from each chunk
        client: Groq client
        model: Model name to use
    
    Returns:
        Final comprehensive summary
    """
    combined_summaries = "\n\n---\n\n".join(
        [f"Section {i+1}:\n{summary}" for i, summary in enumerate(chunk_summaries)]
    )
    
    system_prompt = "You are a professional text summarizer. Synthesize multiple section summaries into one comprehensive summary."
    
    user_prompt = f"""You have been given summaries of different sections from a document. 
Create a single, comprehensive summary that:

1. Captures all major themes and key points
2. Organizes information logically
3. Presents the most important details as **bolded** bullet points
4. Includes a concise paragraph overview at the end

Section Summaries:
{combined_summaries}

Provide a well-structured, comprehensive summary in professional academic language."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        response = call_groq(
            client,
            messages=messages,
            model=model,
            temperature=0.4
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Failed to create final summary: {e}")
        return None


async def summarize_text_content(text_content: str, user_id: str) -> Tuple[str, Optional[str]]:
    """
    Summarizes text using the Groq API with intelligent chunking for large documents.
    Returns a tuple of (summary_text, error_message).
    """
    
    client, error_message = get_groq_client()

    if error_message:
        return "", error_message

    # Remove excessive whitespace
    text_content = text_content.strip()
    
    if not text_content:
        return "", "The document appears to be empty."
    
    try:
        # Available models in priority order
        models = [
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768"
        ]
        
        working_model = None
        
        # Test which model is available
        for model in models:
            try:
                # Quick test call
                test_response = call_groq(
                    client,
                    messages=[{"role": "user", "content": "Hi"}],
                    model=model,
                    temperature=0.1
                )
                working_model = model
                logger.info(f"Using model: {working_model}")
                break
            except Exception as e:
                logger.warning(f"Model {model} not available: {e}")
        
        if not working_model:
            return "", "AI service is currently overloaded. Please try again."
        
        # Check if document needs chunking
        text_length = len(text_content)
        logger.info(f"Document length: {text_length} characters")
        
        if text_length <= MAX_CHUNK_SIZE:
            # Small document - summarize directly
            logger.info("Document is small enough for direct summarization")
            
            system_prompt = "You are a professional text summarizer. Summarize the following content thoroughly."
            
            user_prompt = (
                "Output the most important key points as a clear, **bolded** bulleted list, "
                "and follow it with a one-paragraph summary overview. Use professional academic language. "
                f"\n\n--- CONTENT ---\n\n{text_content}"
            )
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            response = call_groq(
                client,
                messages=messages,
                model=working_model,
                temperature=0.4
            )
            
            summary_text = response.choices[0].message.content.strip()
            return summary_text, None
        
        else:
            # Large document - use chunking strategy
            logger.info("Document requires chunking for summarization")
            
            # Create intelligent chunks
            chunks = create_intelligent_chunks(text_content)
            logger.info(f"Created {len(chunks)} chunks")
            
            # Summarize each chunk
            chunk_summaries = []
            for i, chunk in enumerate(chunks):
                logger.info(f"Summarizing chunk {i+1}/{len(chunks)} (size: {len(chunk)} chars)")
                
                chunk_summary = await summarize_chunk(
                    chunk=chunk,
                    chunk_index=i,
                    total_chunks=len(chunks),
                    client=client,
                    model=working_model
                )
                
                if chunk_summary:
                    chunk_summaries.append(chunk_summary)
                else:
                    logger.warning(f"Failed to summarize chunk {i+1}, using original text snippet")
                    # Use first 500 chars as fallback
                    chunk_summaries.append(chunk[:500] + "...")
            
            # Create final comprehensive summary from chunk summaries
            logger.info("Creating final comprehensive summary")
            
            final_summary = await create_final_summary(
                chunk_summaries=chunk_summaries,
                client=client,
                model=working_model
            )
            
            if final_summary:
                return final_summary, None
            else:
                # Fallback: return concatenated chunk summaries
                logger.warning("Failed to create final summary, returning concatenated chunk summaries")
                fallback_summary = "\n\n".join(
                    [f"**Section {i+1}:**\n{summary}" for i, summary in enumerate(chunk_summaries)]
                )
                return fallback_summary, None

    except GroqError as e:
        msg = str(e)
        if "429" in msg:
            logger.warning(f"Groq API rate limit exceeded during summarization: {e}")
            return "", "AI is currently experiencing high traffic. Please try again shortly."
        logger.error(f"Groq API error during summarization: {msg}", exc_info=True)
        return "", "AI service error. Please try again."
    except Exception as e:
        logger.error(f"An unexpected error occurred during summarization: {e}", exc_info=True)
        return "", "An unexpected error occurred while generating the summary."