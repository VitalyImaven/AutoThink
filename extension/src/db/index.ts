/**
 * IndexedDB helper for local knowledge base storage
 * DYNAMIC SYSTEM - stores semantic chunks with AI-discovered tags
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Dynamic chunk structure (no fixed categories!)
interface SemanticChunk {
  id: string;
  source_file: string;
  body: string;
  semantic_tags: string[];
  related_topics: string[];
  metadata: Record<string, any>;
}

interface KnowledgeDB extends DBSchema {
  semantic_chunks: {
    key: string;
    value: SemanticChunk;
    indexes: {
      'by-source': string;
    };
  };
  documents: {
    key: string;
    value: {
      document_id: string;
      source_file: string;
      uploaded_at: string;
      discovered_topics: any[];
      all_tags: string[];
      chunk_count: number;
    };
  };
  interviews: {
    key: string;  // profile name
    value: {
      profile: string;
      created_at: string;
      updated_at: string;
      conversation: Array<{role: string, content: string, timestamp: string}>;
      qa_count: number;
    };
  };
}

let dbInstance: IDBPDatabase<KnowledgeDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<KnowledgeDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<KnowledgeDB>('ai-autofill-dynamic-kb', 4, {
    upgrade(db, oldVersion) {
      console.log(`Upgrading IndexedDB from version ${oldVersion} to 4`);
      
      // Create semantic_chunks store
      if (!db.objectStoreNames.contains('semantic_chunks')) {
        const chunksStore = db.createObjectStore('semantic_chunks', {
          keyPath: 'id',
        });
        chunksStore.createIndex('by-source', 'source_file', { unique: false });
      }
      
      // Create documents store
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', {
          keyPath: 'document_id',
        });
      }
      
      // Create interviews store (v3+)
      if (!db.objectStoreNames.contains('interviews')) {
        db.createObjectStore('interviews', {
          keyPath: 'profile',
        });
        console.log('Created interviews store');
      }
    },
  });

  return dbInstance;
}

// Save document index from backend response
export async function saveDocumentIndex(docIndex: any): Promise<void> {
  const db = await initDB();
  
  // Save document metadata
  await db.put('documents', {
    document_id: docIndex.document_id,
    source_file: docIndex.source_file,
    uploaded_at: docIndex.uploaded_at || new Date().toISOString(),
    discovered_topics: docIndex.discovered_topics || [],
    all_tags: docIndex.all_tags || [],
    chunk_count: docIndex.chunk_count || 0,
  });
  
  // Save all chunks
  const tx = db.transaction('semantic_chunks', 'readwrite');
  await Promise.all([
    ...docIndex.chunks.map((chunk: any) => tx.store.put(chunk)),
    tx.done,
  ]);
  
  console.log(`✅ Saved ${docIndex.chunks.length} chunks to IndexedDB`);
}

export async function getAllChunks(): Promise<SemanticChunk[]> {
  const db = await initDB();
  return db.getAll('semantic_chunks');
}

export async function getAllDocuments(): Promise<any[]> {
  const db = await initDB();
  return db.getAll('documents');
}

export async function clearAllChunks(): Promise<void> {
  const db = await initDB();
  const tx = db.transaction(['semantic_chunks', 'documents'], 'readwrite');
  await Promise.all([
    tx.objectStore('semantic_chunks').clear(),
    tx.objectStore('documents').clear(),
    tx.done,
  ]);
  console.log('✅ Cleared all local data');
}

export async function getChunkCount(): Promise<number> {
  const db = await initDB();
  return db.count('semantic_chunks');
}

export async function getDocumentCount(): Promise<number> {
  const db = await initDB();
  return db.count('documents');
}

export async function getAllTags(): Promise<string[]> {
  const db = await initDB();
  const documents = await db.getAll('documents');
  const allTags = new Set<string>();
  
  documents.forEach(doc => {
    doc.all_tags.forEach((tag: string) => allTags.add(tag));
  });
  
  return Array.from(allTags).sort();
}

// Delete a specific document and its chunks
export async function deleteDocument(documentId: string, sourceFile: string): Promise<void> {
  const db = await initDB();
  
  // Delete the document
  await db.delete('documents', documentId);
  
  // Delete all chunks from this source file
  const allChunks = await db.getAllFromIndex('semantic_chunks', 'by-source', sourceFile);
  const tx = db.transaction('semantic_chunks', 'readwrite');
  
  await Promise.all([
    ...allChunks.map(chunk => tx.store.delete(chunk.id)),
    tx.done
  ]);
  
  console.log(`✅ Deleted document ${sourceFile} and ${allChunks.length} associated chunks`);
}

// Interview storage functions
export async function saveInterview(profile: string, conversation: Array<{role: string, content: string}>): Promise<void> {
  const db = await initDB();
  
  // Check if interview exists
  const existing = await db.get('interviews', profile);
  
  const now = new Date().toISOString();
  const qaCount = Math.floor(conversation.filter(m => m.role !== 'typing').length / 2);
  
  if (existing) {
    // Append new messages
    await db.put('interviews', {
      profile,
      created_at: existing.created_at,
      updated_at: now,
      conversation: [
        ...existing.conversation,
        ...conversation.map(m => ({
          ...m,
          timestamp: now
        }))
      ],
      qa_count: existing.qa_count + qaCount
    });
    console.log(`✅ Appended ${qaCount} Q&A pairs to ${profile} interview`);
  } else {
    // Create new
    await db.put('interviews', {
      profile,
      created_at: now,
      updated_at: now,
      conversation: conversation.map(m => ({
        ...m,
        timestamp: now
      })),
      qa_count: qaCount
    });
    console.log(`✅ Created new interview for ${profile} with ${qaCount} Q&A pairs`);
  }
}

export async function getInterview(profile: string): Promise<any | null> {
  const db = await initDB();
  return db.get('interviews', profile);
}

export async function getAllInterviews(): Promise<any[]> {
  const db = await initDB();
  return db.getAll('interviews');
}

export async function exportInterviewAsText(profile: string): Promise<string> {
  const db = await initDB();
  const interview = await db.get('interviews', profile);
  
  if (!interview) {
    throw new Error(`No interview found for profile: ${profile}`);
  }
  
  // Format as text
  let text = `PROFILE: ${profile.replace('-', ' ').toUpperCase()}\n`;
  text += `Created: ${new Date(interview.created_at).toLocaleString()}\n`;
  text += `Last Updated: ${new Date(interview.updated_at).toLocaleString()}\n`;
  text += `Total Q&A Pairs: ${interview.qa_count}\n`;
  text += '='.repeat(70) + '\n\n';
  
  // Add Q&A pairs
  for (let i = 0; i < interview.conversation.length; i += 2) {
    if (i + 1 < interview.conversation.length) {
      const q = interview.conversation[i];
      const a = interview.conversation[i + 1];
      text += `Q: ${q.content}\n`;
      text += `A: ${a.content}\n\n`;
    }
  }
  
  text += '\n' + '-'.repeat(70) + '\n';
  text += `Generated by AI Smart Autofill Extension\n`;
  text += `${new Date().toLocaleString()}\n`;
  
  return text;
}

