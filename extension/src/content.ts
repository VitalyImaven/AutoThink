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
function scanAllFields(): (HTMLInputElement | HTMLTextAreaElement)[] {
  const fields: (HTMLInputElement | HTMLTextAreaElement)[] = [];
  
  // Get all input and textarea elements
  const inputs = document.querySelectorAll('input, textarea');
  
  inputs.forEach((element) => {
    if (isFillableField(element as Element)) {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      // Skip if field already has a value (unless it's empty or placeholder-like)
      if (!field.value || field.value.trim() === '') {
        fields.push(field);
      }
    }
  });
  
  return fields;
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
  if (autoFillInProgress) {
    console.log('Auto-fill already in progress');
    return;
  }
  
  autoFillInProgress = true;
  autoFillCancelled = false;
  
  // Scan for fields
  const fields = scanAllFields();
  
  if (fields.length === 0) {
    alert('No empty form fields found on this page!');
    autoFillInProgress = false;
    return;
  }
  
  console.log(`Found ${fields.length} fields to fill`);
  
  // Show progress bar
  progressBar = createProgressBar(fields.length);
  
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
  
  // Show completion message
  removeProgressBar();
  
  if (!autoFillCancelled) {
    const message = `✅ Auto-fill complete!\n\n` +
                   `Filled: ${filled} fields\n` +
                   `Skipped: ${skipped} fields\n\n` +
                   `Please review the filled information before submitting.`;
    alert(message);
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
  
  // Filter visible elements
  const visibleElements = Array.from(elements).filter(el => {
    const element = el as HTMLElement;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
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
    showSummaryResult(message.summary, !!message.error);
  }
});

// Initialize: listen to all focus events
document.addEventListener('focusin', handleFieldFocus, true);

console.log('AI Smart Autofill content script loaded');

