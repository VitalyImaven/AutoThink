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

// Web Memory - saved visited pages
export interface VisitedPage {
  id: string;           // URL hash as ID
  url: string;
  title: string;
  domain: string;
  content: string;      // Page text content (first 10000 chars)
  headings: string[];   // H1, H2, H3 headings
  description: string;  // Meta description
  keywords: string[];   // Extracted keywords/topics
  visited_at: string;   // ISO timestamp
  visit_count: number;  // How many times visited
  last_visited: string; // Last visit timestamp
  thumbnail?: string;   // Optional: favicon or screenshot
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
  visited_pages: {
    key: string;  // URL hash
    value: VisitedPage;
    indexes: {
      'by-domain': string;
      'by-visited': string;
    };
  };
}

let dbInstance: IDBPDatabase<KnowledgeDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<KnowledgeDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<KnowledgeDB>('ai-autofill-dynamic-kb', 5, {
    upgrade(db, oldVersion) {
      console.log(`Upgrading IndexedDB from version ${oldVersion} to 5`);
      
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
      
      // Create visited_pages store for Web Memory feature (v5+)
      if (!db.objectStoreNames.contains('visited_pages')) {
        const pagesStore = db.createObjectStore('visited_pages', {
          keyPath: 'id',
        });
        pagesStore.createIndex('by-domain', 'domain', { unique: false });
        pagesStore.createIndex('by-visited', 'last_visited', { unique: false });
        console.log('Created visited_pages store for Web Memory');
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

// ============================================
// BACKUP & RESTORE FUNCTIONS
// ============================================

export interface KnowledgeBaseBackup {
  version: number;
  exported_at: string;
  documents: any[];
  chunks: SemanticChunk[];
  interviews: any[];
}

// Export entire knowledge base to JSON
export async function exportKnowledgeBase(): Promise<KnowledgeBaseBackup> {
  const db = await initDB();
  
  const documents = await db.getAll('documents');
  const chunks = await db.getAll('semantic_chunks');
  const interviews = await db.getAll('interviews');
  
  const backup: KnowledgeBaseBackup = {
    version: 1,
    exported_at: new Date().toISOString(),
    documents,
    chunks,
    interviews
  };
  
  console.log(`✅ Exported backup: ${documents.length} documents, ${chunks.length} chunks, ${interviews.length} interviews`);
  return backup;
}

// Import knowledge base from JSON backup
export async function importKnowledgeBase(backup: KnowledgeBaseBackup): Promise<{ documents: number; chunks: number; interviews: number }> {
  const db = await initDB();
  
  // Validate backup format
  if (!backup.version || !backup.documents || !backup.chunks) {
    throw new Error('Invalid backup file format');
  }
  
  let docCount = 0;
  let chunkCount = 0;
  let interviewCount = 0;
  
  // Import documents
  const docTx = db.transaction('documents', 'readwrite');
  for (const doc of backup.documents) {
    await docTx.store.put(doc);
    docCount++;
  }
  await docTx.done;
  
  // Import chunks
  const chunkTx = db.transaction('semantic_chunks', 'readwrite');
  for (const chunk of backup.chunks) {
    await chunkTx.store.put(chunk);
    chunkCount++;
  }
  await chunkTx.done;
  
  // Import interviews if present
  if (backup.interviews && backup.interviews.length > 0) {
    const interviewTx = db.transaction('interviews', 'readwrite');
    for (const interview of backup.interviews) {
      await interviewTx.store.put(interview);
      interviewCount++;
    }
    await interviewTx.done;
  }
  
  console.log(`✅ Imported: ${docCount} documents, ${chunkCount} chunks, ${interviewCount} interviews`);
  return { documents: docCount, chunks: chunkCount, interviews: interviewCount };
}

// Check if knowledge base is empty
export async function isKnowledgeBaseEmpty(): Promise<boolean> {
  const db = await initDB();
  const docCount = await db.count('documents');
  return docCount === 0;
}

// ============================================
// WEB MEMORY FUNCTIONS - Save & Search Visited Pages
// ============================================

// Generate a hash ID from URL
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'page_' + Math.abs(hash).toString(36);
}

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'unknown';
  }
}

// Save a visited page to Web Memory
export async function saveVisitedPage(pageData: {
  url: string;
  title: string;
  content: string;
  headings: string[];
  description: string;
  keywords: string[];
}): Promise<void> {
  const db = await initDB();
  const id = hashUrl(pageData.url);
  const domain = extractDomain(pageData.url);
  const now = new Date().toISOString();
  
  // Check if page already exists
  const existing = await db.get('visited_pages', id);
  
  if (existing) {
    // Update existing - increment visit count
    await db.put('visited_pages', {
      ...existing,
      title: pageData.title || existing.title,
      content: pageData.content.substring(0, 10000) || existing.content,
      headings: pageData.headings.length > 0 ? pageData.headings : existing.headings,
      description: pageData.description || existing.description,
      keywords: [...new Set([...existing.keywords, ...pageData.keywords])],
      visit_count: existing.visit_count + 1,
      last_visited: now,
    });
    console.log(`🧠 Web Memory: Updated page (visit #${existing.visit_count + 1}): ${pageData.title}`);
  } else {
    // Save new page
    await db.put('visited_pages', {
      id,
      url: pageData.url,
      title: pageData.title,
      domain,
      content: pageData.content.substring(0, 10000),
      headings: pageData.headings,
      description: pageData.description,
      keywords: pageData.keywords,
      visited_at: now,
      visit_count: 1,
      last_visited: now,
    });
    console.log(`🧠 Web Memory: Saved NEW page: ${pageData.title}`);
  }
}

// Get all visited pages
export async function getAllVisitedPages(): Promise<VisitedPage[]> {
  const db = await initDB();
  return db.getAll('visited_pages');
}

// Get visited pages by domain
export async function getVisitedPagesByDomain(domain: string): Promise<VisitedPage[]> {
  const db = await initDB();
  return db.getAllFromIndex('visited_pages', 'by-domain', domain);
}

// Get recent visited pages (last N)
export async function getRecentVisitedPages(limit: number = 100): Promise<VisitedPage[]> {
  const db = await initDB();
  const all = await db.getAll('visited_pages');
  // Sort by last_visited descending and limit
  return all
    .sort((a, b) => new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime())
    .slice(0, limit);
}

// Search visited pages by text (simple local search)
export async function searchVisitedPages(query: string): Promise<VisitedPage[]> {
  const db = await initDB();
  const all = await db.getAll('visited_pages');
  const queryLower = query.toLowerCase();
  
  return all.filter(page => 
    page.title.toLowerCase().includes(queryLower) ||
    page.content.toLowerCase().includes(queryLower) ||
    page.description.toLowerCase().includes(queryLower) ||
    page.keywords.some(k => k.toLowerCase().includes(queryLower)) ||
    page.headings.some(h => h.toLowerCase().includes(queryLower)) ||
    page.domain.toLowerCase().includes(queryLower)
  );
}

// Get visited page count
export async function getVisitedPageCount(): Promise<number> {
  const db = await initDB();
  return db.count('visited_pages');
}

// Delete a specific visited page
export async function deleteVisitedPage(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('visited_pages', id);
  console.log(`🧠 Web Memory: Deleted page ${id}`);
}

// Clear all visited pages
export async function clearWebMemory(): Promise<void> {
  const db = await initDB();
  await db.clear('visited_pages');
  console.log('🧠 Web Memory: Cleared all visited pages');
}

// Get web memory statistics
export async function getWebMemoryStats(): Promise<{
  totalPages: number;
  uniqueDomains: number;
  totalVisits: number;
  oldestPage: string | null;
  newestPage: string | null;
}> {
  const db = await initDB();
  const all = await db.getAll('visited_pages');
  
  if (all.length === 0) {
    return {
      totalPages: 0,
      uniqueDomains: 0,
      totalVisits: 0,
      oldestPage: null,
      newestPage: null,
    };
  }
  
  const domains = new Set(all.map(p => p.domain));
  const totalVisits = all.reduce((sum, p) => sum + p.visit_count, 0);
  const sorted = all.sort((a, b) => 
    new Date(a.visited_at).getTime() - new Date(b.visited_at).getTime()
  );
  
  return {
    totalPages: all.length,
    uniqueDomains: domains.size,
    totalVisits,
    oldestPage: sorted[0].visited_at,
    newestPage: sorted[sorted.length - 1].visited_at,
  };
}

