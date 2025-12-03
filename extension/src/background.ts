/**
 * Background service worker (Manifest V3)
 * Coordinates between content scripts, IndexedDB, and backend API
 */

import { config } from './config';
import {
  ExtensionMessage,
  FieldContext,
} from './types';
import { 
  getAllChunks, 
  saveVisitedPage, 
  getAllVisitedPages,
  getWebMemoryStats,
  clearWebMemory 
} from './db';

/**
 * Call backend API to generate suggestion (DYNAMIC SYSTEM)
 * Backend is STATELESS - we send all chunks from IndexedDB
 */
async function generateSuggestion(
  fieldContext: FieldContext
): Promise<{ suggestion_text: string; field_intent?: string; top_tags?: string[] }> {
  // Get all chunks from local IndexedDB
  const all_chunks = await getAllChunks();
  
  console.log(`Sending ${all_chunks.length} chunks from IndexedDB to backend`);
  
  const response = await fetch(`${config.backendUrl}/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      field_context: fieldContext,
      all_chunks: all_chunks,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Suggestion generation failed: ${error}`);
  }

  return response.json();
}

/**
 * Handle field focus event from content script
 * DYNAMIC SYSTEM: No classification needed, direct suggestion!
 */
async function handleFieldFocused(
  fieldContext: FieldContext,
  sender: chrome.runtime.MessageSender
) {
  try {
    const tabId = sender.tab?.id;
    if (!tabId) {
      throw new Error('No tab ID available');
    }

    console.log('Getting suggestion for field:', fieldContext.label_text || fieldContext.placeholder);

    // Call backend to generate suggestion (DYNAMIC - backend has all documents!)
    console.log('Generating suggestion with dynamic AI...');
    const result = await generateSuggestion(fieldContext);
    
    // Log full response for debugging
    console.log('📥 Full response:', JSON.stringify(result, null, 2));
    console.log(`📝 Suggestion text (${result.suggestion_text?.length || 0} chars):`, 
                result.suggestion_text?.substring(0, 100));
    
    // Check if we got a valid suggestion
    if (!result.suggestion_text || result.suggestion_text === 'N/A' || result.suggestion_text.trim() === '') {
      console.warn('⚠️ Empty or N/A suggestion received!');
      throw new Error('No relevant information found for this field');
    }

    // Send suggestion back to content script
    chrome.tabs.sendMessage(tabId, {
      type: 'SUGGESTION_AVAILABLE',
      fieldId: fieldContext.field_id,
      suggestionText: result.suggestion_text,
    });
  } catch (error) {
    console.error('Error handling field focus:', error);
    
    let errorMessage = '';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Backend server not running. Please start: python -m uvicorn app.main:app --reload --port 8000';
    } else {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'SUGGESTION_ERROR',
        fieldId: fieldContext.field_id,
        error: errorMessage,
      });
    }
  }
}

/**
 * Handle chat message
 */
