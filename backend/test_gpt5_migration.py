#!/usr/bin/env python3
"""
Test script for GPT-5 migration
Tests all three main functions to verify GPT-5 integration
"""

import asyncio
import sys
from app.openai_client import call_llm_ingest, call_llm_classify, call_llm_suggest
from app.models import FieldContext, ClassificationResult, SuggestionRequest, KnowledgeChunk
from app.config import settings


async def test_ingestion():
    """Test document ingestion with GPT-5"""
    print("\n" + "="*60)
    print("TEST 1: Document Ingestion")
    print("="*60)
    
    test_text = """
    My name is Alice Johnson. I am 28 years old and I'm from Canada.
    
    Contact Information:
    Email: alice.johnson@example.com
    Phone: +1-555-0123
    
    Professional Background:
    I'm a software engineer with 5 years of experience in AI and machine learning.
    I specialize in building intelligent systems using Python and TensorFlow.
    """
    
    try:
        print(f"\n📄 Testing with model: {settings.OPENAI_MODEL}")
        print(f"   Verbosity: {settings.OPENAI_VERBOSITY}")
        print(f"   Reasoning Effort: {settings.OPENAI_REASONING_EFFORT}")
        print("\nProcessing document...")
        
        chunks = await call_llm_ingest(test_text, "test-profile.txt")
        
        print(f"\n✅ SUCCESS: Extracted {len(chunks)} chunks")
        for i, chunk in enumerate(chunks, 1):
            print(f"\n  Chunk {i}:")
            print(f"    Category: {chunk.meta.category}")
            print(f"    Section: {chunk.meta.section or 'N/A'}")
            print(f"    Tags: {', '.join(chunk.meta.tags) if chunk.meta.tags else 'None'}")
            print(f"    Priority: {chunk.meta.priority}")
            print(f"    Body preview: {chunk.body[:100]}...")
        
        return True
    except Exception as e:
        print(f"\n❌ FAILED: {str(e)}")
        return False


async def test_classification():
    """Test field classification with GPT-5"""
    print("\n" + "="*60)
    print("TEST 2: Field Classification")
    print("="*60)
    
    test_fields = [
        FieldContext(
            field_id="test-1",
            label_text="Full Name",
            placeholder="Enter your name",
            name_attr="full_name",
            id_attr="name",
            nearby_text=None,
            max_length=100
        ),
        FieldContext(
            field_id="test-2",
            label_text="Company Description",
            placeholder="Briefly describe your company",
            name_attr="company_desc",
            id_attr="desc",
            nearby_text="Tell us about your startup in 1-2 sentences",
            max_length=200
        ),
        FieldContext(
            field_id="test-3",
            label_text="Email Address",
            placeholder="your@email.com",
            name_attr="email",
            id_attr="email_field",
            nearby_text=None,
            max_length=None
        )
    ]
    
    try:
        print(f"\n📋 Testing with model: {settings.OPENAI_MODEL}")
        print(f"   Testing {len(test_fields)} different field types...\n")
        
        all_passed = True
        for i, field in enumerate(test_fields, 1):
            print(f"  Field {i}: '{field.label_text}'")
            result = await call_llm_classify(field)
            print(f"    ✓ Category: {result.category}")
            print(f"    ✓ Confidence: {result.confidence:.2f}")
            print(f"    ✓ Tone: {result.tone}")
            print()
        
        print("✅ SUCCESS: All fields classified")
        return True
    except Exception as e:
        print(f"\n❌ FAILED: {str(e)}")
        return False


async def test_suggestion():
    """Test suggestion generation with GPT-5"""
    print("\n" + "="*60)
    print("TEST 3: Suggestion Generation")
    print("="*60)
    
    # Create mock field context
    field = FieldContext(
        field_id="test-suggest",
        label_text="Tell us about yourself",
        placeholder="Your professional background",
        name_attr="bio",
        id_attr="bio_field",
        nearby_text=None,
        max_length=500
    )
    
    # Create mock classification
    classification = ClassificationResult(
        category="personal_basic",
        max_length=500,
        tone="professional",
        confidence=0.95
    )
    
    # Create mock knowledge chunks
    from app.models import KnowledgeChunkMeta
    chunks = [
        KnowledgeChunk(
            meta=KnowledgeChunkMeta(
                id="test-chunk-1",
                source_file="test.txt",
                section="About Me",
                category="personal_basic",
                language="en",
                length_hint="medium",
                tags=["professional", "background"],
                priority=0.9
            ),
            body="I'm Alice Johnson, a 28-year-old software engineer from Canada with 5 years of experience in AI and machine learning. I specialize in building intelligent systems using Python and TensorFlow."
        )
    ]
    
    request = SuggestionRequest(
        field=field,
        classification=classification,
        chunks=chunks
    )
    
    try:
        print(f"\n💡 Testing with model: {settings.OPENAI_MODEL}")
        print(f"   Field: '{field.label_text}'")
        print(f"   Category: {classification.category}")
        print("\nGenerating suggestion...")
        
        result = await call_llm_suggest(request)
        
        print(f"\n✅ SUCCESS: Generated suggestion")
        print(f"\n📝 Suggestion text:")
        print(f"   {result.suggestion_text}")
        
        return True
    except Exception as e:
        print(f"\n❌ FAILED: {str(e)}")
        return False


async def main():
    """Run all tests"""
    print("\n🚀 GPT-5 Migration Test Suite")
    print(f"📦 Model: {settings.OPENAI_MODEL}")
    print(f"🔧 Settings:")
    print(f"   - Verbosity: {settings.OPENAI_VERBOSITY}")
    print(f"   - Reasoning Effort: {settings.OPENAI_REASONING_EFFORT}")
    
    results = {
        "Ingestion": await test_ingestion(),
        "Classification": await test_classification(),
        "Suggestion": await test_suggestion()
    }
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {test_name}: {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 All tests passed! GPT-5 integration is working correctly.")
        print("\n💡 Next steps:")
        print("   1. Update your .env file with GPT-5 settings")
        print("   2. Restart the backend: python -m app.main")
        print("   3. Test with the extension")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please check the errors above.")
        print("\n🔍 Troubleshooting:")
        print("   1. Verify OPENAI_API_KEY is set correctly")
        print("   2. Check you have access to GPT-5 API")
        print("   3. Ensure openai package is >= 1.54.0")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

