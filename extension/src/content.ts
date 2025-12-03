/**
 * Content script - runs on all web pages
 * Detects form field focus and shows suggestions
 * With all_frames: true, this runs in iframes too!
 */

import { FieldContext, ExtensionMessage } from './types';
import { 
  getAllFillableFields, 
  getFieldValue, 
  UniversalField 
} from './wix-support';

// Detect if we're in an iframe or top frame
const isInIframe = window !== window.top;
const frameType = isInIframe ? '🖼️ IFRAME' : '📄 TOP FRAME';
console.log(`AI Smart Autofill loaded in ${frameType}: ${window.location.href.substring(0, 80)}`);

// Listen for messages from iframes (only in top frame)
if (!isInIframe) {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'AI_AUTOFILL_IFRAME_COMPLETE') {
      console.log('📥 Received iframe completion:', event.data);
      
      // Remove the processing notice
      const notice = document.getElementById('ai-iframe-notice');
      if (notice) notice.remove();
      
      // Show completion notification
      showIframeCompletionNotice(event.data.filled, event.data.skipped, event.data.source);
    }
  });
}

// State management
let currentFieldId: string | null = null;
let suggestionPopup: HTMLElement | null = null;
let currentField: HTMLInputElement | HTMLTextAreaElement | null = null;
let extensionSettings = { enabled: true, autoSuggest: false };  // Default: enabled but manual only

// Load settings
chrome.storage.sync.get(['enabled', 'autoSuggest'], (result) => {
  extensionSettings.enabled = result.enabled !== false;  // Default true
  extensionSettings.autoSuggest = result.autoSuggest === true;  // Default false (manual only)
  console.log('AI Autofill settings loaded:', extensionSettings);
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
    return ['text', 'email', 'search', 'url', 'tel', 'password', 'number'].includes(type);
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
  
  // IMPORTANT: Ignore fields in our own side panel!
  const isInSidePanel = (element as HTMLElement).closest('#ai-assistant-sidepanel');
  if (isInSidePanel) {
    console.log('Field is in AI panel, ignoring');
    return;
  }

  // Store the current field for manual suggestions
  currentField = element;

  // Only auto-suggest if enabled AND autoSuggest is on
  if (!extensionSettings.enabled || !extensionSettings.autoSuggest) {
    console.log('Auto-suggest skipped. Enabled:', extensionSettings.enabled, 'AutoSuggest:', extensionSettings.autoSuggest);
    return;
  }

  const fieldContext = extractFieldContext(element);
  currentFieldId = fieldContext.field_id;

  console.log('Sending field context to background:', fieldContext);

  // Send message to background script (fire and forget)
  try {
    chrome.runtime.sendMessage({
      type: 'FIELD_FOCUSED',
      fieldContext,
    } as ExtensionMessage);
    console.log('Message sent to background');
  } catch (error) {
    console.error('Error sending message:', error);
  }
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
 * Auto-Fill Page Functionality
 */
let autoFillInProgress = false;
let autoFillCancelled = false;
let progressBar: HTMLElement | null = null;

/**
 * Scan page for all fillable fields
 */
// Store universal fields for processing
let universalFields: UniversalField[] = [];

function scanAllFields(): (HTMLInputElement | HTMLTextAreaElement)[] {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 COMPREHENSIVE FIELD SCAN (Wix/ContentEditable Support)');
  console.log('='.repeat(60));
  
  // Detect framework
  const isWix = !!(document.querySelector('[data-url*="wix"]') || document.querySelector('script[src*="parastorage"]'));
  const isWebflow = !!document.querySelector('[data-wf-page]');
  const isWordPress = !!document.querySelector('meta[name="generator"][content*="WordPress"]');
  
  if (isWix) console.log('✅ WIX SITE - ContentEditable support enabled');
  if (isWebflow) console.log('✅ WEBFLOW SITE');
  if (isWordPress) console.log('✅ WordPress site');
  
  // Get ALL fields using universal detector
  universalFields = getAllFillableFields();
  
  // Filter out our panel and already-filled fields
  const validFields = universalFields.filter(f => {
    // Skip our panel
    if (f.element.closest('#ai-assistant-sidepanel')) {
      return false;
    }
    
    // Check visibility
    const rect = f.element.getBoundingClientRect();
    const style = window.getComputedStyle(f.element);
    const isVisible = rect.width > 0 && rect.height > 0 && 
                     style.display !== 'none' && style.visibility !== 'hidden';
    
    if (!isVisible) {
      return false;
    }
    
    // Skip if already filled
    const value = getFieldValue(f);
    if (value && value.trim() !== '') {
      return false;
    }
    
    return true;
  });
  
  const inputCount = validFields.filter(f => f.type === 'input').length;
  const textareaCount = validFields.filter(f => f.type === 'textarea').length;
  const editableCount = validFields.filter(f => f.type === 'contenteditable').length;
  
  console.log(`📊 Field Types Detected:`);
  console.log(`  📝 Inputs: ${inputCount}`);
  console.log(`  📄 Textareas: ${textareaCount}`);
  console.log(`  ✏️ ContentEditable: ${editableCount}`);
  console.log(`\n✅ TOTAL: ${validFields.length} fillable fields ready`);
  console.log('='.repeat(60) + '\n');
  
  // Convert to standard array for compatibility
  return validFields.map(f => f.element) as (HTMLInputElement | HTMLTextAreaElement)[];
}

/**
 * Show completion notice for iframe forms
 */
function showIframeCompletionNotice(filled: number, skipped: number, _source: string) {
  const notice = document.createElement('div');
  notice.id = 'ai-iframe-complete';
  notice.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(17, 153, 142, 0.4);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
  `;
  
  notice.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 24px;">✅</div>
      <div>
        <div style="font-weight: 600;">Form Auto-Fill Complete!</div>
        <div style="font-size: 12px; opacity: 0.9;">${filled} fields filled, ${skipped} skipped</div>
        <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">Click to dismiss</div>
      </div>
    </div>
  `;
  
  // Add animation styles if not already added
  if (!document.getElementById('ai-autofill-animations')) {
    const style = document.createElement('style');
    style.id = 'ai-autofill-animations';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notice);
  
  // Click to dismiss
  notice.addEventListener('click', () => {
    notice.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notice.remove(), 300);
  });
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notice.parentNode) {
      notice.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notice.remove(), 300);
    }
  }, 10000);
}

/**
 * Show notice when processing iframe forms
 */
function showIframeProcessingNotice() {
  // Remove any existing notice
  const existing = document.getElementById('ai-iframe-notice');
  if (existing) existing.remove();
  
  const notice = document.createElement('div');
  notice.id = 'ai-iframe-notice';
  notice.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideIn 0.3s ease-out;
  `;
  
  notice.innerHTML = `
    <div style="
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    "></div>
    <div>
      <div style="font-weight: 600;">Processing Embedded Form</div>
      <div style="font-size: 12px; opacity: 0.9;">Auto-filling fields in iframe...</div>
    </div>
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  notice.appendChild(style);
  
  document.body.appendChild(notice);
  
  // Auto-remove after 30 seconds (in case iframe completes without notification)
  setTimeout(() => {
    notice.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notice.remove(), 300);
  }, 30000);
}