async function handleChatMessage(
  message: string,
  conversationHistory: Array<{role: string, content: string}> | undefined,
  _sender: chrome.runtime.MessageSender
) {
  // Define targetTab outside try/catch so it's available for both success and error cases
  let targetTab: chrome.tabs.Tab | undefined;
  
  try {
    console.log('💬 Handling chat message:', message);
    
    // Get current page context
    // The chat window might be focused, so we need to find the right tab
    const tabs = await chrome.tabs.query({});
    console.log(`   Found ${tabs.length} tabs total`);
    
    // Log ALL tabs first
    console.log('   All tabs:');
    tabs.forEach(t => console.log(`     - [${t.active ? 'ACTIVE' : 'inactive'}] ${t.title} | ${t.url?.substring(0, 60)}`));
    
    // Find the most recently active non-extension tab
    const regularTabs = tabs.filter(t => {
      if (!t.url) return false;
      const url = t.url.toLowerCase();
      return !url.startsWith('chrome://') && 
             !url.startsWith('chrome-extension://') &&
             !url.startsWith('edge://') &&
             !url.startsWith('about:');
    });
    
    console.log(`   Regular tabs found: ${regularTabs.length}`);
    regularTabs.forEach(t => console.log(`     - ${t.title} (${t.url?.substring(0, 50)})`));
    
    targetTab = regularTabs.find(t => t.active) || regularTabs[0]; // Active tab or first regular tab
    
    let pageContext = '';
    
    if (targetTab && targetTab.id) {
      console.log(`   ✅ Target tab: ${targetTab.title} (${targetTab.url?.substring(0, 50)}...)`);
      
      try {
        // Execute script to extract page info
        const results = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: () => {
            return {
              title: document.title,
              url: window.location.href,
              content: document.body.innerText.substring(0, 3000), // First 3000 chars
              h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim()).filter(Boolean).join(', '),
              h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()).filter(Boolean).slice(0, 5).join(', ')
            };
          }
        });
        
        console.log(`   Script execution result:`, results);
        
        if (results && results[0] && results[0].result) {
          const pageInfo = results[0].result;
          pageContext = `Page Title: ${pageInfo.title}
URL: ${pageInfo.url}
Main Headings (H1): ${pageInfo.h1 || 'None'}
Sub Headings (H2): ${pageInfo.h2 || 'None'}

Page Content (first 3000 characters):
${pageInfo.content}`;
          console.log('   ✅ Extracted page context: ' + pageContext.length + ' chars');
          console.log('   Preview:', pageContext.substring(0, 300));
        } else {
          console.log('   ⚠️ No result from script execution');
        }
      } catch (e) {
        console.error('   ❌ Error extracting page context:', e);
        // Fallback to basic info
        pageContext = `Page Title: ${targetTab.title || 'Unknown'}
URL: ${targetTab.url || 'Unknown'}

Note: Could not extract full page content. Error: ${e}`;
      }
    } else {
      console.log('   ⚠️ No target tab found - no page context available');
      console.log('   Will send chat without page context');
    }
    
    console.log('   Sending to backend...');
    console.log('   Backend URL:', config.backendUrl);
    
    // Call backend chat endpoint
    const response = await fetch(`${config.backendUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory || [],
        page_context: pageContext
      }),
    });
    
    console.log('   Backend response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat request failed: ${error}`);
    }

    const result = await response.json();
    
    console.log('   ✅ Got result from backend');
    
    // Send response back to ALL contexts (both popup and content script)
    // Use runtime.sendMessage for popup/options
    chrome.runtime.sendMessage({
      type: 'CHAT_RESPONSE',
      response: result.response
    } as ExtensionMessage);
    
    // Also send to the content script of the target tab
    if (targetTab && targetTab.id) {
      console.log('   📤 Sending CHAT_RESPONSE to tab', targetTab.id);
      chrome.tabs.sendMessage(targetTab.id, {
        type: 'CHAT_RESPONSE',
        response: result.response
      } as ExtensionMessage).catch(err => {
        console.log('   ⚠️ Could not send to tab (might be closed):', err);
      });
    }
    
  } catch (error) {
    console.error('Error handling chat:', error);
    
    // Determine user-friendly error message
    let userMessage = '';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Backend is not running or not reachable
      userMessage = `⚠️ Cannot connect to backend server!

The AI backend is not running or not reachable.

**How to fix:**
1. Start the backend server:
   \`cd backend\`
   \`python -m uvicorn app.main:app --reload --port 8000\`

2. Check backend URL in extension settings
   (Should be: http://localhost:8000)

3. Make sure no firewall is blocking port 8000

**Quick check:** Visit http://localhost:8000/health in your browser
If it shows an error, the backend is not running.`;
    } else {
      // Other error
      userMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
    
    // Send error to all contexts
    chrome.runtime.sendMessage({
      type: 'CHAT_RESPONSE',
      response: '',
      error: userMessage
    } as ExtensionMessage);
    
    // Also send to content script if tab exists
    if (targetTab && targetTab.id) {
      chrome.tabs.sendMessage(targetTab.id, {
        type: 'CHAT_RESPONSE',
        response: '',
        error: userMessage
      } as ExtensionMessage).catch(() => {});
    }
  }
}

/**
 * Handle page summarization
 */
async function handleSummarizePage(
  pageContent: string,
  pageTitle: string,
  pageUrl: string,
  sender: chrome.runtime.MessageSender
) {
  try {
    const tabId = sender.tab?.id;
    
    // Call backend summarize endpoint
    const response = await fetch(`${config.backendUrl}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_content: pageContent,
        page_title: pageTitle,
        page_url: pageUrl
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Summarization failed: ${error}`);
    }

    const result = await response.json();
    
    // Send summary back to content script
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'SUMMARIZE_PAGE_RESULT',
        summary: result.summary
      } as ExtensionMessage);
    }
    
  } catch (error) {
    console.error('Error summarizing page:', error);
    
    let errorMessage = '';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Backend server not running. Start it with: python -m uvicorn app.main:app --reload --port 8000';
    } else {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'SUMMARIZE_PAGE_RESULT',
        summary: '',
        error: errorMessage
      } as ExtensionMessage);
    }
  }
}

