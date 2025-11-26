/**
 * Main Panel - Unified Interface with Tabs
 * Combines Controls, Chat, and Summary in one persistent view
 */

import { ExtensionMessage } from './types';

// Tab switching
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = (button as HTMLElement).dataset.tab;
    switchTab(tabName!);
  });
});

function switchTab(tabName: string) {
  // Update buttons
  tabButtons.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  // Update panes
  tabPanes.forEach(pane => pane.classList.remove('active'));
  document.getElementById(`${tabName}-pane`)?.classList.add('active');
  
  // If switching to summary and it's empty, don't auto-generate
  // User can click the button if they want
}

// Settings
const enabledToggle = document.getElementById('enabledToggle') as HTMLInputElement;
const autoSuggestToggle = document.getElementById('autoSuggestToggle') as HTMLInputElement;

chrome.storage.sync.get(['enabled', 'autoSuggest'], (result) => {
  enabledToggle.checked = result.enabled !== false;
  autoSuggestToggle.checked = result.autoSuggest === true;
});

enabledToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabledToggle.checked });
});

autoSuggestToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ autoSuggest: autoSuggestToggle.checked });
});

// Quick action buttons
document.getElementById('summarizeBtn')?.addEventListener('click', () => {
  switchTab('summary');
  generateSummary();
});

document.getElementById('highlightBtn')?.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({});
  const targetTab = tabs.filter(t => t.url && !t.url.startsWith('chrome://'))[0];
  if (targetTab?.id) {
    chrome.tabs.sendMessage(targetTab.id, {
      type: 'HIGHLIGHT_ELEMENTS',
      query: 'important interactive elements like buttons, links, and form inputs'
    });
  }
});

document.getElementById('autoFillBtn')?.addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({});
  const targetTab = tabs.filter(t => t.url && !t.url.startsWith('chrome://'))[0];
  if (targetTab?.id) {
    chrome.tabs.sendMessage(targetTab.id, { type: 'AUTO_FILL_PAGE' });
  }
});

document.getElementById('openOptionsBtn')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Chat functionality
let conversationHistory: Array<{role: string, content: string}> = [];
let isProcessing = false;
let currentTabId: number | null = null;

const chatMessages = document.getElementById('chatMessages')!;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;

// Load conversation history
async function loadConversationHistory() {
  const tabs = await chrome.tabs.query({});
  const targetTab = tabs.filter(t => t.url && !t.url.startsWith('chrome://'))[0];
  
  if (targetTab?.id) {
    currentTabId = targetTab.id;
    const storageKey = `chat_history_${targetTab.id}`;
    const result = await chrome.storage.local.get(storageKey);
    
    if (result[storageKey]) {
      conversationHistory = result[storageKey];
      conversationHistory.forEach(msg => {
        addMessageToUI(msg.content, msg.role as 'user' | 'assistant');
      });
    }
  }
}

async function saveConversationHistory() {
  if (currentTabId) {
    const storageKey = `chat_history_${currentTabId}`;
    await chrome.storage.local.set({ [storageKey]: conversationHistory });
  }
}

function addMessageToUI(content: string, type: 'user' | 'assistant' | 'system') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;
  messageDiv.textContent = content;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessage(content: string, type: 'user' | 'assistant' | 'system') {
  addMessageToUI(content, type);
  
  if (type === 'user' || type === 'assistant') {
    conversationHistory.push({
      role: type === 'user' ? 'user' : 'assistant',
      content: content
    });
    saveConversationHistory();
  }
}

function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

async function sendMessage(message?: string) {
  const text = message || chatInput.value.trim();
  if (!text || isProcessing) return;
  
  isProcessing = true;
  sendBtn.disabled = true;
  chatInput.value = '';
  
  addMessage(text, 'user');
  showTypingIndicator();
  
  try {
    // Check for highlighting trigger
    const navigationKeywords = ['how', 'where', 'find', 'show', 'change', 'update', 'edit', 'click', 'need'];
    const isNavigationQuery = navigationKeywords.some(keyword => text.toLowerCase().includes(keyword));
    
    if (isNavigationQuery && currentTabId) {
      chrome.tabs.sendMessage(currentTabId, {
        type: 'HIGHLIGHT_ELEMENTS',
        query: text
      } as ExtensionMessage);
      
      setTimeout(() => {
        addMessage('💡 I\'ve highlighted the relevant elements on the page for you!', 'system');
      }, 1000);
    }
    
    // Send to backend
    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      message: text,
      conversationHistory: conversationHistory
    } as ExtensionMessage);
    
  } catch (error) {
    removeTypingIndicator();
    addMessage('Error: ' + (error instanceof Error ? error.message : 'Unknown error'), 'system');
    isProcessing = false;
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', () => sendMessage());
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// Listen for chat responses
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'CHAT_RESPONSE') {
    removeTypingIndicator();
    if (message.error) {
      addMessage('Error: ' + message.error, 'system');
    } else {
      addMessage(message.response, 'assistant');
    }
    isProcessing = false;
    sendBtn.disabled = false;
  }
});

