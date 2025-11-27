"""
Interactive Interview System for Knowledge Gathering
Includes voice input via OpenAI Whisper and file export
"""

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from openai import AsyncOpenAI
from app.config import settings
import tempfile
import os
from datetime import datetime
from pathlib import Path

router = APIRouter()
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Directory for storing interview files
INTERVIEW_DATA_DIR = Path("interview_data")
INTERVIEW_DATA_DIR.mkdir(exist_ok=True)


class InterviewMessage(BaseModel):
    role: str
    content: str


class InterviewChatRequest(BaseModel):
    profile: str  # 'me', 'spouse', 'jan', etc.
    message: str
    conversation_history: List[InterviewMessage] = []


class InterviewChatResponse(BaseModel):
    response: str
    next_question: Optional[str] = None


class SaveInterviewRequest(BaseModel):
    profile: str
    conversation: List[InterviewMessage]


@router.post("/interview/chat", response_model=InterviewChatResponse)
async def interview_chat(request: InterviewChatRequest):
    """
    Handle interview conversation with intelligent question generation
    """
    try:
        print(f"\n🎙️ INTERVIEW CHAT")
        print(f"   Profile: {request.profile}")
        print(f"   Message: {request.message}")
        print(f"   History: {len(request.conversation_history)} messages")
        
        # Build system prompt for interview
        profile_display = request.profile.replace('-', ' ').title()
        
        system_prompt = f"""You are conducting an interactive interview to gather comprehensive information.

PROFILE: {profile_display}
- Gathering detailed information about this person for form auto-fill purposes

YOUR JOB:
1. Ask ONE clear, specific question at a time
2. Acknowledge their answer briefly (1 sentence)
3. Ask the next relevant question
4. Cover ALL these areas thoroughly:
   - Personal basics (full name, date of birth, address, contact info)
   - Professional (job title, company, experience, skills, education)
   - Family (marital status, children, emergency contacts)
   - Financial (income, employment details, bank info if relevant)
   - Health (insurance, medical conditions, medications if relevant)
   - Preferences and interests
   - Any other relevant details for form filling

STYLE:
- Be conversational and friendly, not robotic
- Ask follow-up questions based on answers
- Gather as much specific detail as possible
- Keep responses concise (2-3 sentences max)

RESPONSE FORMAT:
[Brief acknowledgment]. [Next question]?

EXAMPLE:
User: "I'm a software engineer"
You: "Great! What company do you work for, and what's your exact job title?"

Continue the interview naturally and comprehensively."""

        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Add conversation history
        for msg in request.conversation_history[-20:]:  # Last 20 messages
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add current message
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Get AI response - GPT-5 compatible (no temperature!)
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            max_completion_tokens=2000  # GPT-5 needs high limit (reasoning + content)
        )
        
        response_text = response.choices[0].message.content
        
        if not response_text:
            raise HTTPException(status_code=500, detail="No response from AI")
        
        print(f"   ✅ Response: {response_text[:100]}...")
        
        return InterviewChatResponse(
            response=response_text.strip()
        )
    
    except Exception as e:
        print(f"❌ Interview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interview/save")
async def save_interview(request: SaveInterviewRequest):
    """
    Save interview conversation to a text file (one file per profile)
    File can be appended to over time
    """
    try:
        print(f"\n💾 SAVING INTERVIEW DATA")
        print(f"   Profile: {request.profile}")
        print(f"   Messages: {len(request.conversation)} exchanges")
        
        # Create filename from profile name
        safe_profile = request.profile.replace(' ', '_').lower()
        filename = f"{safe_profile}_profile.txt"
        filepath = INTERVIEW_DATA_DIR / filename
        
        # Check if file exists (append mode)
        file_exists = filepath.exists()
        mode = 'a' if file_exists else 'w'
        
        with open(filepath, mode, encoding='utf-8') as f:
            if not file_exists:
                # New file - add header
                f.write(f"PROFILE: {request.profile.replace('-', ' ').title()}\n")
                f.write(f"Created: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("=" * 70 + "\n\n")
            else:
                # Appending - add separator
                f.write(f"\n\n{'='*70}\n")
                f.write(f"Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("=" * 70 + "\n\n")
            
            # Extract Q&A pairs
            for i in range(0, len(request.conversation), 2):
                if i + 1 < len(request.conversation):
                    question = request.conversation[i]
                    answer = request.conversation[i + 1]
                    
                    f.write(f"Q: {question.content}\n")
                    f.write(f"A: {answer.content}\n\n")
            
            f.write("\n" + "-" * 70 + "\n")
        
        print(f"   ✅ Saved to: {filepath}")
        print(f"   Mode: {'Appended to existing file' if file_exists else 'Created new file'}")
        
        return {
            "success": True,
            "filename": filename,
            "filepath": str(filepath.absolute()),
            "mode": "appended" if file_exists else "created",
            "total_qa_pairs": len(request.conversation) // 2
        }
    
    except Exception as e:
        print(f"❌ Save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interview/export/{profile}")
async def export_interview(profile: str):
    """
    Download the interview file for a specific profile
    """
    try:
        safe_profile = profile.replace(' ', '_').lower()
        filename = f"{safe_profile}_profile.txt"
        filepath = INTERVIEW_DATA_DIR / filename
        
        if not filepath.exists():
            raise HTTPException(status_code=404, detail=f"No interview data found for profile: {profile}")
        
        return FileResponse(
            path=str(filepath),
            filename=filename,
            media_type='text/plain'
        )
    
    except Exception as e:
        print(f"❌ Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interview/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe audio using OpenAI Whisper
    """
    try:
        print(f"\n🎤 WHISPER TRANSCRIPTION")
        print(f"   File: {audio.filename}")
        print(f"   Type: {audio.content_type}")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio.filename or 'audio.webm')[1]) as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Transcribe using Whisper
            with open(temp_file_path, 'rb') as audio_file:
                transcript = await client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="en"  # Can be auto-detected or specified
                )
            
            print(f"   ✅ Transcribed: {transcript.text[:100]}...")
            
            return {
                "text": transcript.text
            }
        
        finally:
            # Clean up temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
    
    except Exception as e:
        print(f"❌ Whisper error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