/**
 * Handle Web Memory search
 */
async function handleWebMemorySearch(query: string, sender: chrome.runtime.MessageSender) {
  try {
    console.log('🧠 Web Memory search:', query);
    
    // Get all visited pages from IndexedDB
    const pages = await getAllVisitedPages();
    console.log(`   Found ${pages.length} pages in memory`);
    
    if (pages.length === 0) {
      // Send empty result
      const response = {
        type: 'WEB_MEMORY_RESULT',
        results: [],
        answer: "I don't have any saved websites yet. Browse some websites and I'll remember them for you!"
      };
      chrome.runtime.sendMessage(response);
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, response).catch(() => {});
      }
      return;
    }
    
    // Call backend for AI-powered search
    const response = await fetch(`${config.backendUrl}/web-memory/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        pages: pages.map(p => ({
          url: p.url,
          title: p.title,
          domain: p.domain,
          content: p.content,
          headings: p.headings,
          description: p.description,
          keywords: p.keywords,
          visited_at: p.visited_at,
          visit_count: p.visit_count
        })),
        max_results: 5
      })
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`   ✅ Found ${result.results.length} relevant pages`);
    
    // Send results back
    const memoryResult = {
      type: 'WEB_MEMORY_RESULT',
      results: result.results,
      answer: result.answer
    };
    
    chrome.runtime.sendMessage(memoryResult);
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, memoryResult).catch(() => {});
    }
    
  } catch (error) {
    console.error('❌ Web Memory search error:', error);
    const errorResult = {
      type: 'WEB_MEMORY_RESULT',
      results: [],
      answer: `Error searching web memory: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
    chrome.runtime.sendMessage(errorResult);
  }
}

/**
 * Handle saving page to web memory
 */
async function handleSavePageToMemory(pageData: any) {
  try {
    await saveVisitedPage(pageData);
    console.log('🧠 Page saved to Web Memory:', pageData.title);
  } catch (error) {
    console.error('❌ Error saving to Web Memory:', error);
  }
}