// Quick action buttons in chat
document.querySelectorAll('.quick-action-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).dataset.action;
    handleQuickAction(action);
  });
});

function handleQuickAction(action: string | undefined) {
  if (!action) return;
  
  switch (action) {
    case 'summarize':
      sendMessage('Please summarize this page for me.');
      break;
    case 'highlight':
      sendMessage('Show me the most important clickable elements on this page.');
      break;
    case 'explain':
      sendMessage('What does this page do and how do I use it?');
      break;
    case 'clear':
      chatMessages.innerHTML = '<div class="chat-message system">👋 Hello! I can help you navigate this page, answer questions, and find information. What would you like to know?</div>';
      conversationHistory = [];
      saveConversationHistory();
      break;
  }
}

// Summary functionality
async function generateSummary() {
  const summaryPlaceholder = document.getElementById('summaryPlaceholder')!;
  
  // Show loading
  summaryPlaceholder.innerHTML = `
    <div class="summary-loading">
      <div class="spinner"></div>
      <p>Analyzing page...</p>
    </div>
  `;
  
  const tabs = await chrome.tabs.query({});
  const targetTab = tabs.filter(t => t.url && !t.url.startsWith('chrome://'))[0];
  
  if (!targetTab?.id) {
    summaryPlaceholder.innerHTML = `
      <div class="icon">❌</div>
      <p>No webpage found to summarize</p>
    `;
    return;
  }
  
  try {
    // Send summarize message
    chrome.tabs.sendMessage(targetTab.id, { type: 'SUMMARIZE_PAGE' });
    
    // Wait for response (handled in message listener)
  } catch (error) {
    summaryPlaceholder.innerHTML = `
      <div class="icon">❌</div>
      <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      <button class="action-btn" onclick="generateSummary()">Try Again</button>
    `;
  }
}

// Listen for summary results (add to existing listener)
const existingListener = chrome.runtime.onMessage.hasListener;
if (!existingListener) {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type === 'SUMMARIZE_PAGE_RESULT') {
      const summaryPlaceholder = document.getElementById('summaryPlaceholder')!;
      const summaryContent = document.getElementById('summaryContent')!;
      
      if (message.error) {
        summaryPlaceholder.style.display = 'block';
        summaryContent.style.display = 'none';
        summaryPlaceholder.innerHTML = `
          <div class="icon">❌</div>
          <p>Error: ${message.error}</p>
          <button class="action-btn" id="retrySummaryBtn">Try Again</button>
        `;
        document.getElementById('retrySummaryBtn')?.addEventListener('click', generateSummary);
      } else {
        summaryPlaceholder.style.display = 'none';
        summaryContent.style.display = 'block';
        summaryContent.innerHTML = `
          <h3>📄 Page Summary</h3>
          <p style="white-space: pre-wrap;">${message.summary}</p>
          <button class="action-btn" style="margin-top: 16px;" id="refreshSummaryBtn">Refresh Summary</button>
        `;
        document.getElementById('refreshSummaryBtn')?.addEventListener('click', generateSummary);
      }
    }
  });
}

document.getElementById('generateSummaryBtn')?.addEventListener('click', generateSummary);

// Update page info
async function updatePageInfo() {
  const tabs = await chrome.tabs.query({});
  const targetTab = tabs.filter(t => t.url && !t.url.startsWith('chrome://'))[0];
  
  if (targetTab?.title) {
    const pageInfoEl = document.getElementById('pageInfo');
    if (pageInfoEl) {
      const title = targetTab.title.substring(0, 50) + (targetTab.title.length > 50 ? '...' : '');
      pageInfoEl.textContent = `About: ${title}`;
    }
  }
}

// Initialize
loadConversationHistory();
updatePageInfo();

console.log('Main panel loaded');

