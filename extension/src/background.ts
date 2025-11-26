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
 * Message listener
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender) => {
    if (message.type === 'FIELD_FOCUSED') {
      handleFieldFocused(message.fieldContext, sender);
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

console.log('AI Smart Autofill background service worker loaded');