/**
 * Message listener
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender) => {
    if (message.type === 'FIELD_FOCUSED') {
      handleFieldFocused(message.fieldContext, sender);
    } else if (message.type === 'CHAT_MESSAGE') {
      handleChatMessage(message.message, message.conversationHistory, sender);
    } else if (message.type === 'SUMMARIZE_PAGE') {
      handleSummarizePage(
        (message as any).pageContent, 
        (message as any).pageTitle, 
        (message as any).pageUrl, 
        sender
      );
    } else if (message.type === 'SEARCH_WEB_MEMORY') {
      handleWebMemorySearch((message as any).query, sender);
    } else if (message.type === 'SAVE_PAGE_TO_MEMORY') {
      handleSavePageToMemory((message as any).pageData);
    } else if (message.type === 'GET_WEB_MEMORY_STATS') {
      // Handle stats request
      getWebMemoryStats().then(stats => {
        const response = {
          type: 'WEB_MEMORY_STATS_RESULT',
          stats
        };
        chrome.runtime.sendMessage(response);
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, response).catch(() => {});
        }
      });
    } else if (message.type === 'CLEAR_WEB_MEMORY') {
      // Clear all web memory
      clearWebMemory().then(() => {
        console.log('🧠 Web Memory cleared!');
      });
    }
    // Don't return true - we're not sending a response back to content script
  }
);

/**
 * Create context menu for manual suggestions
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'ai-autofill-suggest',
    title: '✨ AI Autofill Suggest',
    contexts: ['editable'],  // Only show on text inputs and textareas
  });
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ai-autofill-suggest' && tab?.id) {
    // Send message to content script to trigger suggestion for focused field
    chrome.tabs.sendMessage(tab.id, {
      type: 'MANUAL_SUGGEST',
      tabId: tab.id,
    } as ExtensionMessage);
  }
});

// Clean up chat history when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const storageKey = `chat_history_${tabId}`;
  chrome.storage.local.remove(storageKey);
  console.log(`Cleaned up chat history for tab ${tabId}`);
});

// ============================================
// WEB MEMORY - Auto-index visited pages
// ============================================

// Track pages being indexed to avoid duplicates
const indexingInProgress = new Set<number>();

// Domains to skip (internal, extensions, etc.)
const skipDomains = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'moz-extension://',
  'file://',
  'localhost',
  '127.0.0.1',
  'newtab',
];

function shouldIndexPage(url: string): boolean {
  if (!url) return false;
  
  // Skip internal pages
  for (const skip of skipDomains) {
    if (url.includes(skip)) return false;
  }
  
  // Only index http/https pages
  return url.startsWith('http://') || url.startsWith('https://');
}

// Listen for completed page loads
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when page is fully loaded
  if (changeInfo.status !== 'complete') return;
  
  const url = tab.url;
  if (!url || !shouldIndexPage(url)) return;
  
  // Avoid indexing same tab multiple times simultaneously
  if (indexingInProgress.has(tabId)) return;
  indexingInProgress.add(tabId);
  
  try {
    console.log(`🧠 Web Memory: Indexing page - ${tab.title?.substring(0, 50)}...`);
    
    // Extract page content using scripting API
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Extract page information
        const title = document.title;
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                          document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        
        // Get headings
        const headings: string[] = [];
        document.querySelectorAll('h1, h2, h3').forEach(h => {
          const text = h.textContent?.trim();
          if (text && text.length > 2 && text.length < 200) {
            headings.push(text);
          }
        });
        
        // Get main content (skip scripts, styles, nav, etc.)
        const mainContent = document.querySelector('main') || 
                           document.querySelector('article') || 
                           document.querySelector('[role="main"]') ||
                           document.body;
        
        const clone = mainContent.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement, noscript').forEach(el => el.remove());
        const content = clone.textContent?.replace(/\s+/g, ' ').trim() || '';
        
        // Extract keywords from meta tags
        const keywordsMeta = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
        const keywords = keywordsMeta.split(',').map(k => k.trim()).filter(k => k.length > 0);
        
        // Add keywords from common category/tag elements
        document.querySelectorAll('[class*="tag"], [class*="category"], [class*="topic"]').forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 1 && text.length < 50) {
            keywords.push(text);
          }
        });
        
        return {
          title,
          description,
          headings: headings.slice(0, 20),  // Limit headings
          content: content.substring(0, 10000),  // Limit content
          keywords: [...new Set(keywords)].slice(0, 30)  // Unique keywords
        };
      }
    });
    
    if (results && results[0] && results[0].result) {
      const pageData = results[0].result;
      
      // Save to IndexedDB
      await saveVisitedPage({
        url,
        title: pageData.title || tab.title || 'Untitled',
        content: pageData.content,
        headings: pageData.headings,
        description: pageData.description,
        keywords: pageData.keywords
      });
      
      console.log(`   ✅ Indexed: ${pageData.title?.substring(0, 40)}...`);
    }
    
  } catch (error) {
    // Silently fail for pages we can't access (like chrome:// pages)
    console.log(`   ⚠️ Could not index ${url?.substring(0, 50)}: ${error}`);
  } finally {
    indexingInProgress.delete(tabId);
  }
});

// Track open panel windows
let panelWindowId: number | null = null;

// Handle extension icon click - open draggable window in TOP-RIGHT corner
chrome.action.onClicked.addListener(async () => {
  // Check if window already exists
  if (panelWindowId !== null) {
    try {
      await chrome.windows.get(panelWindowId);
      // Window exists, focus it
      chrome.windows.update(panelWindowId, { focused: true });
      return;
    } catch (e) {
      // Window was closed, create new one
      panelWindowId = null;
    }
  }
  
  // Get current window to determine screen position
  const currentWindow = await chrome.windows.getCurrent();
  
  // Panel dimensions
  const panelWidth = 440;
  const panelHeight = 650;
  
  // Calculate top-right position (where extensions usually appear)
  // Position it in the top-right of the current browser window
  let left = (currentWindow.left || 0) + (currentWindow.width || 1200) - panelWidth - 10;
  let top = (currentWindow.top || 0) + 80; // Below the toolbar
  
  // Ensure it's not off-screen
  if (left < 0) left = 10;
  if (top < 0) top = 10;
  
  // Create new window positioned in top-right corner
  const window = await chrome.windows.create({
    url: chrome.runtime.getURL('src/main-panel.html'),
    type: 'popup',
    width: panelWidth,
    height: panelHeight,
    left: left,
    top: top,
    focused: true
  });
  
  panelWindowId = window.id || null;
});

// Clean up window ID when closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === panelWindowId) {
    panelWindowId = null;
  }
});

console.log('AI Smart Autofill background service worker loaded');

