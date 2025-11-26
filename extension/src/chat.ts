/**
 * Chat interface for AI Assistant
 */

import { ExtensionMessage } from './types';

const chatContainer = document.getElementById('chatContainer') as HTMLDivElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
const clearChatBtn = document.getElementById('clearChat') as HTMLButtonElement;

let conversationHistory: Array<{role: string, content: string}> = [];
let isProcessing = false;
let currentTabId: number | null = null;

// Load conversation history from storage
async function loadConversationHistory() {
  try {
    // Get all tabs and find non-extension tabs
    const tabs = await chrome.tabs.query({});
    const regularTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
    const targetTab = regularTabs.find(t => t.active) || regularTabs[0];
    
    if (targetTab && targetTab.id) {
      currentTabId = targetTab.id;
      console.log(`Chat window for tab ${currentTabId}: ${targetTab.title}`);
      
      const storageKey = `chat_history_${currentTabId}`;
      const result = await chrome.storage.local.get(storageKey);
      
      if (result[storageKey]) {
        conversationHistory = result[storageKey];
        console.log(`Loaded ${conversationHistory.length} messages from history`);
        
        // Restore messages in UI
        conversationHistory.forEach(msg => {
          addMessageToUI(msg.content, msg.role as 'user' | 'assistant');
        });
      }
    }
  } catch (error) {
    console.error('Error loading conversation history:', error);
  }
}

// Save conversation history to storage
async function saveConversationHistory() {
  if (currentTabId) {
    const storageKey = `chat_history_${currentTabId}`;
    await chrome.storage.local.set({ [storageKey]: conversationHistory });
  }
}

// Load history on startup
loadConversationHistory();

// Show current page info
async function updatePageInfo() {
  try {
    const tabs = await chrome.tabs.query({});
    const regularTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
    const targetTab = regularTabs.find(t => t.active) || regularTabs[0];
    
    if (targetTab && targetTab.title) {
      const pageInfoEl = document.getElementById('pageInfo');
      if (pageInfoEl) {
        const title = targetTab.title.substring(0, 50) + (targetTab.title.length > 50 ? '...' : '');
        pageInfoEl.textContent = `About: ${title}`;
        pageInfoEl.title = `${targetTab.title}\n${targetTab.url}`;
      }
    }
  } catch (error) {
    console.error('Error getting page info:', error);
  }
}

updatePageInfo();

// Quick action buttons
document.querySelectorAll('.quick-action-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const action = (e.target as HTMLButtonElement).dataset.action;
    handleQuickAction(action);
  });
});

// Handle quick actions
async function handleQuickAction(action: string | undefined) {
  if (!action) return;
  
  switch (action) {
    case 'summarize':
      await sendMessage('Please summarize this page for me.');
      break;
    case 'highlight':
      await sendMessage('Show me the most important clickable elements on this page.');
      break;
    case 'explain':
      await sendMessage('What does this page do and how do I use it?');
      break;
  }
}

// Add message to UI only (for loading history)
function addMessageToUI(content: string, type: 'user' | 'assistant' | 'system' | 'error') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = content;
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Add message to chat and save to history
function addMessage(content: string, type: 'user' | 'assistant' | 'system' | 'error') {
  addMessageToUI(content, type);
  
  // Save to history if user or assistant message
  if (type === 'user' || type === 'assistant') {
    conversationHistory.push({
      role: type === 'user' ? 'user' : 'assistant',
      content: content
    });
    saveConversationHistory();
  }
}

// Show typing indicator
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typing-indicator';
  typingDiv.innerHTML = '<span></span><span></span><span></span>';
  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Send message
