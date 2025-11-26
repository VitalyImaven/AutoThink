/**
 * Background service worker (Manifest V3)
 * Coordinates between content scripts, IndexedDB, and backend API
 */

import { config } from './config';
import {
  ExtensionMessage,
  FieldContext,
} from './types';
import { getAllChunks } from './db';

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
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'SUGGESTION_ERROR',
        fieldId: fieldContext.field_id,
        error: error instanceof Error ? error.message : 'Unknown error',
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
  try {
    console.log('💬 Handling chat message:', message);
    
    // Get current page context
    // The chat window might be focused, so we need to find the right tab
    const tabs = await chrome.tabs.query({});
    console.log(`   Found ${tabs.length} tabs total`);
    
    // Find the most recently active non-extension tab
    const regularTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
    const targetTab = regularTabs.find(t => t.active) || regularTabs[0]; // Active tab or first regular tab
    
    let pageContext = '';
    
    if (targetTab && targetTab.id) {
      console.log(`   Target tab: ${targetTab.title} (${targetTab.url?.substring(0, 50)}...)`);
      
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
      console.log('   ⚠️ No target tab found');
    }
    
    console.log('   Sending to backend...');
    
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
    
    // Send response back
    chrome.runtime.sendMessage({
      type: 'CHAT_RESPONSE',
      response: result.response
    } as ExtensionMessage);
    
  } catch (error) {
    console.error('Error handling chat:', error);
    chrome.runtime.sendMessage({
      type: 'CHAT_RESPONSE',
      response: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ExtensionMessage);
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
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'SUMMARIZE_PAGE_RESULT',
        summary: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      } as ExtensionMessage);
    }
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

// Track open panel windows
let panelWindowId: number | null = null;

// Handle extension icon click - open draggable window
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
  
  // Create new window
  const window = await chrome.windows.create({
    url: chrome.runtime.getURL('src/main-panel.html'),
    type: 'popup',
    width: 420,
    height: 600,
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

