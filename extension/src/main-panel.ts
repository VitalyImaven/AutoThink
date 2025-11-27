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
document.getElementById('highlightBtn')?.addEventListener('click', async () => {
  console.log('✨ Highlight button clicked');
  
  // Get current window and find regular tabs
  const currentWindow = await chrome.windows.getCurrent();
  const allWindows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  
  const browserWindows = allWindows.filter(w => 
    w.id !== currentWindow.id && 
    w.tabs && 
    w.tabs.length > 0
  );
  
  if (browserWindows.length === 0) {
    alert('⚠️ No browser window found.\n\nPlease open a webpage first.');
    return;
  }
  
  const browserWindow = browserWindows.find(w => w.focused) || browserWindows[0];
  const activeTab = browserWindow.tabs?.find(t => t.active);
  
  if (activeTab?.id) {
    console.log('   Sending HIGHLIGHT_ELEMENTS to tab', activeTab.id);
    chrome.tabs.sendMessage(activeTab.id, {
      type: 'HIGHLIGHT_ELEMENTS',
      query: 'important interactive elements like buttons, links, and form inputs'
    });
  }
});

document.getElementById('autoFillBtn')?.addEventListener('click', async () => {
  console.log('🤖 Auto-Fill button clicked');
  
  try {
    // Get current window and find regular tabs
    const currentWindow = await chrome.windows.getCurrent();
    const allWindows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    
    const browserWindows = allWindows.filter(w => 
      w.id !== currentWindow.id && 
      w.tabs && 
      w.tabs.length > 0
    );
    
    if (browserWindows.length === 0) {
      alert('⚠️ No browser window found.\n\nPlease open a webpage first.');
      return;
    }
    
    const browserWindow = browserWindows.find(w => w.focused) || browserWindows[0];
    const activeTab = browserWindow.tabs?.find(t => t.active);
    
    console.log('   Target tab:', activeTab?.title);
    
    if (!activeTab?.id || !activeTab.url) {
      alert('⚠️ No active tab found.');
      return;
    }
    
    if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')) {
      alert('⚠️ Cannot auto-fill Chrome system pages.\n\nPlease navigate to a regular website first.');
      return;
    }
    
    console.log('   Sending AUTO_FILL_PAGE to tab', activeTab.id);
    
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'AUTO_FILL_PAGE' });
      console.log('   ✅ Message sent successfully');
    } catch (error) {
      console.error('   ❌ Content script not ready:', error);
      
      // Try to inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });
        
        // Wait and retry
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(activeTab.id!, { type: 'AUTO_FILL_PAGE' });
            console.log('   ✅ Message sent after injection');
          } catch (retryError) {
            alert('⚠️ Could not start auto-fill.\n\nPlease refresh the page and try again.');
          }
        }, 500);
      } catch (injectError) {
        alert('⚠️ Cannot inject on this page.\n\nSome pages block extensions. Try refreshing the page.');
      }
    }
  } catch (error) {
    console.error('Error in auto-fill:', error);
    alert('⚠️ An error occurred. Please try again.');
  }
});

document.getElementById('openOptionsBtn')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Chat functionality
let conversationHistory: Array<{role: string, content: string}> = [];
let isProcessing = false;
let currentTabId: number | null = null;
let isRecording = false;
let mediaRecorder: MediaRecorder | null = null;

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

