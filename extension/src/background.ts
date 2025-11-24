/**
 * Background service worker (Manifest V3)
 * Coordinates between content scripts, IndexedDB, and backend API
 */

import { config } from './config';
import {
  ExtensionMessage,
  FieldContext,
  ClassificationResult,
  SuggestionRequest,
  KnowledgeChunk,
} from './types';
import { getChunksByCategory } from './db';

// In-memory cache for field classifications
interface ClassificationCache {
  [key: string]: ClassificationResult;
}

const classificationCache: ClassificationCache = {};

/**
 * Generate cache key for field classification
 */
function getCacheKey(field: FieldContext, hostname: string, pathname: string): string {
  return `${hostname}:${pathname}:${field.label_text}:${field.name_attr}:${field.id_attr}`;
}

/**
 * Call backend API to classify a field
 */
async function classifyField(field: FieldContext): Promise<ClassificationResult> {
  const response = await fetch(`${config.backendUrl}/classify-field`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(field),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Classification failed: ${error}`);
  }

  return response.json();
}

/**
 * Call backend API to generate suggestion
 */
async function generateSuggestion(
  request: SuggestionRequest
): Promise<{ suggestion_text: string }> {
  const response = await fetch(`${config.backendUrl}/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Suggestion generation failed: ${error}`);
  }

  return response.json();
}

/**
 * Handle field focus event from content script
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

    const url = new URL(sender.url || 'about:blank');
    const hostname = url.hostname;
    const pathname = url.pathname;

    // Check classification cache
    const cacheKey = getCacheKey(fieldContext, hostname, pathname);
    let classification = classificationCache[cacheKey];

    if (!classification) {
      // Call backend to classify field
      console.log('Classifying field:', fieldContext);
      classification = await classifyField(fieldContext);
      classificationCache[cacheKey] = classification;
      console.log('Classification result:', classification);
    } else {
      console.log('Using cached classification:', classification);
    }

    // Get relevant knowledge chunks from IndexedDB
    const chunks = await getChunksByCategory(classification.category);
    console.log(`Found ${chunks.length} chunks for category ${classification.category}`);

    if (chunks.length === 0) {
      // No knowledge available for this category
      chrome.tabs.sendMessage(tabId, {
        type: 'SUGGESTION_ERROR',
        fieldId: fieldContext.field_id,
        error: 'No knowledge available for this field type. Please upload relevant documents.',
      });
      return;
    }

    // Limit chunks to keep payload reasonable (top 10 by priority)
    const sortedChunks = chunks
      .sort((a, b) => (b.meta.priority || 0) - (a.meta.priority || 0))
      .slice(0, 10);

    // Build suggestion request
    const suggestionRequest: SuggestionRequest = {
      field: fieldContext,
      classification: classification,
      chunks: sortedChunks,
    };

    // Call backend to generate suggestion
    console.log('Generating suggestion...');
    const result = await generateSuggestion(suggestionRequest);
    console.log('Suggestion generated:', result.suggestion_text);

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
  (message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === 'FIELD_FOCUSED') {
      handleFieldFocused(message.fieldContext, sender);
    }
    return true; // Keep message channel open for async response
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