async function sendMessage(message?: string) {
  const text = message || chatInput.value.trim();
  
  if (!text || isProcessing) return;
  
  isProcessing = true;
  sendBtn.disabled = true;
  chatInput.value = '';
  
  // Add user message
  addMessage(text, 'user');
  
  // Show typing indicator
  showTypingIndicator();
  
  try {
    // Get the correct tab (webpage, not chat window)
    const tabs = await chrome.tabs.query({});
    const regularTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
    const targetTab = regularTabs.find(t => t.active) || regularTabs[0];
    
    if (!targetTab || !targetTab.id) {
      throw new Error('No webpage tab found');
    }
    
    console.log(`Sending message for tab: ${targetTab.title}`);
    
    // Check if message is about navigation/finding elements (intelligent highlighting)
    const navigationKeywords = ['how', 'where', 'find', 'show', 'change', 'update', 'edit', 'go to', 'navigate', 'click', 'need'];
    const isNavigationQuery = navigationKeywords.some(keyword => text.toLowerCase().includes(keyword));
    
    if (isNavigationQuery) {
      // Trigger intelligent highlighting
      console.log('🎯 Navigation query detected, triggering intelligent highlighting');
      console.log(`   Target tab ID: ${targetTab.id}`);
      console.log(`   Query: "${text}"`);
      
      try {
        await chrome.tabs.sendMessage(targetTab.id, {
          type: 'HIGHLIGHT_ELEMENTS',
          query: text
        } as ExtensionMessage);
        
        console.log('   ✅ Highlighting message sent');
        
        // Add a note to the user
        setTimeout(() => {
          addMessage('💡 I\'ve highlighted the relevant elements on the page for you!', 'system');
        }, 1000);
      } catch (highlightError) {
        console.error('   ❌ Error sending highlight message:', highlightError);
      }
    }
    
    // Send chat message to background for AI processing
    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      message: text,
      conversationHistory: conversationHistory
    } as ExtensionMessage);
    
  } catch (error) {
    removeTypingIndicator();
    addMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    isProcessing = false;
    sendBtn.disabled = false;
  }
}

// Listen for chat responses
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'CHAT_RESPONSE') {
    removeTypingIndicator();
    
    if (message.error) {
      addMessage(`Error: ${message.error}`, 'error');
    } else {
      addMessage(message.response, 'assistant');
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
  } else if (message.type === 'SUMMARIZE_PAGE_RESULT') {
    removeTypingIndicator();
    
    if (message.error) {
      addMessage(`Error: ${message.error}`, 'error');
    } else {
      addMessage(message.summary, 'assistant');
    }
    
    isProcessing = false;
    sendBtn.disabled = false;
  }
});

// Send button click
sendBtn.addEventListener('click', () => sendMessage());

// Enter key to send
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Manual highlight button
const manualHighlightBtn = document.getElementById('manualHighlight') as HTMLButtonElement;
manualHighlightBtn?.addEventListener('click', async () => {
  // Get the last user message as the query
  const lastUserMessage = conversationHistory.slice().reverse().find(m => m.role === 'user');
  
  if (!lastUserMessage) {
    addMessage('Please ask a question first, then I can highlight the relevant elements!', 'system');
    return;
  }
  
  const tabs = await chrome.tabs.query({});
  const regularTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
  const targetTab = regularTabs.find(t => t.active) || regularTabs[0];
  
  if (targetTab && targetTab.id) {
    console.log(`🎯 Manual highlight triggered for: "${lastUserMessage.content}"`);
    
    chrome.tabs.sendMessage(targetTab.id, {
      type: 'HIGHLIGHT_ELEMENTS',
      query: lastUserMessage.content
    } as ExtensionMessage);
    
    addMessage('🎯 Analyzing page and highlighting relevant elements...', 'system');
  }
});

// Clear chat
clearChatBtn.addEventListener('click', async () => {
  // Keep only the welcome message
  chatContainer.innerHTML = `
    <div class="message system">
      👋 Hello! I can help you navigate this page, answer questions, and summarize content. What would you like to know?
    </div>
  `;
  conversationHistory = [];
  await saveConversationHistory();
});

console.log('Chat interface loaded');

