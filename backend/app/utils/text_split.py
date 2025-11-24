from typing import List


def simple_chunk_text(text: str, max_chunk_size: int = 1000) -> List[str]:
    """
    Simple text chunking utility (fallback if LLM chunking fails).
    
    Splits text into chunks at paragraph boundaries when possible.
    
    Args:
        text: Input text to chunk
        max_chunk_size: Maximum size per chunk
        
    Returns:
        List of text chunks
    """
    if len(text) <= max_chunk_size:
        return [text]
    
    chunks = []
    paragraphs = text.split('\n\n')
    current_chunk = ""
    
    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 <= max_chunk_size:
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = para
            
            # If single paragraph is too large, split it
            if len(current_chunk) > max_chunk_size:
                sentences = current_chunk.split('. ')
                current_chunk = ""
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 2 <= max_chunk_size:
                        if current_chunk:
                            current_chunk += ". " + sentence
                        else:
                            current_chunk = sentence
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = sentence
    
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