/**
 * Create progress bar UI
 */
function createProgressBar(total: number): HTMLElement {
  const container = document.createElement('div');
  container.id = 'ai-autofill-progress';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  
  container.innerHTML = `
    <div style="flex: 1;">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">
        🤖 Auto-Filling Page...
      </div>
      <div id="ai-autofill-progress-text" style="font-size: 12px; opacity: 0.9;">
        Preparing... (0 of ${total} fields)
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="ai-autofill-cancel" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: background 0.2s;
      ">❌ Cancel</button>
    </div>
  `;
  
  document.body.appendChild(container);
  
  // Add cancel handler
  const cancelBtn = container.querySelector('#ai-autofill-cancel') as HTMLButtonElement;
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      autoFillCancelled = true;
      removeProgressBar();
    });
  }
  
  return container;
}

/**
 * Update progress bar
 */
function updateProgress(current: number, total: number, fieldName: string) {
  const progressText = document.getElementById('ai-autofill-progress-text');
  if (progressText) {
    progressText.textContent = `Filling "${fieldName}"... (${current} of ${total} fields)`;
  }
}

/**
 * Remove progress bar
 */
function removeProgressBar() {
  if (progressBar) {
    progressBar.remove();
    progressBar = null;
  }
}

/**
 * Auto-fill a single field
 */
async function autoFillSingleField(field: HTMLInputElement | HTMLTextAreaElement): Promise<boolean> {
  return new Promise((resolve) => {
    const fieldContext = extractFieldContext(field);
    const tempFieldId = fieldContext.field_id;
    let timeoutId: number;
    
    // Set up one-time listener for this field's suggestion
    const messageHandler = (message: ExtensionMessage) => {
      if (message.type === 'SUGGESTION_AVAILABLE' && message.fieldId === tempFieldId) {
        clearTimeout(timeoutId);  // Clear timeout since we got response
        console.log(`✅ Got: "${message.suggestionText.substring(0, 50)}${message.suggestionText.length > 50 ? '...' : ''}"`);
        
        // Fill the field
        field.value = message.suggestionText;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Highlight the field briefly
        const originalBorder = field.style.border;
        field.style.border = '2px solid #4CAF50';
        setTimeout(() => {
          field.style.border = originalBorder;
        }, 1000);
        
        chrome.runtime.onMessage.removeListener(messageHandler);
        resolve(true);
      } else if (message.type === 'SUGGESTION_ERROR' && message.fieldId === tempFieldId) {
        clearTimeout(timeoutId);  // Clear timeout
        console.log(`❌ Error: ${message.error}`);
        chrome.runtime.onMessage.removeListener(messageHandler);
        resolve(false);
      }
    };
    
    chrome.runtime.onMessage.addListener(messageHandler);
    
    // Send request to background
    try {
      console.log(`📤 ${fieldContext.label_text || 'unknown'}`);
      chrome.runtime.sendMessage({
        type: 'FIELD_FOCUSED',
        fieldContext,
      } as ExtensionMessage);
      
      // Timeout after 30 seconds (cleanup only - no log spam)
      timeoutId = window.setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageHandler);
        resolve(false);
      }, 30000);
    } catch (error) {
      console.error('Error requesting suggestion:', error);
      chrome.runtime.onMessage.removeListener(messageHandler);
      resolve(false);
    }
  });
}

/**
 * Process all fields sequentially
 */
