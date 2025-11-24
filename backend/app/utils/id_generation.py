import hashlib


def generate_stable_chunk_id(source_file: str, section: str, body_preview: str) -> str:
    """
    Generate a stable, deterministic ID for a knowledge chunk.
    
    Args:
        source_file: Name of the source file
        section: Section title or heading (use empty string if none)
        body_preview: First ~50 characters of the chunk body
        
    Returns:
        A stable hex string ID
    """
    # Normalize inputs
    section = section or ""
    body_preview = body_preview[:50] if body_preview else ""
    
    # Create composite string
    composite = f"{source_file}||{section}||{body_preview}"
    
    # Generate SHA-256 hash
    hash_obj = hashlib.sha256(composite.encode('utf-8'))
    
    return hash_obj.hexdigest()[:16]  # Use first 16 characters for brevity

