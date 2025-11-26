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
}

let dbInstance: IDBPDatabase<KnowledgeDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<KnowledgeDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<KnowledgeDB>('ai-autofill-dynamic-kb', 2, {
    upgrade(db) {
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