async function processAllFields() {
  const frameInfo = isInIframe ? `🖼️ IFRAME (${window.location.hostname})` : '📄 TOP FRAME';
  console.log(`\n🚀 AUTO-FILL TRIGGERED in ${frameInfo}`);
  
  if (autoFillInProgress) {
    console.log('Auto-fill already in progress');
    return;
  }
  
  autoFillInProgress = true;
  autoFillCancelled = false;
  
  // Scan for fields
  const fields = scanAllFields();
  
  if (fields.length === 0) {
    console.log(`No fields found in ${frameInfo}`);
    // Only show alert in top frame if there are NO form iframes
    if (!isInIframe) {
      const formIframes = document.querySelectorAll('iframe[src*="form"], iframe[src*="123form"], iframe[src*="typeform"], iframe[src*="jotform"], iframe[src*="google.com/forms"]');
      if (formIframes.length > 0) {
        // There are form iframes - show a friendly message instead
        showIframeProcessingNotice();
      } else {
        alert('No empty form fields found on this page!');
      }
    }
    autoFillInProgress = false;
    return;
  }
  
  console.log(`✅ Found ${fields.length} fields to fill in ${frameInfo}`);
  
  // Show progress bar (only in top frame - iframes work silently)
  if (!isInIframe) {
    progressBar = createProgressBar(fields.length);
  }
  
  let filled = 0;
  let skipped = 0;
  
  // Process each field
  for (let i = 0; i < fields.length; i++) {
    if (autoFillCancelled) {
      console.log('Auto-fill cancelled by user');
      break;
    }
    
    const field = fields[i];
    const fieldName = extractFieldContext(field).label_text || 
                     field.placeholder || 
                     field.name || 
                     `Field ${i + 1}`;
    
    updateProgress(i + 1, fields.length, fieldName);
    
    const success = await autoFillSingleField(field);
    if (success) {
      filled++;
    } else {
      skipped++;
    }
    
    // Delay between fields - dynamic AI processing takes time!
    // Wait 2 seconds between fields to ensure backend finishes processing
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Show completion message (only in top frame)
  removeProgressBar();
  
  if (!autoFillCancelled && !isInIframe) {
    const message = `✅ Auto-fill complete!\n\n` +
                   `Filled: ${filled} fields\n` +
                   `Skipped: ${skipped} fields\n\n` +
                   `Please review the filled information before submitting.`;
    alert(message);
  } else if (!autoFillCancelled && isInIframe) {
    console.log(`🖼️ IFRAME AUTO-FILL COMPLETE: ${filled} filled, ${skipped} skipped`);
    // Notify parent frame about completion
    try {
      window.parent.postMessage({
        type: 'AI_AUTOFILL_IFRAME_COMPLETE',
        filled,
        skipped,
        source: window.location.hostname
      }, '*');
    } catch (e) {
      console.log('Could not notify parent frame');
    }
  }
  
  autoFillInProgress = false;
}

/**
 * Page Summarization Feature
 */
function extractPageContent(): string {
  // Extract main content from page
  const mainContent = document.querySelector('main') || 
                     document.querySelector('article') || 
                     document.querySelector('[role="main"]') ||
                     document.body;
  
  // Get text content, removing scripts and styles
  const clone = mainContent.cloneNode(true) as HTMLElement;
  
  // Remove unwanted elements
  clone.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement').forEach(el => el.remove());
  
  const text = clone.textContent || '';
  
  // Clean up whitespace
  return text.replace(/\s+/g, ' ').trim().substring(0, 5000); // Limit to 5000 chars
}

async function summarizePage() {
  try {
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'ai-summary-loading';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
    `;
    loadingDiv.innerHTML = '⏳ Analyzing page...';
    document.body.appendChild(loadingDiv);
    
    // Extract page content
    const pageContent = extractPageContent();
    const pageTitle = document.title;
    const pageUrl = window.location.href;
    
    // Send to background for AI processing
    chrome.runtime.sendMessage({
      type: 'SUMMARIZE_PAGE',
      pageContent,
      pageTitle,
      pageUrl
    });
    
  } catch (error) {
    console.error('Error summarizing page:', error);
    showSummaryResult('Error: Could not summarize this page', true);
  }
}

function showSummaryResult(summary: string, isError: boolean = false) {
  // Remove loading indicator
  const loading = document.getElementById('ai-summary-loading');
  if (loading) loading.remove();
  
  // Create summary display
  const summaryDiv = document.createElement('div');
  summaryDiv.id = 'ai-summary-result';
  summaryDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: slideInRight 0.3s ease-out;
  `;
  
  const headerColor = isError ? '#dc3545' : '#667eea';
  const headerText = isError ? '❌ Error' : '📄 Page Summary';
  
  summaryDiv.innerHTML = `
    <style>
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    </style>
    <div style="background: ${headerColor}; color: white; padding: 12px 16px; border-radius: 12px 12px 0 0; font-weight: 600; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
      <span>${headerText}</span>
      <button id="closeSummary" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
    </div>
    <div style="padding: 16px; color: #333; font-size: 14px; line-height: 1.6; max-height: 400px; overflow-y: auto;">
      ${escapeHtml(summary).replace(/\n/g, '<br>')}
    </div>
  `;
  
  document.body.appendChild(summaryDiv);
  
  // Close button
  document.getElementById('closeSummary')?.addEventListener('click', () => {
    summaryDiv.remove();
  });
  
  // Auto-close after 30 seconds
  setTimeout(() => {
    if (document.getElementById('ai-summary-result')) {
      summaryDiv.remove();
    }
  }, 30000);
}

/**
 * Element Highlighting Feature
 */
let highlightedElements: HTMLElement[] = [];

function getElementInfo(element: HTMLElement) {
  return {
    tag: element.tagName.toLowerCase(),
    text: element.textContent?.trim() || '',
    attributes: {
      'class': element.className,
      'id': element.id,
      'aria-label': element.getAttribute('aria-label'),
      'title': element.getAttribute('title'),
      'name': element.getAttribute('name'),
      'href': element.getAttribute('href'),
    }
  };
}

async function highlightElements(query: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 HIGHLIGHT REQUEST RECEIVED`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Query: "${query}"`);
  
  // Clear previous highlights
  clearHighlights();
  
  // Find interactive elements
  const selectors = [
    'button:not([hidden]):not([disabled])',
    'a[href]:not([hidden])',
    'input:not([type="hidden"]):not([hidden])',
    'textarea:not([hidden])',
    'select:not([hidden])',
    '[role="button"]',
    '[onclick]',
    '.btn',
    '.button',
    '[role="menuitem"]',
    '[role="link"]',
    'nav a',
    'header a',
    'footer a'
  ];
  
  console.log(`Searching for elements with ${selectors.length} selectors...`);
  const elements = document.querySelectorAll(selectors.join(','));
  console.log(`Found ${elements.length} total elements`);
  
  // Filter visible elements (exclude our own panel!)
  const visibleElements = Array.from(elements).filter(el => {
    const element = el as HTMLElement;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    // Exclude elements inside our AI panel
    const isInAIPanel = element.closest('#ai-assistant-sidepanel') || 
                        element.id === 'ai-assistant-sidepanel';
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           !isInAIPanel;
  }) as HTMLElement[];
  
  console.log(`Found ${visibleElements.length} visible interactive elements`);
  
  if (visibleElements.length === 0) {
    console.log('❌ No interactive elements found on page!');
    return;
  }
  
  // Check if query is intelligent (contains action words)
  const intelligentKeywords = ['how', 'where', 'find', 'change', 'update', 'edit', 'settings', 'profile', 'account', 'contact', 'help', 'click', 'need'];
  const isIntelligentQuery = intelligentKeywords.some(keyword => query.toLowerCase().includes(keyword));
  
  console.log(`Intelligent query: ${isIntelligentQuery}`);
  
  if (isIntelligentQuery && visibleElements.length > 0) {
    // Send to backend for AI analysis
    console.log('   🤖 Using AI to identify relevant elements...');
    await highlightIntelligent(query, visibleElements);
  } else {
    // Highlight all elements (default behavior)
    console.log('   ✨ Highlighting all elements (basic mode)');
    highlightAllElements(visibleElements);
  }
}

async function highlightIntelligent(query: string, elements: HTMLElement[]) {
  try {
    console.log(`   📤 Sending ${elements.length} elements to backend for analysis...`);
    
    // Show loading
    const loading = document.createElement('div');
    loading.id = 'ai-highlight-loading';
    loading.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
    `;
    loading.innerHTML = '🤖 Analyzing page...';
    document.body.appendChild(loading);
    
    // Extract element info
    const elementsData = elements.map(el => getElementInfo(el));
    console.log(`   📊 Extracted info for ${elementsData.length} elements`);
    console.log(`   First 3 elements:`, elementsData.slice(0, 3));
    
    // Call backend
    console.log(`   🌐 Calling backend: http://localhost:8000/analyze-elements`);
    const response = await fetch('http://localhost:8000/analyze-elements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        elements: elementsData
      })
    });
    
    console.log(`   📥 Backend response status: ${response.status}`);
    
    loading.remove();
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Backend error: ${errorText}`);
      throw new Error(`Failed to analyze elements: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`   📦 Backend result:`, result);
    
    const elementIndices = result.element_indices || [];
    const guidance = result.guidance || 'Follow the highlighted elements.';
    
    console.log(`   ✅ AI identified ${elementIndices.length} relevant elements: ${elementIndices}`);
    console.log(`   💬 Guidance: "${guidance}"`);
    
    if (elementIndices.length === 0) {
      console.log(`   ⚠️ No specific elements found, falling back to all`);
      // Fall back to highlighting all
      highlightAllElements(elements);
      showIntelligentGuidance('No specific elements found. Showing all interactive elements.', []);
    } else {
      // Highlight only specific elements
      const relevantElements = elementIndices
        .filter((idx: number) => idx >= 0 && idx < elements.length)
        .map((idx: number) => elements[idx]);
      
      console.log(`   🎯 Highlighting ${relevantElements.length} specific elements`);
      highlightSpecificElements(relevantElements, elementIndices);
      showIntelligentGuidance(guidance, elementIndices);
    }
    
  } catch (error) {
    console.error('❌ Error in intelligent highlighting:', error);
    console.error('   Stack trace:', error);
    // Fall back to highlighting all
    console.log('   ⚠️ Falling back to highlight all elements');
    highlightAllElements(elements);
  }
}

function highlightAllElements(elements: HTMLElement[]) {
  elements.forEach((element, index) => {
    applyHighlight(element, index + 1, false);
  });
  
  showHighlightNotification(elements.length, null);
}

function highlightSpecificElements(elements: HTMLElement[], originalIndices: number[]) {
  elements.forEach((element, idx) => {
    const originalIndex = originalIndices[idx];
    applyHighlight(element, originalIndex, true);
  });
  
  showHighlightNotification(elements.length, null);
}

