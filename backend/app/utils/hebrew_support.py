"""
Hebrew text support utilities
"""

def ensure_utf8(text: str) -> str:
    """
    Ensure text is properly UTF-8 encoded
    Handles Hebrew and other Unicode characters
    """
    if isinstance(text, bytes):
        try:
            return text.decode('utf-8')
        except UnicodeDecodeError:
            # Try other encodings
            try:
                return text.decode('windows-1255')  # Hebrew Windows encoding
            except:
                return text.decode('iso-8859-8')  # Hebrew ISO encoding
    return text


def clean_rtl_text(text: str) -> str:
    """
    Clean Right-to-Left text (Hebrew, Arabic, etc.)
    Remove RTL/LTR marks that might confuse processing
    """
    # Remove Unicode directional marks
    rtl_marks = [
        '\u200E',  # Left-to-right mark
        '\u200F',  # Right-to-left mark
        '\u202A',  # Left-to-right embedding
        '\u202B',  # Right-to-left embedding
        '\u202C',  # Pop directional formatting
        '\u202D',  # Left-to-right override
        '\u202E',  # Right-to-left override
    ]
    
    for mark in rtl_marks:
        text = text.replace(mark, '')
    
    return text


def normalize_hebrew_text(text: str) -> str:
    """
    Normalize Hebrew text for better processing
    """
    text = ensure_utf8(text)
    text = clean_rtl_text(text)
    
    # Normalize whitespace
    text = ' '.join(text.split())
    
    return text

