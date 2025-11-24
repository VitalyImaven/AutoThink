/**
 * IndexedDB helper for local knowledge base storage
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { KnowledgeChunk, KnowledgeCategory } from '../types';

interface KnowledgeDB extends DBSchema {
  knowledge_chunks: {
    key: string;
    value: KnowledgeChunk;
    indexes: {
      'by-category': KnowledgeCategory;
      'by-source': string;
    };
  };
}

let dbInstance: IDBPDatabase<KnowledgeDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<KnowledgeDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<KnowledgeDB>('ai-autofill-kb', 1, {
    upgrade(db) {
      const store = db.createObjectStore('knowledge_chunks', {
        keyPath: 'meta.id',
      });
      
      store.createIndex('by-category', 'meta.category', { unique: false });
      store.createIndex('by-source', 'meta.source_file', { unique: false });
    },
  });

  return dbInstance;
}

export async function saveChunks(chunks: KnowledgeChunk[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('knowledge_chunks', 'readwrite');
  
  await Promise.all([
    ...chunks.map(chunk => tx.store.put(chunk)),
    tx.done,
  ]);
}

export async function getChunksByCategory(
  category: KnowledgeCategory
): Promise<KnowledgeChunk[]> {
  const db = await initDB();
  return db.getAllFromIndex('knowledge_chunks', 'by-category', category);
}

export async function getAllChunks(): Promise<KnowledgeChunk[]> {
  const db = await initDB();
  return db.getAll('knowledge_chunks');
}

export async function clearAllChunks(): Promise<void> {
  const db = await initDB();
  await db.clear('knowledge_chunks');
}

export async function getChunkCount(): Promise<number> {
  const db = await initDB();
  return db.count('knowledge_chunks');
}