function applyHighlight(element: HTMLElement, labelNumber: number, isImportant: boolean) {
  // Store original style
  const originalOutline = element.style.outline;
  const originalPosition = element.style.position;
  const originalZIndex = element.style.zIndex;
  
  // Apply highlight (more prominent if important)
  const color = isImportant ? '#f59e0b' : '#667eea';  // Orange for important, blue for all
  const width = isImportant ? '4px' : '3px';
  
  element.style.outline = `${width} solid ${color}`;
  element.style.outlineOffset = '2px';
  element.style.position = 'relative';
  element.style.zIndex = '9999';
  
  // Add label
  const label = document.createElement('div');
  label.className = 'ai-highlight-label';
  label.textContent = `${labelNumber}`;
  label.style.cssText = `
    position: absolute;
    top: -12px;
    left: -12px;
    background: ${isImportant ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;
  
  element.style.position = 'relative';
  element.appendChild(label);
  
  // Store for cleanup
  highlightedElements.push(element);
  
  // Store original styles for restoration
  element.dataset.originalOutline = originalOutline;
  element.dataset.originalPosition = originalPosition;
  element.dataset.originalZIndex = originalZIndex;
  
  // Scroll to first important element
  if (isImportant && highlightedElements.length === 1) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function showIntelligentGuidance(guidance: string, elementIndices: number[]) {
  const notification = document.createElement('div');
  notification.id = 'highlight-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: slideInRight 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px;">🎯 ${elementIndices.length} Relevant Elements Found</div>
    <div style="font-size: 13px; opacity: 0.95; margin-bottom: 12px; line-height: 1.4;">${escapeHtml(guidance)}</div>
    <button id="clearHighlightsBtn" style="
      width: 100%;
      padding: 8px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    ">Clear Highlights</button>
  `;
  
  document.body.appendChild(notification);
  
  document.getElementById('clearHighlightsBtn')?.addEventListener('click', () => {
    clearHighlights();
    notification.remove();
  });
  
  // Auto-remove after 20 seconds (longer for guidance)
  setTimeout(() => {
    if (document.getElementById('highlight-notification')) {
      notification.remove();
    }
  }, 20000);
}

