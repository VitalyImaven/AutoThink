/**
 * Content script - runs on all web pages
 * Detects form field focus and shows suggestions
 */

import { FieldContext, ExtensionMessage } from './types';

// State management
let currentFieldId: string | null = null;
let suggestionPopup: HTMLElement | null = null;
let currentField: HTMLInputElement | HTMLTextAreaElement | null = null;
let extensionSettings = { enabled: true, autoSuggest: false };  // Default: enabled but manual only

// Load settings
chrome.storage.sync.get(['enabled', 'autoSuggest'], (result) => {
  extensionSettings.enabled = result.enabled !== false;  // Default true
  extensionSettings.autoSuggest = result.autoSuggest === true;  // Default false (manual only)
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabled) {
      extensionSettings.enabled = changes.enabled.newValue;
    }
    if (changes.autoSuggest) {
      extensionSettings.autoSuggest = changes.autoSuggest.newValue;
    }
  }
});

/**
 * Extract context information from a form field
 */
function extractFieldContext(
  element: HTMLInputElement | HTMLTextAreaElement
): FieldContext {
  const fieldId = crypto.randomUUID();

  // Extract basic attributes
  const nameAttr = element.getAttribute('name');
  const idAttr = element.getAttribute('id');
  const placeholder = element.getAttribute('placeholder');
  const maxLength = element.getAttribute('maxlength');

  // Find associated label
  let labelText: string | null = null;
  if (idAttr) {
    const label = document.querySelector(`label[for="${idAttr}"]`);
    if (label) {
      labelText = label.textContent?.trim() || null;
    }
  }

  // If no label found via 'for' attribute, look for parent label
  if (!labelText) {
    const parentLabel = element.closest('label');
    if (parentLabel) {
      labelText = parentLabel.textContent?.trim() || null;
    }
  }

  // Get nearby text (look at previous siblings and parent)
  let nearbyText: string | null = null;
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const elementIndex = siblings.indexOf(element);
    
    // Look at previous sibling or parent's text
    if (elementIndex > 0) {
      const prevSibling = siblings[elementIndex - 1];
      nearbyText = prevSibling.textContent?.trim().slice(0, 100) || null;
    } else {
      nearbyText = parent.textContent?.trim().slice(0, 100) || null;
    }
  }

  return {
    field_id: fieldId,
    name_attr: nameAttr,
    id_attr: idAttr,
    label_text: labelText,
    placeholder: placeholder,
    nearby_text: nearbyText,
    max_length: maxLength ? parseInt(maxLength, 10) : null,
  };
}

/**
 * Check if element is a fillable form field
 */
function isFillableField(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  if (element.tagName === 'TEXTAREA') {
    return true;
  }

  if (element.tagName === 'INPUT') {
    const input = element as HTMLInputElement;
    const type = input.type.toLowerCase();
    return ['text', 'email', 'search', 'url', 'tel', 'password'].includes(type);
  }

  return false;
}

/**
 * Handle field focus event
 */
function handleFieldFocus(event: FocusEvent) {
  const element = event.target as Element;

  if (!isFillableField(element)) {
    return;
  }

  // Store the current field for manual suggestions
  currentField = element;

  // Only auto-suggest if enabled AND autoSuggest is on
  if (!extensionSettings.enabled || !extensionSettings.autoSuggest) {
    return;
  }

  const fieldContext = extractFieldContext(element);
  currentFieldId = fieldContext.field_id;

  // Send message to background script
  chrome.runtime.sendMessage({
    type: 'FIELD_FOCUSED',
    fieldContext,
  } as ExtensionMessage);
}

/**
 * Manually trigger suggestion for currently focused field
 */
function triggerManualSuggestion() {
  if (!extensionSettings.enabled) {
    console.log('AI Autofill is disabled');
    return;
  }

  if (!currentField || !isFillableField(currentField)) {
    console.log('No valid field is focused');
    return;
  }

  const fieldContext = extractFieldContext(currentField);
  currentFieldId = fieldContext.field_id;

  // Send message to background script
  chrome.runtime.sendMessage({
    type: 'FIELD_FOCUSED',
    fieldContext,
  } as ExtensionMessage);
}

/**
 * Create and show suggestion popup
 */
function showSuggestionPopup(fieldId: string, suggestionText: string) {
  if (fieldId !== currentFieldId || !currentField) {
    return;
  }

  // Remove existing popup
  removeSuggestionPopup();

  // Create popup element
  suggestionPopup = document.createElement('div');
  suggestionPopup.id = 'ai-autofill-suggestion';
  suggestionPopup.style.cssText = `
    position: absolute;
    background: white;
    border: 2px solid #4285f4;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 400px;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  `;

  // Preview text (truncated if too long)
  const previewText =
    suggestionText.length > 100
      ? suggestionText.slice(0, 100) + '...'
      : suggestionText;

  suggestionPopup.innerHTML = `
    <div style="color: #5f6368; font-size: 12px; margin-bottom: 4px;">
      ✨ AI Suggestion
    </div>
    <div style="color: #202124;">
      ${escapeHtml(previewText)}
    </div>
    <div style="color: #5f6368; font-size: 11px; margin-top: 8px;">
      Click to accept • Press Esc to dismiss
    </div>
  `;

  // Position popup below field
  const rect = currentField.getBoundingClientRect();
  suggestionPopup.style.top = `${window.scrollY + rect.bottom + 8}px`;
  suggestionPopup.style.left = `${window.scrollX + rect.left}px`;

  // Add click handler to accept suggestion
  suggestionPopup.addEventListener('click', () => {
    acceptSuggestion(suggestionText);
  });

  document.body.appendChild(suggestionPopup);

  // Add keyboard handler
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Accept and insert suggestion
 */
function acceptSuggestion(suggestionText: string) {
  if (currentField) {
    currentField.value = suggestionText;

    // Trigger input and change events
    currentField.dispatchEvent(new Event('input', { bubbles: true }));
    currentField.dispatchEvent(new Event('change', { bubbles: true }));
  }

  removeSuggestionPopup();
}

/**
 * Remove suggestion popup
 */
function removeSuggestionPopup() {
  if (suggestionPopup) {
    suggestionPopup.remove();
    suggestionPopup = null;
  }
  document.removeEventListener('keydown', handleKeyDown);
}

/**
 * Handle keyboard events
 */
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    removeSuggestionPopup();
  } else if (event.key === 'Enter' && suggestionPopup) {
    event.preventDefault();
    const suggestionText = suggestionPopup.textContent?.trim() || '';
    acceptSuggestion(suggestionText);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'SUGGESTION_AVAILABLE') {
    showSuggestionPopup(message.fieldId, message.suggestionText);
  } else if (message.type === 'SUGGESTION_ERROR') {
    console.error('AI Autofill error:', message.error);
  } else if (message.type === 'MANUAL_SUGGEST') {
    triggerManualSuggestion();
  }
});

// Initialize: listen to all focus events
document.addEventListener('focusin', handleFieldFocus, true);

console.log('AI Smart Autofill content script loaded');