function formatMessage(content: string): string {
  // Convert markdown-like formatting to HTML
  let formatted = content;
  
  // Handle bullet points (lines starting with - or •)
  formatted = formatted.replace(/^- (.+)$/gm, '<div style="margin-left: 12px; margin-bottom: 4px;">• $1</div>');
  formatted = formatted.replace(/^• (.+)$/gm, '<div style="margin-left: 12px; margin-bottom: 4px;">• $1</div>');
  
  // Handle numbered lists (lines starting with numbers)
  formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="margin-left: 12px; margin-bottom: 4px;"><strong>$1.</strong> $2</div>');
  formatted = formatted.replace(/^(\d+)\)\s+(.+)$/gm, '<div style="margin-left: 12px; margin-bottom: 4px;"><strong>$1)</strong> $2</div>');
  
  // Handle bold text (wrapped in ** or __)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Handle italic text (wrapped in * or _)
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Handle headers (lines ending with :)
  formatted = formatted.replace(/^([A-Z][^:]+):$/gm, '<div style="font-weight: 600; margin-top: 12px; margin-bottom: 6px; color: #667eea;">$1:</div>');
  
  // Handle sections with dashes
  formatted = formatted.replace(/^—\s*(.+)$/gm, '<div style="margin-left: 16px; margin-bottom: 4px;">— $1</div>');
  
  // Convert line breaks to proper HTML
  formatted = formatted.split('\n\n').map(para => {
    if (para.includes('<div')) {
      return para; // Already has divs, don't wrap
    }
    return `<p style="margin-bottom: 8px; line-height: 1.5;">${para.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  
  return formatted;
}

function addMessageToUI(content: string, type: 'user' | 'assistant' | 'system') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;
  
  if (type === 'assistant') {
    // Format assistant messages with rich HTML
    messageDiv.innerHTML = formatMessage(content);
  } else {
    // User and system messages stay as plain text
    messageDiv.textContent = content;
  }
  
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

// Smart button - mic or send depending on state
sendBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else if (chatInput.value.trim()) {
    sendMessage();
  } else {
    startRecording();
  }
});

// Update button on input
chatInput.addEventListener('input', () => {
  updateSendButton();
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim() && !isRecording) {
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

// Summary functionality removed - users can ask for summaries in chat!

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

// Toggle side panel mode
document.getElementById('toggleSidePanelBtn')?.addEventListener('click', async () => {
  try {
    console.log('🔵 Dock button clicked!');
    
    // Get THIS popup window's ID so we can exclude it
    const currentWindow = await chrome.windows.getCurrent();
    console.log('📱 This popup window ID:', currentWindow.id);
    
    // Get ALL windows including normal browser windows
    const allWindows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    console.log('🪟 Found', allWindows.length, 'total windows');
    
    // Filter out this popup window and find browser windows with tabs
    const browserWindows = allWindows.filter(w => 
      w.id !== currentWindow.id && 
      w.tabs && 
      w.tabs.length > 0
    );
    
    console.log('🪟 Browser windows (excluding popup):', browserWindows.length);
    
    if (browserWindows.length === 0) {
      console.log('❌ No browser windows found');
      alert('⚠️ No browser window found.\n\nPlease open a browser window first.');
      return;
    }
    
    // Get the first browser window (or the focused one if available)
    const browserWindow = browserWindows.find(w => w.focused) || browserWindows[0];
    console.log('🎯 Target browser window ID:', browserWindow.id);
    console.log('   Window has', browserWindow.tabs?.length, 'tabs');
    
    // Find the ACTIVE tab in that window
    const activeTab = browserWindow.tabs?.find(t => t.active);
    console.log('👁️ Active tab:', activeTab?.title, activeTab?.url);
    
    // Check if it's a valid page for extensions
    if (!activeTab || !activeTab.id || !activeTab.url) {
      console.log('❌ No active tab found');
      alert('⚠️ Cannot dock - no active tab found.');
      return;
    }
    
    // Check if it's a Chrome system page
    if (activeTab.url.startsWith('chrome://') || 
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('edge://') ||
        activeTab.url.startsWith('about:')) {
      console.log('❌ Active tab is a Chrome system page');
      alert('⚠️ Cannot dock to Chrome system pages!\n\n' +
            'Current page: ' + activeTab.url.split('/')[2] + '\n\n' +
            'Please open a regular website (like Google, GitHub, etc.) first.');
      return;
    }
    
    const tabId = activeTab.id;
    console.log('🎯 Target tab:', activeTab);
    console.log('   Tab ID:', tabId);
    console.log('   Tab URL:', activeTab.url);
    console.log('   Tab Title:', activeTab.title);
    
    console.log('📌 Sending TOGGLE_SIDE_PANEL message to tab', tabId);
    
    try {
      // Try to send message to content script
      const response = await chrome.tabs.sendMessage(tabId, { 
        type: 'TOGGLE_SIDE_PANEL'
      } as ExtensionMessage);
      
      console.log('✅ Message sent successfully, response:', response);
      
      // Wait a bit for the panel to open, then close this window
      setTimeout(() => {
        console.log('🔒 Closing window...');
        window.close();
      }, 150);
      
    } catch (error) {
      console.error('Content script not ready:', error);
      
      // Content script not loaded yet - inject it manually
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        // Wait a bit for content script to initialize
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, { 
              type: 'TOGGLE_SIDE_PANEL'
            } as ExtensionMessage);
            
            setTimeout(() => {
              window.close();
            }, 150);
          } catch (retryError) {
            alert('⚠️ Failed to dock panel.\n\nPlease refresh the page and try again.');
          }
        }, 500);
        
      } catch (injectError) {
        alert('⚠️ Cannot inject panel on this page.\n\nSome pages (like Chrome Web Store) block extensions.');
      }
    }
  } catch (error) {
    console.error('Error toggling side panel:', error);
    alert('⚠️ An error occurred. Please try again.');
  }
});

// Voice recording functions
function updateSendButton() {
  if (isRecording) {
    sendBtn.textContent = '⏹️';
    sendBtn.style.background = '#dc3545';
    sendBtn.style.animation = 'pulse 1.5s infinite';
  } else if (chatInput.value.trim()) {
    sendBtn.textContent = 'Send';
    sendBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    sendBtn.style.animation = 'none';
  } else {
    sendBtn.textContent = '🎤';
    sendBtn.style.background = '#667eea';
    sendBtn.style.animation = 'none';
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    
    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      await transcribeAudio(audioBlob);
      
      isRecording = false;
      updateSendButton();
    };
    
    recorder.start();
    mediaRecorder = recorder;
    isRecording = true;
    chatInput.placeholder = 'Recording... Click button to stop';
    chatInput.disabled = true;
    updateSendButton();
    
  } catch (error) {
    console.error('Microphone error:', error);
    alert('Could not access microphone. Please grant permission.');
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    chatInput.disabled = false;
    chatInput.placeholder = 'Ask me anything about this page...';
  }
}

async function transcribeAudio(audioBlob: Blob) {
  try {
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
    updateSendButton();
    chatInput.focus();
    
  } catch (error) {
    console.error('Transcription error:', error);
    alert('Transcription failed: ' + (error as Error).message);
  }
}

// Initialize
loadConversationHistory();
updatePageInfo();
updateSendButton();

console.log('Main panel loaded');

