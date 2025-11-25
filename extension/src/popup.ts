/**
 * Popup script for extension control
 */

// Get elements
const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const autoSuggestToggle = document.getElementById('autoSuggestToggle') as HTMLInputElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const openOptionsBtn = document.getElementById('openOptions') as HTMLButtonElement;
const autoFillPageBtn = document.getElementById('autoFillPage') as HTMLButtonElement;
const testSuggestionBtn = document.getElementById('testSuggestion') as HTMLButtonElement;

// Load current settings
chrome.storage.sync.get(['enabled', 'autoSuggest'], (result) => {
  const enabled = result.enabled !== false;  // Default true
  const autoSuggest = result.autoSuggest === true;  // Default false
  
  enabledToggle.checked = enabled;
  autoSuggestToggle.checked = autoSuggest;
  
  updateStatus(enabled, autoSuggest);
});

// Update status display
function updateStatus(enabled: boolean, autoSuggest: boolean) {
  statusDiv.className = 'status ' + (enabled ? 'enabled' : 'disabled');
  
  if (!enabled) {
    statusDiv.textContent = '❌ Extension Disabled';
  } else if (autoSuggest) {
    statusDiv.textContent = '✅ Auto-Suggest ON (Focus fields)';
  } else {
    statusDiv.textContent = '✅ Manual Mode (Right-click fields)';
  }
}

// Handle enabled toggle
enabledToggle.addEventListener('change', () => {
  const enabled = enabledToggle.checked;
  chrome.storage.sync.set({ enabled }, () => {
    updateStatus(enabled, autoSuggestToggle.checked);
    console.log('Extension', enabled ? 'enabled' : 'disabled');
  });
});

// Handle auto-suggest toggle
autoSuggestToggle.addEventListener('change', () => {
  const autoSuggest = autoSuggestToggle.checked;
  chrome.storage.sync.set({ autoSuggest }, () => {
    updateStatus(enabledToggle.checked, autoSuggest);
    console.log('Auto-suggest', autoSuggest ? 'enabled' : 'disabled');
  });
});

// Open options page
openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Auto-fill entire page
autoFillPageBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'AUTO_FILL_PAGE' });
    window.close();
  }
});

// Test suggestion on current page
testSuggestionBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'MANUAL_SUGGEST', tabId: tab.id });
    window.close();
  }
});

console.log('AI Smart Autofill popup loaded');