function showHighlightNotification(count: number, guidance: string | null) {
  if (guidance) {
    // Already shown by showIntelligentGuidance
    return;
  }
  
  const notification = document.createElement('div');
  notification.id = 'highlight-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: slideInRight 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px;">✨ Highlighted ${count} elements</div>
    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 12px;">Important interactive elements are now highlighted</div>
    <button id="clearHighlightsBtn" style="
      width: 100%;
      padding: 8px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    ">Clear Highlights</button>
  `;
  
  document.body.appendChild(notification);
  
  document.getElementById('clearHighlightsBtn')?.addEventListener('click', () => {
    clearHighlights();
    notification.remove();
  });
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (document.getElementById('highlight-notification')) {
      notification.remove();
    }
  }, 10000);
}

function clearHighlights() {
  highlightedElements.forEach(element => {
    // Remove label
    const label = element.querySelector('.ai-highlight-label');
    if (label) label.remove();
    
    // Restore original styles
    element.style.outline = element.dataset.originalOutline || '';
    element.style.position = element.dataset.originalPosition || '';
    element.style.zIndex = element.dataset.originalZIndex || '';
    
    // Clean up dataset
    delete element.dataset.originalOutline;
    delete element.dataset.originalPosition;
    delete element.dataset.originalZIndex;
  });
  
  highlightedElements = [];
  
  // Remove notification if exists
  const notification = document.getElementById('highlight-notification');
  if (notification) notification.remove();
}

/**
 * Side Panel Feature
 */
let sidePanelOpen = false;
let sidePanelIframe: HTMLIFrameElement | null = null;
let sidePanelChatHandler: ((content: string, type: 'user' | 'assistant' | 'system') => void) | null = null;
let sidePanelSummaryHandler: ((summary: string, error?: string) => void) | null = null;

function toggleSidePanel() {
  if (sidePanelOpen) {
    closeSidePanel();
  } else {
    openSidePanel();
  }
}

function openSidePanel() {
  // Don't show UI in iframes - only in top frame!
  if (isInIframe) {
    console.log('🖼️ Skipping side panel in iframe');
    return;
  }
  
  if (sidePanelIframe) {
    console.log('📍 Side panel already open');
    return;
  }
  
  console.log('📍 Opening side panel...');
  
  // NO overlay - it was blocking page interaction!
  // Panel stays open until user explicitly closes it (X button)
  
  // Inject CSS for toggles and animations - MODERN DESIGN
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    
    .ai-toggle-container {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 26px;
      cursor: pointer;
    }
    
    .ai-toggle-input {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      cursor: pointer;
      z-index: 2;
    }
    
    .ai-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 26px;
      pointer-events: none;
    }
    
    .ai-toggle-slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 2px;
      bottom: 2px;
      background: rgba(255, 255, 255, 0.4);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 50%;
    }
    
    .ai-toggle-input:checked + .ai-toggle-slider {
      background: linear-gradient(135deg, #00D4FF, #8B5CF6);
      border-color: transparent;
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
    }
    
    .ai-toggle-input:checked + .ai-toggle-slider:before {
      transform: translateX(22px);
      background: white;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    
    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
      30% { transform: translateY(-10px); opacity: 1; }
    }
    
    @keyframes bgPulse {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      33% { transform: translate(2%, 2%) rotate(1deg); }
      66% { transform: translate(-1%, 1%) rotate(-1deg); }
    }
    
    @keyframes messageIn {
      from { opacity: 0; transform: translateY(10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    #ai-assistant-sidepanel .ai-quick-btn:hover {
      background: rgba(0, 212, 255, 0.1) !important;
      border-color: #00D4FF !important;
      color: #00D4FF !important;
      transform: translateY(-1px);
    }
    
    /* Primary button - default and hover */
    #ai-assistant-sidepanel .ai-btn-primary {
      background: linear-gradient(135deg, #00D4FF, #8B5CF6) !important;
      color: white !important;
      border: none !important;
      box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    
    #ai-assistant-sidepanel .ai-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 212, 255, 0.5) !important;
    }
    
    /* Secondary button - default and hover */
    #ai-assistant-sidepanel .ai-btn-secondary {
      background: rgba(24, 24, 32, 0.9) !important;
      color: rgba(255, 255, 255, 0.7) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    
    #ai-assistant-sidepanel .ai-btn-secondary:hover {
      background: rgba(0, 212, 255, 0.15) !important;
      border-color: #00D4FF !important;
      color: #00D4FF !important;
      transform: translateY(-1px);
    }
    
    #ai-assistant-sidepanel #ai-close-panel-btn:hover {
      background: rgba(255, 71, 87, 0.2) !important;
      border-color: #FF4757 !important;
      color: #FF4757 !important;
    }
  `;
  document.head.appendChild(style);
  
  // Create side panel (inject HTML directly!) - MODERN DESIGN
  const panel = document.createElement('div');
  panel.id = 'ai-assistant-sidepanel';
  panel.style.cssText = `
    position: fixed;
    top: 0;
    right: -420px;
    width: 420px;
    height: 100%;
    border-left: 1px solid rgba(0, 212, 255, 0.3);
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.5);
    z-index: 2147483647;
    transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: #0A0A0F;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  
  // Build complete panel with exact same layout as floating window - MODERN DESIGN
  panel.innerHTML = `
    <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 20% 20%, rgba(0, 212, 255, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(255, 0, 110, 0.08) 0%, transparent 50%); animation: bgPulse 15s ease-in-out infinite; z-index: -1; pointer-events: none;"></div>
    
    <div style="background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 16px 20px; position: relative;">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #00D4FF, transparent); opacity: 0.5;"></div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0, 212, 255, 0.4);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </div>
          <div>
            <h1 style="font-size: 16px; margin: 0; font-weight: 600; background: linear-gradient(135deg, #fff, #00D4FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">AI Smart Assistant</h1>
            <div style="font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 2px;">Docked to this page</div>
          </div>
        </div>
        <button id="ai-close-panel-btn" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6); padding: 8px; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; font-size: 18px; font-weight: bold; transition: all 0.3s; display: flex; align-items: center; justify-content: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
    
    <div style="display: flex; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 0 12px;">
      <button class="ai-tab-btn" data-tab="controls" style="flex: 1; padding: 14px 8px; border: none; background: transparent; cursor: pointer; font-size: 13px; font-weight: 500; color: #00D4FF; border-bottom: 2px solid #00D4FF; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>Controls</span>
      </button>
      <button class="ai-tab-btn" data-tab="chat" style="flex: 1; padding: 14px 8px; border: none; background: transparent; cursor: pointer; font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.4); border-bottom: 2px solid transparent; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>Chat</span>
      </button>
    </div>
    
    <div style="flex: 1; overflow-y: auto; overflow-x: hidden;">
      <!-- Controls Tab -->
      <div class="ai-tab-content" data-tab="controls" style="display: flex; flex-direction: column; height: 100%; padding: 16px;">
        <div style="background: rgba(24, 24, 32, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 16px; margin-bottom: 12px;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px 0; color: rgba(255, 255, 255, 0.4); font-weight: 600;">Extension Settings</h3>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <div>
              <div style="font-size: 14px; font-weight: 500; color: #fff;">Extension Enabled</div>
              <div style="font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 3px;">Master on/off switch</div>
            </div>
            <div class="ai-toggle-container">
              <input type="checkbox" id="ai-enabled-toggle" class="ai-toggle-input" checked>
              <span class="ai-toggle-slider"></span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
            <div>
              <div style="font-size: 14px; font-weight: 500; color: #fff;">Auto-Suggest</div>
              <div style="font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 3px;">Suggest on field focus</div>
            </div>
            <div class="ai-toggle-container">
              <input type="checkbox" id="ai-autosuggest-toggle" class="ai-toggle-input">
              <span class="ai-toggle-slider"></span>
            </div>
          </div>
        </div>
        
        <div style="background: rgba(24, 24, 32, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 16px; margin-bottom: 12px;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px 0; color: rgba(255, 255, 255, 0.4); font-weight: 600;">Quick Actions</h3>
          <button id="ai-highlight-btn" class="ai-btn-primary" style="width: 100%; padding: 14px 16px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); color: white; border: none; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            Highlight Important Elements
          </button>
          <button id="ai-autofill-btn" class="ai-btn-secondary" style="width: 100%; padding: 14px 16px; background: rgba(24, 24, 32, 0.9); color: rgba(255, 255, 255, 0.7); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Auto-Fill Entire Page
          </button>
          <button id="ai-manage-kb-btn" class="ai-btn-secondary" style="width: 100%; padding: 14px 16px; background: rgba(24, 24, 32, 0.9); color: rgba(255, 255, 255, 0.7); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            Manage Knowledge Base
          </button>
        </div>
        
        <div style="background: rgba(24, 24, 32, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 16px;">
          <h3 style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 14px 0; color: rgba(255, 255, 255, 0.4); font-weight: 600;">Panel Mode</h3>
          <button id="ai-float-btn" class="ai-btn-primary" style="width: 100%; padding: 14px 16px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); color: white; border: none; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            Undock (Floating Window)
          </button>
        </div>
        
        <div style="padding: 16px; text-align: center; font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          Switch to Chat tab to ask questions about this page
        </div>
      </div>
      
      <!-- Chat Tab -->
      <div class="ai-tab-content" data-tab="chat" style="display: none; flex-direction: column; height: 100%;">
        <div style="padding: 10px 16px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="ai-quick-btn" data-action="summarize" style="padding: 8px 14px; background: rgba(24, 24, 32, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; font-size: 11px; cursor: pointer; transition: all 0.3s; white-space: nowrap; color: rgba(255, 255, 255, 0.6); display: flex; align-items: center; gap: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            Summarize
          </button>
          <button class="ai-quick-btn" data-action="highlight" style="padding: 8px 14px; background: rgba(24, 24, 32, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; font-size: 11px; cursor: pointer; transition: all 0.3s; white-space: nowrap; color: rgba(255, 255, 255, 0.6); display: flex; align-items: center; gap: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            Highlight
          </button>
          <button class="ai-quick-btn" data-action="explain" style="padding: 8px 14px; background: rgba(24, 24, 32, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; font-size: 11px; cursor: pointer; transition: all 0.3s; white-space: nowrap; color: rgba(255, 255, 255, 0.6); display: flex; align-items: center; gap: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Explain
          </button>
          <button class="ai-quick-btn" data-action="clear" style="padding: 8px 14px; background: rgba(24, 24, 32, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; font-size: 11px; cursor: pointer; transition: all 0.3s; white-space: nowrap; color: rgba(255, 255, 255, 0.6); display: flex; align-items: center; gap: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Clear
          </button>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: transparent;" id="ai-chat-messages">
          <div style="max-width: 95%; padding: 16px; border-radius: 16px; background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(139, 92, 246, 0.1)); border: 1px solid rgba(0, 212, 255, 0.2); color: #fff; font-size: 12px; align-self: center; line-height: 1.6;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 12px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">👋 Welcome to AI Smart Autofill!</div>
            
            <div style="margin-bottom: 10px; color: #00D4FF;"><strong>I can help you with:</strong></div>
            <ul style="margin: 8px 0 8px 12px; color: rgba(255, 255, 255, 0.7);">
              <li style="margin-bottom: 4px;"><strong style="color: #fff;">Navigation:</strong> "Where do I click for X?"</li>
              <li style="margin-bottom: 4px;"><strong style="color: #fff;">Auto-fill forms:</strong> Suggest content from docs</li>
              <li style="margin-bottom: 4px;"><strong style="color: #fff;">Highlighting:</strong> Find important buttons</li>
              <li><strong style="color: #fff;">Summaries:</strong> Quick page overviews</li>
            </ul>
            
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 12px;">
              <strong style="color: #8B5CF6;">First time?</strong> <span style="color: rgba(255, 255, 255, 0.5);">Upload your documents first: Controls → "Manage Knowledge Base"</span>
            </div>
            
            <div style="margin-top: 10px; font-size: 11px; color: rgba(255, 255, 255, 0.4); text-align: center;">
              💡 Ask me anything about this page!
            </div>
          </div>
        </div>
        <div style="padding: 12px 16px 16px; background: rgba(255, 255, 255, 0.03); border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 10px;">
          <input type="text" id="ai-chat-input" placeholder="Ask me anything about this page..." style="flex: 1; padding: 12px 16px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; font-size: 13px; outline: none; font-family: inherit; transition: all 0.3s; background: rgba(24, 24, 32, 0.9); color: #fff;">
          <button id="ai-chat-send" style="padding: 12px 20px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); color: white; border: none; border-radius: 24px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.3s; min-width: 48px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          </button>
        </div>
      </div>
      
      <!-- Removed old Actions Tab -->
      <div class="ai-tab-content" data-tab="actions" style="display: none;"></div>
    </div>
  `;
  
  // Append to DOM FIRST
  document.body.appendChild(panel);
  sidePanelIframe = panel as any;
  sidePanelOpen = true;
  
  // Initialize handlers IMMEDIATELY after appending
  console.log('🔧 Initializing handlers...');
  initializeSidePanelHandlers(panel);
  
  // Animate in
  setTimeout(() => {
    panel.style.right = '0';
  }, 10);
  
  console.log('   ✅ Side panel opened!');
}

function initializeSidePanelHandlers(panel: HTMLElement) {
  // Load and apply extension settings
  chrome.storage.sync.get(['enabled', 'autoSuggest'], (result) => {
    const enabledToggle = panel.querySelector('#ai-enabled-toggle') as HTMLInputElement;
    const autoSuggestToggle = panel.querySelector('#ai-autosuggest-toggle') as HTMLInputElement;
    
    if (enabledToggle) {
      enabledToggle.checked = result.enabled !== false;
      enabledToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ enabled: enabledToggle.checked });
      });
    }
    
    if (autoSuggestToggle) {
      autoSuggestToggle.checked = result.autoSuggest === true;
      autoSuggestToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ autoSuggest: autoSuggestToggle.checked });
      });
    }
  });
  
  // Tab switching with proper styles
  const tabBtns = panel.querySelectorAll('.ai-tab-btn');
  const tabContents = panel.querySelectorAll('.ai-tab-content');
  
  tabBtns.forEach(btn => {
    // Add hover effect - MODERN DESIGN
    btn.addEventListener('mouseenter', () => {
      if (!(btn as HTMLElement).classList.contains('active')) {
        (btn as HTMLElement).style.color = 'rgba(255, 255, 255, 0.7)';
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      if (!(btn as HTMLElement).classList.contains('active')) {
        (btn as HTMLElement).style.color = 'rgba(255, 255, 255, 0.4)';
      }
    });
    
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      
      // Update tab buttons - MODERN DESIGN
      tabBtns.forEach(b => {
        b.classList.remove('active');
        (b as HTMLElement).style.background = 'transparent';
        (b as HTMLElement).style.color = 'rgba(255, 255, 255, 0.4)';
        (b as HTMLElement).style.borderBottom = '2px solid transparent';
      });
      
      btn.classList.add('active');
      (btn as HTMLElement).style.background = 'transparent';
      (btn as HTMLElement).style.color = '#00D4FF';
      (btn as HTMLElement).style.borderBottom = '2px solid #00D4FF';
      
      // Update tab contents
      tabContents.forEach(content => {
        (content as HTMLElement).style.display = 'none';
      });
      
      const targetContent = panel.querySelector(`.ai-tab-content[data-tab="${tabName}"]`) as HTMLElement;
      if (targetContent) {
        targetContent.style.display = 'flex';
      }
    });
  });
  
  // Close button
  panel.querySelector('#ai-close-panel-btn')?.addEventListener('click', () => closeSidePanel());
  
  // Chat functionality
  const chatInput = panel.querySelector('#ai-chat-input') as HTMLInputElement;
  const chatSend = panel.querySelector('#ai-chat-send') as HTMLButtonElement;
  const chatMessages = panel.querySelector('#ai-chat-messages') as HTMLElement;
  
  console.log('🔧 Chat elements:', {
    input: !!chatInput,
    send: !!chatSend,
    messages: !!chatMessages
  });
  
  if (!chatInput || !chatSend || !chatMessages) {
    console.error('❌ Chat elements not found in panel!');
    return;
  }
  
  let conversationHistory: Array<{role: string, content: string}> = [];
  let isProcessing = false;
  let isRecording = false;
  let panelMediaRecorder: MediaRecorder | null = null;
  
  function formatMessage(content: string): string {
    // Format assistant messages with nice HTML formatting - MODERN DESIGN
    let formatted = content;
    
    // Handle numbered lists (1. 2. 3.)
    formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="margin-left: 12px; margin-bottom: 6px;"><strong style="color: #00D4FF;">$1.</strong> $2</div>');
    
    // Handle bullet points (- or •)
    formatted = formatted.replace(/^[-•]\s+(.+)$/gm, '<div style="margin-left: 12px; margin-bottom: 4px;">• $1</div>');
    
    // Handle bold text (**text**)
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #00D4FF;">$1</strong>');
    
    // Handle section headers (lines ending with :)
    formatted = formatted.replace(/^([A-Z][^:]+):$/gm, '<div style="font-weight: 600; margin-top: 10px; margin-bottom: 6px; color: #00D4FF;">$1:</div>');
    
    // Convert paragraphs (double line breaks)
    const paragraphs = formatted.split('\n\n');
    formatted = paragraphs.map(para => {
      if (para.includes('<div')) {
        return para; // Already formatted
      }
      return `<p style="margin-bottom: 10px; line-height: 1.6;">${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    
    return formatted;
  }
  
  function addMessage(content: string, type: 'user' | 'assistant' | 'system') {
    console.log(`   📝 Adding ${type} message: ${content.substring(0, 50)}...`);
    const msg = document.createElement('div');
    msg.style.animation = 'messageIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    
    if (type === 'user') {
      msg.style.cssText = 'max-width: 85%; align-self: flex-end; background: linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%); color: white; padding: 12px 16px; border-radius: 16px; border-bottom-right-radius: 4px; font-size: 13px; line-height: 1.5; box-shadow: 0 4px 15px rgba(0, 212, 255, 0.3); animation: messageIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);';
      msg.textContent = content;
    } else if (type === 'assistant') {
      msg.style.cssText = 'max-width: 85%; align-self: flex-start; background: rgba(24, 24, 32, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.9); padding: 12px 16px; border-radius: 16px; border-bottom-left-radius: 4px; font-size: 13px; line-height: 1.6; animation: messageIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);';
      msg.innerHTML = formatMessage(content); // Use HTML formatting!
    } else {
      msg.style.cssText = 'max-width: 90%; align-self: center; background: linear-gradient(135deg, rgba(255, 184, 0, 0.15), rgba(255, 0, 110, 0.1)); border: 1px solid rgba(255, 184, 0, 0.3); color: #FFB800; padding: 10px 14px; border-radius: 12px; font-size: 12px; text-align: center; animation: messageIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);';
      msg.textContent = content;
    }
    
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    console.log(`   ✅ Message added to DOM`);
    
    if (type !== 'system') {
      conversationHistory.push({ role: type, content });
    }
    
    // Remove typing indicator and re-enable chat input after assistant response
    if (type === 'assistant') {
      removeTypingIndicator();
      isProcessing = false;
      chatSend.disabled = false;
      console.log(`   ✅ Chat re-enabled`);
    }
  }
  
  // Set the global handler so global listener can forward messages
  console.log('🔗 Setting sidePanelChatHandler...');
  sidePanelChatHandler = addMessage;
  console.log('✅ sidePanelChatHandler set:', !!sidePanelChatHandler);
  
  function showTypingIndicator() {
    const typing = document.createElement('div');
    typing.id = 'ai-typing-indicator';
    typing.style.cssText = 'max-width: 85%; align-self: flex-start; background: rgba(24, 24, 32, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); padding: 14px 18px; border-radius: 16px; display: flex; gap: 6px;';
    typing.innerHTML = `
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #00D4FF, #8B5CF6); animation: typing 1.4s infinite;"></span>
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #00D4FF, #8B5CF6); animation: typing 1.4s infinite 0.2s;"></span>
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #00D4FF, #8B5CF6); animation: typing 1.4s infinite 0.4s;"></span>
    `;
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function removeTypingIndicator() {
    const typing = document.getElementById('ai-typing-indicator');
    if (typing) typing.remove();
  }
  
  function sendMessage() {
    console.log('💬 Send message called');
    const text = chatInput.value.trim();
    console.log('   Text:', text);
    console.log('   isProcessing:', isProcessing);
    
    if (!text || isProcessing) {
      console.log('   ⚠️ Skipping - empty or processing');
      return;
    }
    
    isProcessing = true;
    chatSend.disabled = true;
    chatInput.value = '';
    
    console.log('   ✅ Adding user message and sending to backend');
    addMessage(text, 'user');
    
    // Show typing indicator
    showTypingIndicator();
    
    // Check for navigation query
    const navKeywords = ['how', 'where', 'find', 'show', 'click', 'need'];
    if (navKeywords.some(k => text.toLowerCase().includes(k))) {
      console.log('   🎯 Navigation query detected');
      highlightElements(text);
      setTimeout(() => addMessage('💡 Highlighted relevant elements!', 'system'), 1000);
    }
    
    console.log('   📤 Sending to background...');
    
    // Send message (fire-and-forget - response comes via global listener)
    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      message: text,
      conversationHistory: conversationHistory
    } as ExtensionMessage);
    
    console.log('   ✅ Message sent to background');
  }
  
  // Set summary handler for global listener
  sidePanelSummaryHandler = (summary: string, error?: string) => {
    const summaryDiv = panel.querySelector('#ai-summary-display') as HTMLElement;
    if (!summaryDiv) return;
    
    if (error) {
      summaryDiv.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <p style="color: #dc3545; margin-bottom: 16px; font-size: 14px;">Error: ${error}</p>
          <button id="ai-gen-summary-btn" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;">Try Again</button>
        </div>`;
    } else {
      summaryDiv.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h3 style="font-size: 15px; margin: 0 0 12px 0; color: #667eea;">📄 Page Summary</h3>
          <p style="font-size: 13px; line-height: 1.6; color: #333; margin: 0; white-space: pre-wrap;">${summary}</p>
          <button id="ai-refresh-summary-btn" style="width: 100%; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;">Refresh Summary</button>
        </div>`;
    }
    
    // Re-attach generate button handler
    const genBtn = summaryDiv.querySelector('#ai-gen-summary-btn, #ai-refresh-summary-btn') as HTMLButtonElement;
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        const mainGenBtn = panel.querySelector('#ai-gen-summary-btn') as HTMLButtonElement;
        if (mainGenBtn) {
          const content = document.body.innerText.substring(0, 5000);
          summaryDiv.innerHTML = '<div style="text-align: center; padding: 40px 20px;"><div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; margin: 0 auto 16px;"></div><p style="color: #666; font-size: 14px;">Analyzing page...</p></div>';
          chrome.runtime.sendMessage({
            type: 'SUMMARIZE_PAGE',
            pageContent: content,
            pageTitle: document.title,
            pageUrl: window.location.href
          });
        }
      });
    }
  };
  
  // Voice recording functions for docked panel - MODERN DESIGN
  function updatePanelSendButton() {
    if (isRecording) {
      chatSend.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';
      chatSend.style.background = 'linear-gradient(135deg, #FF4757, #FF006E)';
      chatSend.style.boxShadow = '0 0 20px rgba(255, 71, 87, 0.5)';
    } else if (chatInput.value.trim()) {
      chatSend.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send';
      chatSend.style.background = 'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)';
      chatSend.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.3)';
    } else {
      chatSend.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';
      chatSend.style.background = 'linear-gradient(135deg, #00D4FF, #8B5CF6)';
      chatSend.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.3)';
    }
  }
  
  async function startPanelRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await transcribePanelAudio(audioBlob);
        
        isRecording = false;
        chatInput.disabled = false;
        chatInput.placeholder = 'Type or click 🎤 to speak...';
        updatePanelSendButton();
      };
      
      recorder.start();
      panelMediaRecorder = recorder;
      isRecording = true;
      chatInput.placeholder = 'Recording... Click ⏹️ to stop';
      chatInput.disabled = true;
      updatePanelSendButton();
      
    } catch (error) {
      console.error('Microphone error:', error);
      addMessage('❌ Could not access microphone. Please grant permission.', 'system');
    }
  }
  
  function stopPanelRecording() {
    if (panelMediaRecorder && isRecording) {
      panelMediaRecorder.stop();
    }
  }
  
  async function transcribePanelAudio(audioBlob: Blob) {
    try {
      addMessage('🎤 Transcribing...', 'system');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch('http://localhost:8000/interview/transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const result = await response.json();
      
      chatInput.value = result.text;
      updatePanelSendButton();
      addMessage('✅ Transcribed! Click Send to ask.', 'system');
      
    } catch (error) {
      console.error('Transcription error:', error);
      addMessage('❌ Transcription failed: ' + (error as Error).message, 'system');
    }
  }
  
  console.log('🔧 Attaching chat event listeners...');
  
  // Smart button click
  chatSend.addEventListener('click', () => {
    console.log('🖱️ Chat button clicked!');
    if (isRecording) {
      stopPanelRecording();
    } else if (chatInput.value.trim()) {
      sendMessage();
    } else {
      startPanelRecording();
    }
  });
  
  // Update button on input
  chatInput.addEventListener('input', () => {
    updatePanelSendButton();
  });
  
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() && !isRecording) {
      console.log('⌨️ Enter key pressed!');
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Initialize button
  updatePanelSendButton();
  
  console.log('✅ Chat handlers attached');
  
  // Quick action buttons in chat tab
  panel.querySelectorAll('.ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = (btn as HTMLElement).dataset.action;
      
      if (action === 'summarize') {
        chatInput.value = 'Please summarize this page for me.';
        sendMessage();
      } else if (action === 'highlight') {
        highlightElements('important interactive elements');
      } else if (action === 'explain') {
        chatInput.value = 'What does this page do and how do I use it?';
        sendMessage();
      } else if (action === 'clear') {
        chatMessages.innerHTML = `
          <div style="max-width: 95%; padding: 12px 16px; border-radius: 12px; background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); color: #856404; font-size: 12px; align-self: center; line-height: 1.6; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">
            <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px;">👋 Welcome to AI Smart Autofill!</div>
            
            <div style="margin-bottom: 8px;"><strong>I can help you with:</strong></div>
            <div style="margin-left: 8px; margin-bottom: 6px;">
              • <strong>This page:</strong> Ask "where to click for X?" or "how do I do Y?"<br>
              • <strong>Auto-fill forms:</strong> I'll suggest content from your documents<br>
              • <strong>Highlighting:</strong> Find important buttons/links easily<br>
              • <strong>Summaries:</strong> Get quick page overviews
            </div>
            
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(133, 100, 4, 0.2);">
              <strong>First time?</strong> Upload your documents first:<br>
              <span style="font-size: 11px;">Controls tab → "⚙️ Manage Knowledge Base" → Upload .txt/.md files</span>
            </div>
            
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.9; text-align: center;">
              💡 Ask me anything about this page or how to use the extension!
            </div>
          </div>
        `;
        conversationHistory = [];
      }
    });
    
    // Hover effect
    btn.addEventListener('mouseenter', () => {
      (btn as HTMLElement).style.background = '#667eea';
      (btn as HTMLElement).style.color = 'white';
      (btn as HTMLElement).style.borderColor = '#667eea';
    });
    btn.addEventListener('mouseleave', () => {
      (btn as HTMLElement).style.background = '#f0f0f0';
      (btn as HTMLElement).style.color = 'inherit';
      (btn as HTMLElement).style.borderColor = '#e0e0e0';
    });
  });
  
  // Action buttons with hover effects
  const actionButtons = [
    { id: '#ai-highlight-btn', handler: () => {
      console.log('✨ Highlight button clicked');
      highlightElements('important interactive elements');
    }},
    { id: '#ai-autofill-btn', handler: () => {
      console.log('🤖 Auto-fill clicked');
      processAllFields();
    }},
    { id: '#ai-manage-kb-btn', handler: () => {
      console.log('⚙️ Manage knowledge base clicked');
      chrome.runtime.openOptionsPage();
    }},
    { id: '#ai-float-btn', handler: () => {
      console.log('🪟 Undock clicked - switching to floating window');
      closeSidePanel();
      chrome.windows.create({
        url: chrome.runtime.getURL('src/main-panel.html'),
        type: 'popup',
        width: 440,
        height: 650
      });
    }}
  ];
  
  console.log('🔧 Attaching action button handlers...');
  let attachedCount = 0;
  
  actionButtons.forEach(({ id, handler }) => {
    const btn = panel.querySelector(id) as HTMLButtonElement;
    if (btn) {
      console.log(`   ✅ Found button: ${id}`);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🖱️ Button clicked: ${id}`);
        handler();
      });
      
      // Add hover effect
      btn.addEventListener('mouseenter', () => {
        if (btn.style.background.includes('gradient')) {
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
        } else {
          btn.style.background = '#f5f5f5';
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
        if (!btn.style.background.includes('gradient')) {
          btn.style.background = 'white';
        }
      });
      attachedCount++;
    } else {
      console.warn(`   ⚠️ Button not found: ${id}`);
    }
  });
  
  console.log(`✅ Attached ${attachedCount}/${actionButtons.length} action buttons`);
}

function closeSidePanel(force: boolean = false) {
  const panel = document.getElementById('ai-assistant-sidepanel');
  if (!panel) {
    console.log('📍 closeSidePanel called but panel not found');
    return;
  }
  
  console.log('📍 closeSidePanel called, force:', force);
  
  // Check if chat is processing
  const chatSend = panel.querySelector('#ai-chat-send') as HTMLButtonElement;
  console.log('   Chat send button:', chatSend ? 'found' : 'not found');
  console.log('   Chat send disabled:', chatSend?.disabled);
  
  if (!force && chatSend && chatSend.disabled) {
    // AI is thinking, confirm before closing
    console.log('   ⚠️ AI is thinking, asking for confirmation...');
    if (!confirm('⏳ AI is processing your message...\n\nClose anyway? You\'ll lose the response.')) {
      console.log('   ❌ User cancelled close');
      return; // User cancelled
    }
    console.log('   ✅ User confirmed close');
  }
  
  console.log('📍 Closing side panel');
  
  // Clear handlers
  sidePanelChatHandler = null;
  sidePanelSummaryHandler = null;
  
  // Animate out
  panel.style.right = '-420px';
  
  setTimeout(() => {
    panel.remove();
    sidePanelIframe = null;
    sidePanelOpen = false;
  }, 300);
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  console.log('📨 Content script received message:', message.type);
  
  if (message.type === 'SUGGESTION_AVAILABLE') {
    showSuggestionPopup(message.fieldId, message.suggestionText);
  } else if (message.type === 'SUGGESTION_ERROR') {
    console.error('AI Autofill error:', message.error);
  } else if (message.type === 'MANUAL_SUGGEST') {
    triggerManualSuggestion();
  } else if (message.type === 'AUTO_FILL_PAGE') {
    processAllFields();
  } else if (message.type === 'HIGHLIGHT_ELEMENTS') {
    console.log('   🎯 Triggering highlight for query:', message.query);
    highlightElements(message.query);
  } else if (message.type === 'CLEAR_HIGHLIGHTS') {
    clearHighlights();
  } else if (message.type === 'SUMMARIZE_PAGE') {
    summarizePage();
  } else if (message.type === 'SUMMARIZE_PAGE_RESULT') {
    console.log('   📄 Summary result received');
    // If side panel is open, use its handler
    if (sidePanelSummaryHandler) {
      console.log('   🎯 Forwarding to side panel summary handler');
      sidePanelSummaryHandler(message.summary, message.error);
    } else {
      // Otherwise use the floating result
      showSummaryResult(message.summary, !!message.error);
    }
  } else if (message.type === 'CHAT_RESPONSE') {
    console.log('   💬 Chat response received!');
    console.log('   Side panel open?', sidePanelOpen);
    console.log('   Handler set?', !!sidePanelChatHandler);
    
    // Forward to side panel if open
    if (sidePanelOpen && sidePanelChatHandler) {
      console.log('   🎯 Forwarding to side panel chat handler');
      if (message.error) {
        sidePanelChatHandler('Error: ' + message.error, 'system');
      } else {
        sidePanelChatHandler(message.response, 'assistant');
      }
    } else {
      console.log('   ⚠️ Side panel not ready to receive message');
      console.log('   sidePanelOpen:', sidePanelOpen);
      console.log('   sidePanelChatHandler:', sidePanelChatHandler);
    }
  } else if (message.type === 'TOGGLE_SIDE_PANEL') {
    console.log('   📍 TOGGLE_SIDE_PANEL message received!');
    toggleSidePanel();
  }
});

// Initialize: listen to all focus events
document.addEventListener('focusin', handleFieldFocus, true);

console.log('AI Smart Autofill content script loaded');

