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
  if (sidePanelIframe) {
    console.log('📍 Side panel already open');
    return;
  }
  
  console.log('📍 Opening side panel...');
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'ai-assistant-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 2147483646;
    transition: opacity 0.3s;
  `;
  
  overlay.addEventListener('click', () => closeSidePanel());
  
  // Inject CSS for toggles and animations
  const style = document.createElement('style');
  style.textContent = `
    .ai-toggle-container {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }
    
    .ai-toggle-input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .ai-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 24px;
    }
    
    .ai-toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
    
    .ai-toggle-input:checked + .ai-toggle-slider {
      background-color: #667eea;
    }
    
    .ai-toggle-input:checked + .ai-toggle-slider:before {
      transform: translateX(20px);
    }
    
    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
      30% { transform: translateY(-8px); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Create side panel (inject HTML directly!)
  const panel = document.createElement('div');
  panel.id = 'ai-assistant-sidepanel';
  panel.style.cssText = `
    position: fixed;
    top: 0;
    right: -420px;
    width: 420px;
    height: 100%;
    border-left: 2px solid #667eea;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
    transition: right 0.3s ease-out;
    background: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
  `;
  
  // Build complete panel with exact same layout as floating window
  panel.innerHTML = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="font-size: 18px; margin: 0 0 4px 0; font-weight: 600;">🤖 AI Smart Assistant</h1>
          <div style="font-size: 12px; opacity: 0.9; margin: 0;">Docked to this page</div>
        </div>
        <button id="ai-close-panel-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 18px; font-weight: bold; transition: all 0.2s;">×</button>
      </div>
    </div>
    
    <div style="display: flex; background: white; border-bottom: 2px solid #e0e0e0;">
      <button class="ai-tab-btn" data-tab="controls" style="flex: 1; padding: 14px 8px; border: none; background: #f9f9ff; cursor: pointer; font-size: 13px; font-weight: 500; color: #667eea; border-bottom: 3px solid #667eea; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span style="font-size: 16px;">⚙️</span><span>Controls</span>
      </button>
      <button class="ai-tab-btn" data-tab="chat" style="flex: 1; padding: 14px 8px; border: none; background: white; cursor: pointer; font-size: 13px; font-weight: 500; color: #666; border-bottom: 3px solid transparent; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span style="font-size: 16px;">💬</span><span>Chat</span>
      </button>
    </div>
    
    <div style="flex: 1; overflow-y: auto; overflow-x: hidden;">
      <!-- Controls Tab (First - Same as floating) -->
      <div class="ai-tab-content" data-tab="controls" style="display: flex; flex-direction: column; height: 100%; padding: 16px;">
        <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #333;">Extension Settings</h3>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <div>
              <div style="font-size: 13px; color: #333;">Extension Enabled</div>
              <div style="font-size: 11px; color: #666; margin-top: 3px;">Master on/off switch</div>
            </div>
            <div class="ai-toggle-container">
              <input type="checkbox" id="ai-enabled-toggle" class="ai-toggle-input" checked>
              <span class="ai-toggle-slider"></span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
            <div>
              <div style="font-size: 13px; color: #333;">Auto-Suggest</div>
              <div style="font-size: 11px; color: #666; margin-top: 3px;">Suggest on field focus</div>
            </div>
            <div class="ai-toggle-container">
              <input type="checkbox" id="ai-autosuggest-toggle" class="ai-toggle-input">
              <span class="ai-toggle-slider"></span>
            </div>
          </div>
        </div>
        
        <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #333;">Quick Actions</h3>
          <button id="ai-highlight-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; margin-bottom: 8px; transition: all 0.2s;">✨ Highlight Important Elements</button>
          <button id="ai-autofill-btn" style="width: 100%; padding: 12px; background: white; color: #667eea; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; margin-bottom: 8px; transition: all 0.2s;">🤖 Auto-Fill Entire Page</button>
          <button id="ai-manage-kb-btn" style="width: 100%; padding: 12px; background: white; color: #667eea; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;">⚙️ Manage Knowledge Base</button>
        </div>
        
        <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #333;">Panel Mode</h3>
          <button id="ai-float-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;">🪟 Undock (Floating Window)</button>
        </div>
        
        <div style="padding: 12px; text-align: center; font-size: 11px; color: #999; margin-top: 12px;">
          💡 Switch to Chat tab to ask questions about this page
        </div>
      </div>
      
      <!-- Chat Tab -->
      <div class="ai-tab-content" data-tab="chat" style="display: none; flex-direction: column; height: 100%;">
        <div style="padding: 12px 16px; background: white; border-bottom: 1px solid #e0e0e0; display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="ai-quick-btn" data-action="summarize" style="padding: 6px 12px; background: #f0f0f0; border: 1px solid #e0e0e0; border-radius: 16px; font-size: 11px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">📄 Summarize</button>
          <button class="ai-quick-btn" data-action="highlight" style="padding: 6px 12px; background: #f0f0f0; border: 1px solid #e0e0e0; border-radius: 16px; font-size: 11px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">✨ Highlight</button>
          <button class="ai-quick-btn" data-action="explain" style="padding: 6px 12px; background: #f0f0f0; border: 1px solid #e0e0e0; border-radius: 16px; font-size: 11px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">💡 Explain page</button>
          <button class="ai-quick-btn" data-action="clear" style="padding: 6px 12px; background: #f0f0f0; border: 1px solid #e0e0e0; border-radius: 16px; font-size: 11px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">🗑️ Clear</button>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f5f5f5;" id="ai-chat-messages">
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
        </div>
        <div style="padding: 12px 16px; background: white; border-top: 1px solid #e0e0e0; display: flex; gap: 8px;">
          <input type="text" id="ai-chat-input" placeholder="Ask me anything about this page..." style="flex: 1; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 20px; font-size: 13px; outline: none; font-family: inherit; transition: border-color 0.2s;">
          <button id="ai-chat-send" style="padding: 10px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; transition: transform 0.2s;">Send</button>
        </div>
      </div>
      
      <!-- No more separate Summary tab - users can ask for summaries in chat! -->
      
      <!-- Removed Actions Tab (merged into Controls) -->
      <div class="ai-tab-content" data-tab="actions" style="display: none; padding: 16px;">
        <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #333;">Quick Actions</h3>
          <button id="ai-highlight-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; margin-bottom: 8px; transition: all 0.2s;">✨ Highlight Important Elements</button>
          <button id="ai-autofill-btn" style="width: 100%; padding: 12px; background: white; color: #667eea; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; margin-bottom: 8px; transition: all 0.2s;">🤖 Auto-Fill Entire Page</button>
          <button id="ai-clear-btn" style="width: 100%; padding: 12px; background: white; color: #667eea; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;">Clear Highlights</button>
        </div>
        <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h3 style="font-size: 14px; margin: 0 0 12px 0; color: #333;">Window Mode</h3>
          <button id="ai-float-btn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;">🪟 Switch to Floating Window</button>
        </div>
        <div style="padding: 12px; text-align: center; font-size: 11px; color: #999; margin-top: 12px;">
          💡 Use Chat tab to ask questions with AI
        </div>
      </div>
    </div>
  `;
  
  // Append to DOM FIRST
  document.body.appendChild(overlay);
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
    // Add hover effect
    btn.addEventListener('mouseenter', () => {
      if (!(btn as HTMLElement).classList.contains('active')) {
        (btn as HTMLElement).style.background = '#f5f5f5';
        (btn as HTMLElement).style.color = '#667eea';
      }
    });
    
    btn.addEventListener('mouseleave', () => {
      if (!(btn as HTMLElement).classList.contains('active')) {
        (btn as HTMLElement).style.background = 'white';
        (btn as HTMLElement).style.color = '#666';
      }
    });
    
    btn.addEventListener('click', () => {
      const tabName = (btn as HTMLElement).dataset.tab;
      
      // Update tab buttons
      tabBtns.forEach(b => {
        b.classList.remove('active');
        (b as HTMLElement).style.background = 'white';
        (b as HTMLElement).style.color = '#666';
        (b as HTMLElement).style.borderBottom = '3px solid transparent';
      });
      
      btn.classList.add('active');
      (btn as HTMLElement).style.background = '#f9f9ff';
      (btn as HTMLElement).style.color = '#667eea';
      (btn as HTMLElement).style.borderBottom = '3px solid #667eea';
      
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
  
  function addMessage(content: string, type: 'user' | 'assistant' | 'system') {
    console.log(`   📝 Adding ${type} message: ${content.substring(0, 50)}...`);
    const msg = document.createElement('div');
    
    if (type === 'user') {
      msg.style.cssText = 'max-width: 85%; align-self: flex-end; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5;';
    } else if (type === 'assistant') {
      msg.style.cssText = 'max-width: 85%; align-self: flex-start; background: white; color: #333; padding: 10px 14px; border-radius: 12px; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.08); line-height: 1.5;';
    } else {
      msg.style.cssText = 'max-width: 90%; align-self: center; background: #fff3cd; color: #856404; padding: 8px 12px; border-radius: 12px; font-size: 12px; text-align: center;';
    }
    
    msg.textContent = content;
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
    typing.style.cssText = 'max-width: 85%; align-self: flex-start; background: white; padding: 12px 16px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.08);';
    typing.innerHTML = `
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #667eea; margin: 0 3px; animation: typing 1.4s infinite;"></span>
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #667eea; margin: 0 3px; animation: typing 1.4s infinite 0.2s;"></span>
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #667eea; margin: 0 3px; animation: typing 1.4s infinite 0.4s;"></span>
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
  
  console.log('🔧 Attaching chat event listeners...');
  chatSend.addEventListener('click', () => {
    console.log('🖱️ Send button clicked!');
    sendMessage();
  });
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      console.log('⌨️ Enter key pressed!');
      e.preventDefault();
      sendMessage();
    }
  });
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
    document.getElementById('ai-assistant-overlay')?.remove();
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

