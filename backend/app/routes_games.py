"""
IQ Arena AI-Powered Games Routes
Provides AI-generated content for trivia, fact/fiction, and word association games.
Uses the same OpenAI implementation as the working chat routes.
"""

import json
import random
import traceback
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.config import settings

router = APIRouter(prefix="/games", tags=["IQ Arena Games"])
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Use the more powerful/reliable model for games (same as ingest)
GAMES_MODEL = getattr(settings, 'OPENAI_INGEST_MODEL', settings.OPENAI_MODEL)


# Request/Response Models
class TriviaRequest(BaseModel):
    difficulty: str = "medium"  # easy, medium, hard
    category: Optional[str] = None  # science, history, tech, etc.
    count: int = 5


class TriviaQuestion(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    category: str
    explanation: str


class TriviaResponse(BaseModel):
    questions: List[TriviaQuestion]


class FactOrFictionRequest(BaseModel):
    difficulty: str = "medium"
    count: int = 5


class FactOrFictionStatement(BaseModel):
    statement: str
    is_fact: bool
    explanation: str
    category: str


class FactOrFictionResponse(BaseModel):
    statements: List[FactOrFictionStatement]


class WordAssociationJudgeRequest(BaseModel):
    target_word: str
    user_word: str
    category: str  # synonym, antonym, related, rhyme


class WordAssociationJudgeResponse(BaseModel):
    is_valid: bool
    score: int  # 0-100 based on quality of association
    explanation: str
    better_examples: List[str]


class WordChainRequest(BaseModel):
    difficulty: str = "medium"


class WordChainResponse(BaseModel):
    starting_word: str
    target_category: str
    hint: str


class RiddleRequest(BaseModel):
    difficulty: str = "medium"
    count: int = 5


class Riddle(BaseModel):
    riddle: str
    answer: str
    hint: Optional[str] = None
    category: str


class RiddleResponse(BaseModel):
    riddles: List[Riddle]


def parse_json_response(content: str) -> any:
    """Clean and parse JSON from AI response."""
    # Remove markdown code blocks
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()
    return json.loads(content)


async def call_openai_with_retry(messages: list, max_tokens: int = 4000, max_retries: int = 3):
    """Call OpenAI with retry logic for empty responses."""
    
    for attempt in range(max_retries):
        print(f"   Attempt {attempt + 1}/{max_retries}...")
        
        response = await client.chat.completions.create(
            model=GAMES_MODEL,
            messages=messages,
            max_completion_tokens=max_tokens
        )
        
        print(f"   Full response object: {response}")
        
        if response and response.choices and response.choices[0].message.content:
            content = response.choices[0].message.content
            print(f"   ✅ Got content: {len(content)} chars")
            return content
        
        print(f"   ⚠️ Empty response on attempt {attempt + 1}, retrying...")
    
    raise Exception("Failed to get response after multiple retries")


# Trivia endpoint
@router.post("/trivia", response_model=TriviaResponse)
async def generate_trivia(request: TriviaRequest):
    """Generate AI-powered trivia questions."""
    
    print(f"\n{'='*60}")
    print(f"🧪 TRIVIA REQUEST")
    print(f"{'='*60}")
    print(f"Difficulty: {request.difficulty}")
    print(f"Category: {request.category or 'random'}")
    print(f"Count: {request.count}")
    print(f"Model: {GAMES_MODEL}")
    
    categories = ["science", "history", "technology", "geography", "literature", "nature", "space", "mathematics"]
    selected_category = request.category or random.choice(categories)
    
    difficulty_hints = {
        "easy": "suitable for general knowledge, straightforward questions",
        "medium": "requires some specific knowledge, moderately challenging",
        "hard": "expert-level, obscure facts, tricky questions"
    }
    
    prompt = f"""Generate exactly {request.count} trivia questions about {selected_category}.
Difficulty level: {request.difficulty} ({difficulty_hints.get(request.difficulty, "medium difficulty")})

Requirements:
- Each question should have exactly 4 possible answers
- Only one answer should be correct
- Questions should be interesting and educational
- Include a brief explanation for the correct answer

IMPORTANT: Return ONLY a valid JSON array, no markdown, no explanation, just the JSON.

Format:
[
  {{
    "question": "What is...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Option A",
    "category": "{selected_category}",
    "explanation": "Brief explanation..."
  }}
]"""

    try:
        print(f"📤 Sending request to OpenAI...")
        
        messages = [
            {
                "role": "system", 
                "content": "You are a trivia question generator. You MUST respond with ONLY a valid JSON array containing trivia questions. No other text, no markdown code blocks, just pure JSON array."
            },
            {"role": "user", "content": prompt}
        ]
        
        content = await call_openai_with_retry(messages, max_tokens=4000)
        
        print(f"Response content: {content[:500]}...")
        
        questions_data = parse_json_response(content)
        
        questions = [
            TriviaQuestion(
                question=q["question"],
                options=q["options"],
                correct_answer=q["correct_answer"],
                category=q.get("category", selected_category),
                explanation=q.get("explanation", "")
            )
            for q in questions_data
        ]
        
        print(f"✅ Generated {len(questions)} trivia questions")
        return TriviaResponse(questions=questions)
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ UNEXPECTED Error: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating trivia: {str(e)}")


# Fact or Fiction endpoint
@router.post("/fact-or-fiction", response_model=FactOrFictionResponse)
async def generate_fact_or_fiction(request: FactOrFictionRequest):
    """Generate AI-powered fact or fiction statements."""
    
    print(f"\n{'='*60}")
    print(f"❓ FACT OR FICTION REQUEST")
    print(f"{'='*60}")
    print(f"Difficulty: {request.difficulty}")
    print(f"Count: {request.count}")
    print(f"Model: {GAMES_MODEL}")
    
    prompt = f"""Generate exactly {request.count} statements for a "Fact or Fiction" game.
Difficulty: {request.difficulty}

Requirements:
- Mix of true facts (surprising but real) and fictional statements (believable but false)
- About 50/50 split between facts and fiction
- Statements should be interesting and not too obvious
- Cover various topics: science, history, nature, technology, geography
- Include explanations

IMPORTANT: Return ONLY a valid JSON array, no markdown, no explanation, just the JSON.

Format:
[
  {{
    "statement": "The statement to evaluate...",
    "is_fact": true,
    "explanation": "Why this is true/false...",
    "category": "science"
  }}
]"""

    try:
        print(f"📤 Sending request to OpenAI...")
        
        messages = [
            {
                "role": "system", 
                "content": "You are a fact/fiction game creator. You MUST respond with ONLY a valid JSON array containing statements. No other text, no markdown code blocks, just pure JSON array."
            },
            {"role": "user", "content": prompt}
        ]
        
        content = await call_openai_with_retry(messages, max_tokens=4000)
        
        print(f"Response content: {content[:500]}...")
        
        statements_data = parse_json_response(content)
        
        statements = [
            FactOrFictionStatement(
                statement=s["statement"],
                is_fact=s["is_fact"],
                explanation=s.get("explanation", ""),
                category=s.get("category", "general")
            )
            for s in statements_data
        ]
        
        print(f"✅ Generated {len(statements)} statements")
        return FactOrFictionResponse(statements=statements)
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ UNEXPECTED Error: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating statements: {str(e)}")


# Word Association Judge endpoint
@router.post("/word-association/judge", response_model=WordAssociationJudgeResponse)
async def judge_word_association(request: WordAssociationJudgeRequest):
    """Judge a word association response using AI."""
    
    print(f"\n{'='*60}")
    print(f"💭 WORD ASSOCIATION JUDGE REQUEST")
    print(f"{'='*60}")
    print(f"Target word: {request.target_word}")
    print(f"User word: {request.user_word}")
    print(f"Category: {request.category}")
    print(f"Model: {GAMES_MODEL}")
    
    category_desc = {
        "synonym": "words with similar meaning",
        "antonym": "words with opposite meaning",
        "related": "words that are conceptually related",
        "rhyme": "words that rhyme"
    }
    
    prompt = f"""Judge this word association:
Target word: "{request.target_word}"
User's answer: "{request.user_word}"
Category: {request.category} ({category_desc.get(request.category, request.category)})

Evaluate if the user's answer is valid for this category.

IMPORTANT: Return ONLY a valid JSON object, no markdown, no explanation, just the JSON.

Format:
{{
  "is_valid": true,
  "score": 75,
  "explanation": "Brief explanation of your judgment",
  "better_examples": ["example1", "example2", "example3"]
}}"""

    try:
        print(f"📤 Sending request to OpenAI...")
        
        messages = [
            {
                "role": "system", 
                "content": "You are a linguistics expert judging word associations. You MUST respond with ONLY a valid JSON object. No other text, no markdown code blocks, just pure JSON object."
            },
            {"role": "user", "content": prompt}
        ]
        
        content = await call_openai_with_retry(messages, max_tokens=1000)
        
        print(f"Response content: {content[:500]}...")
        
        result = parse_json_response(content)
        
        print(f"✅ Judged association: valid={result.get('is_valid')}, score={result.get('score')}")
        
        return WordAssociationJudgeResponse(
            is_valid=result["is_valid"],
            score=result.get("score", 50 if result["is_valid"] else 0),
            explanation=result.get("explanation", ""),
            better_examples=result.get("better_examples", [])
        )
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ UNEXPECTED Error: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error judging association: {str(e)}")


# Word chain starter (no AI needed)
@router.post("/word-association/start", response_model=WordChainResponse)
async def start_word_chain(request: WordChainRequest):
    """Get a starting word and category for word association game."""
    
    print(f"\n{'='*60}")
    print(f"🔤 WORD ASSOCIATION START REQUEST")
    print(f"{'='*60}")
    print(f"Difficulty: {request.difficulty}")
    
    categories = ["synonym", "antonym", "related"]
    words_by_difficulty = {
        "easy": ["happy", "big", "fast", "cold", "light", "good", "smart", "quiet", "strong", "clean"],
        "medium": ["elegant", "complex", "vibrant", "ancient", "peculiar", "abundant", "fragile", "serene", "hostile", "obscure"],
        "hard": ["ephemeral", "ubiquitous", "ameliorate", "perspicacious", "surreptitious", "magnanimous", "idiosyncratic", "recalcitrant"]
    }
    
    difficulty = request.difficulty
    word_list = words_by_difficulty.get(difficulty, words_by_difficulty["medium"])
    starting_word = random.choice(word_list)
    category = random.choice(categories)
    
    hints = {
        "synonym": f"Find a word that means the same as '{starting_word}'",
        "antonym": f"Find a word that means the opposite of '{starting_word}'",
        "related": f"Find a word related to '{starting_word}'"
    }
    
    print(f"✅ Starting word: {starting_word}, Category: {category}")
    
    return WordChainResponse(
        starting_word=starting_word,
        target_category=category,
        hint=hints.get(category, "Find an associated word")
    )


# AI Riddles endpoint
@router.post("/riddles", response_model=RiddleResponse)
async def generate_riddles(request: RiddleRequest):
    """Generate AI-powered riddles."""
    
    print(f"\n{'='*60}")
    print(f"🎭 RIDDLES REQUEST")
    print(f"{'='*60}")
    print(f"Difficulty: {request.difficulty}")
    print(f"Count: {request.count}")
    print(f"Model: {GAMES_MODEL}")
    
    difficulty_hints = {
        "easy": "simple and straightforward riddles for beginners",
        "medium": "classic riddles that require some thinking",
        "hard": "complex riddles with tricky wordplay or lateral thinking"
    }
    
    prompt = f"""Generate exactly {request.count} unique riddles.
Difficulty level: {request.difficulty} ({difficulty_hints.get(request.difficulty, "medium difficulty")})

Requirements:
- Each riddle should be clever and engaging
- Answers should be single words or short phrases
- Include a variety of riddle types (wordplay, logic, lateral thinking)
- Riddles should be original or classic but not too well-known
- Cover various categories: nature, objects, concepts, wordplay

IMPORTANT: Return ONLY a valid JSON array, no markdown, no explanation, just the JSON.

Format:
[
  {{
    "riddle": "The riddle text...",
    "answer": "ANSWER",
    "hint": "Optional hint",
    "category": "wordplay"
  }}
]"""

    try:
        print(f"📤 Sending request to OpenAI...")
        
        messages = [
            {
                "role": "system", 
                "content": "You are a riddle master. You MUST respond with ONLY a valid JSON array containing riddles. No other text, no markdown code blocks, just pure JSON array."
            },
            {"role": "user", "content": prompt}
        ]
        
        content = await call_openai_with_retry(messages, max_tokens=4000)
        
        print(f"Response content: {content[:500]}...")
        
        riddles_data = parse_json_response(content)
        
        riddles = [
            Riddle(
                riddle=r["riddle"],
                answer=r["answer"].upper(),
                hint=r.get("hint"),
                category=r.get("category", "general")
            )
            for r in riddles_data
        ]
        
        print(f"✅ Generated {len(riddles)} riddles")
        return RiddleResponse(riddles=riddles)
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON Parse Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ UNEXPECTED Error: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating riddles: {str(e)}")
