/**
 * Main Panel - Unified Interface with Tabs
 * Combines Controls, Chat, and Summary in one persistent view
 */

import { ExtensionMessage } from './types';
import { getAllDocuments, deleteDocument, getAllChunks, clearAllChunks, saveDocumentIndex } from './db';

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

// IQ Arena - Brain Games
document.getElementById('iqArenaBtn')?.addEventListener('click', () => {
  console.log('🏟️ Opening IQ Arena...');
  chrome.runtime.sendMessage({ type: 'OPEN_IQ_ARENA' });
});

// ============================================
// DATABASE TAB - Knowledge Base Management
// ============================================

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const documentsList = document.getElementById('documentsList');
const docCountEl = document.getElementById('docCount');
const chunkCountEl = document.getElementById('chunkCount');

// Load and display documents
async function loadDocuments() {
  try {
    const documents = await getAllDocuments();
    const chunks = await getAllChunks();
    
    // Update counts
    if (docCountEl) docCountEl.textContent = documents.length.toString();
    if (chunkCountEl) chunkCountEl.textContent = chunks.length.toString();
    
    // Update documents list
    if (documentsList) {
      if (documents.length === 0) {
        documentsList.innerHTML = `
          <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">
            No documents uploaded yet.<br>
            Upload .txt or .md files to get started.
          </div>
        `;
      } else {
        documentsList.innerHTML = documents.map(doc => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 10px; margin-bottom: 8px;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${doc.source_file || doc.name}
              </div>
              <div style="font-size: 10px; color: var(--text-muted);">
                ${doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'N/A'} • ${doc.chunk_count || 0} chunks
              </div>
            </div>
            <button class="delete-doc-btn" data-id="${doc.document_id || doc.id}" data-source="${doc.source_file}" style="
              background: none;
              border: none;
              color: #FF4757;
              cursor: pointer;
              padding: 4px 8px;
              font-size: 16px;
              opacity: 0.6;
              transition: opacity 0.2s;
            " title="Delete document">×</button>
          </div>
        `).join('');
        
        // Add delete handlers
        documentsList.querySelectorAll('.delete-doc-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const docId = (e.target as HTMLElement).dataset.id;
            const sourceFile = (e.target as HTMLElement).dataset.source;
            if (docId && sourceFile && confirm('Delete this document?')) {
              await deleteDocument(docId, sourceFile);
              loadDocuments();
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Error loading documents:', error);
  }
}

// Handle file upload
async function handleFileUpload(files: FileList) {
  for (const file of Array.from(files)) {
    if (!file.name.match(/\.(txt|md|json)$/i)) {
      alert(`Skipping ${file.name} - only .txt, .md, and .json files are supported`);
      continue;
    }
    
    try {
      const text = await file.text();
      
      // Send to backend for processing
      const response = await fetch('http://localhost:8000/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          source_file_name: file.name
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Save document index to IndexedDB
        if (result.document_id) {
          await saveDocumentIndex(result);
        }
        
        console.log(`✅ Uploaded ${file.name}: ${result.chunks?.length || 0} chunks`);
      } else {
        throw new Error('Backend processing failed');
      }
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      alert(`Failed to upload ${file.name}. Is the backend running?`);
    }
  }
  
  loadDocuments();
}

// Drag and drop handlers
if (dropZone) {
  dropZone.addEventListener('click', () => fileInput?.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'rgba(0, 212, 255, 0.05)';
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--glass-border)';
    dropZone.style.background = 'transparent';
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--glass-border)';
    dropZone.style.background = 'transparent';
    
    if (e.dataTransfer?.files.length) {
      handleFileUpload(e.dataTransfer.files);
    }
  });
}

fileInput?.addEventListener('change', () => {
  if (fileInput.files?.length) {
    handleFileUpload(fileInput.files);
  }
});

// Refresh button
document.getElementById('refreshDbBtn')?.addEventListener('click', () => {
  loadDocuments();
});

// Clear all button
document.getElementById('clearDbBtn')?.addEventListener('click', async () => {
  if (confirm('⚠️ This will delete ALL your documents and knowledge data.\n\nAre you sure?')) {
    await clearAllChunks();
    loadDocuments();
  }
});

// Open full options page
document.getElementById('openFullOptionsBtn')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Load documents when switching to database tab
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = (button as HTMLElement).dataset.tab;
    if (tabName === 'database') {
      loadDocuments();
    }
  });
});

// Initial load
loadDocuments();

// Chat functionality (Note: Chat UI moved to floating panel, but keeping some logic for compatibility)
let conversationHistory: Array<{role: string, content: string}> = [];
let isProcessing = false;
let currentTabId: number | null = null;
let isRecording = false;
let mediaRecorder: MediaRecorder | null = null;

// Chat elements may not exist anymore (moved to floating panel)
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput') as HTMLInputElement | null;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement | null;

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
  if (!chatMessages) return; // Chat UI moved to floating panel
  
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
  if (!chatMessages) return; // Chat UI moved to floating panel
  
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
  const text = message || chatInput?.value.trim() || '';
  if (!text || isProcessing) return;
  
  isProcessing = true;
  if (sendBtn) sendBtn.disabled = true;
  if (chatInput) chatInput.value = '';
  
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
    if (sendBtn) sendBtn.disabled = false;
  }
}

// Smart button - mic or send depending on state (only if chat UI exists)
if (sendBtn) {
  sendBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else if (chatInput?.value.trim()) {
      sendMessage();
    } else {
      startRecording();
    }
  });
}

// Update button on input (only if chat UI exists)
if (chatInput) {
  chatInput.addEventListener('input', () => {
    updateSendButton();
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() && !isRecording) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Message listener moved to bottom with memory handlers

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
      if (chatMessages) {
        chatMessages.innerHTML = '<div class="chat-message system">👋 Hello! I can help you navigate this page, answer questions, and find information. What would you like to know?</div>';
      }
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

// Voice recording functions - Modern SVG icons like docked version
function updateSendButton() {
  if (!sendBtn) return; // Chat UI moved to floating panel
  
  const micIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
  const sendIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
  const stopIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;
  
  if (isRecording) {
    sendBtn.innerHTML = stopIcon;
    sendBtn.style.background = 'linear-gradient(135deg, #FF4757, #FF006E)';
    sendBtn.style.boxShadow = '0 0 20px rgba(255, 71, 87, 0.5)';
    sendBtn.style.animation = 'pulse 1.5s infinite';
  } else if (chatInput?.value.trim()) {
    sendBtn.innerHTML = sendIcon;
    sendBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--accent))';
    sendBtn.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.3)';
    sendBtn.style.animation = 'none';
  } else {
    sendBtn.innerHTML = micIcon;
    sendBtn.style.background = 'linear-gradient(135deg, var(--primary), var(--accent))';
    sendBtn.style.boxShadow = '0 4px 15px rgba(0, 212, 255, 0.3)';
    sendBtn.style.animation = 'none';
  }
}

async function startRecording() {
  if (!chatInput) return; // Chat UI moved to floating panel
  
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
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.placeholder = 'Ask me anything about this page...';
    }
  }
}

async function transcribeAudio(audioBlob: Blob) {
  if (!chatInput) return; // Chat UI moved to floating panel
  
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

// ============================================
// HELP & ABOUT MODALS
// ============================================

document.getElementById('helpBtn')?.addEventListener('click', () => showHelpModal());
document.getElementById('aboutBtn')?.addEventListener('click', () => showAboutModal());

function showHelpModal() {
  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;';
  
  modal.innerHTML = `
    <div style="background: #0A0A0F; border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 16px; width: 100%; max-height: 90%; overflow: hidden; display: flex; flex-direction: column;">
      <div style="background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(139, 92, 246, 0.1)); padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <span style="font-weight: 600; color: #00D4FF;">Help & Features</span>
        </div>
        <button id="close-help" style="background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 20px;">×</button>
      </div>
      <div style="padding: 16px; overflow-y: auto; flex: 1;">
        <div style="background: rgba(24,24,32,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
          <div style="font-weight: 600; color: #00D4FF; margin-bottom: 6px; font-size: 13px;">📝 Smart Form Auto-Fill</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5;">AI fills forms using your uploaded documents. Upload docs in Knowledge Base, then click "Auto-Fill Entire Page".</div>
        </div>
        <div style="background: rgba(24,24,32,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
          <div style="font-weight: 600; color: #00D4FF; margin-bottom: 6px; font-size: 13px;">💬 AI Chat Assistant</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5;">Ask questions about any page. The AI reads and understands the current page content.</div>
        </div>
        <div style="background: rgba(24,24,32,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
          <div style="font-weight: 600; color: #00D4FF; margin-bottom: 6px; font-size: 13px;">🧠 Web Memory</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5;">Remembers every site you visit. Ask "What was that vacation site about Finland?" to find it.</div>
        </div>
        <div style="background: rgba(24,24,32,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; margin-bottom: 10px;">
          <div style="font-weight: 600; color: #00D4FF; margin-bottom: 6px; font-size: 13px;">✨ Element Highlighting</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5;">Highlights important buttons/links. Ask "Where do I click to..." for smart highlighting.</div>
        </div>
        <div style="background: rgba(24,24,32,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px;">
          <div style="font-weight: 600; color: #00D4FF; margin-bottom: 6px; font-size: 13px;">📄 Page Summarization</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5;">Get AI summaries of any page. Click "Summarize" in Chat tab.</div>
        </div>
        <div style="margin-top: 14px; padding: 12px; background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(139,92,246,0.1)); border-radius: 10px; font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.6;">
          💡 <strong style="color: #00D4FF;">Pro Tip:</strong> All data is stored locally in your browser - private & secure!
        </div>
      </div>
      <div style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button id="help-got-it" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer;">Got it! 👍</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const close = () => modal.remove();
  modal.querySelector('#close-help')?.addEventListener('click', close);
  modal.querySelector('#help-got-it')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

function showAboutModal() {
  const modal = document.createElement('div');
  modal.id = 'about-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;';
  
  const year = new Date().getFullYear();
  
  modal.innerHTML = `
    <div style="background: #0A0A0F; border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 16px; width: 100%; text-align: center; overflow: hidden;">
      <div style="padding: 30px 20px; background: linear-gradient(180deg, rgba(0, 212, 255, 0.15) 0%, transparent 100%);">
        <div style="width: 60px; height: 60px; margin: 0 auto 16px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 30px rgba(0, 212, 255, 0.4);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        </div>
        <h2 style="margin: 0 0 4px 0; font-size: 20px; background: linear-gradient(135deg, #fff, #00D4FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">AutoThink</h2>
        <div style="font-size: 12px; color: rgba(255,255,255,0.5);">Version 1.1.0 • Web Memory Edition</div>
      </div>
      <div style="padding: 20px;">
        <div style="background: rgba(24,24,32,0.8); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 6px;">Created by</div>
          <div style="font-size: 18px; font-weight: 700; background: linear-gradient(135deg, #00D4FF, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Vitaly Grosman</div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px;">Software Engineer & AI Enthusiast</div>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <div style="flex: 1; background: rgba(24,24,32,0.8); border-radius: 10px; padding: 12px;">
            <div style="font-size: 18px;">🔒</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 4px;">Privacy First</div>
          </div>
          <div style="flex: 1; background: rgba(24,24,32,0.8); border-radius: 10px; padding: 12px;">
            <div style="font-size: 18px;">⚡</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 4px;">Lightning Fast</div>
          </div>
          <div style="flex: 1; background: rgba(24,24,32,0.8); border-radius: 10px; padding: 12px;">
            <div style="font-size: 18px;">🧠</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 4px;">AI Powered</div>
          </div>
        </div>
        <div style="font-size: 10px; color: rgba(255,255,255,0.3); margin-bottom: 16px;">© ${year} Vitaly Grosman. All rights reserved.</div>
        <button id="about-close" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #00D4FF, #8B5CF6); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer;">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const close = () => modal.remove();
  modal.querySelector('#about-close')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

// ============================================
// MEMORY TAB FUNCTIONALITY
// ============================================

const memorySearchInput = document.getElementById('memorySearchInput') as HTMLInputElement;
const memorySearchBtn = document.getElementById('memorySearchBtn') as HTMLButtonElement;
const memorySearchResults = document.getElementById('memorySearchResults') as HTMLElement;
const recentPagesList = document.getElementById('recentPagesList') as HTMLElement;
const memoryPageCount = document.getElementById('memoryPageCount') as HTMLElement;
const memoryDomainCount = document.getElementById('memoryDomainCount') as HTMLElement;
const memoryVisitCount = document.getElementById('memoryVisitCount') as HTMLElement;
const clearMemoryBtn = document.getElementById('clearMemoryBtn') as HTMLButtonElement;
const refreshMemoryBtn = document.getElementById('refreshMemoryBtn') as HTMLButtonElement;

// Load memory data on startup
loadMemoryData();

async function loadMemoryData() {
  console.log('🧠 Loading memory data...');
  
  // Request stats
  chrome.runtime.sendMessage({ type: 'GET_WEB_MEMORY_STATS' });
  
  // Request recent pages
  chrome.runtime.sendMessage({ type: 'GET_RECENT_PAGES', limit: 20 });
}

memorySearchBtn?.addEventListener('click', performMemorySearch);
memorySearchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performMemorySearch();
});

function performMemorySearch() {
  const query = memorySearchInput?.value.trim();
  if (!query) {
    if (memorySearchResults) memorySearchResults.style.display = 'none';
    return;
  }
  
  console.log('🧠 Memory search:', query);
  
  if (memorySearchResults) {
    memorySearchResults.style.display = 'block';
    memorySearchResults.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <div style="width: 24px; height: 24px; margin: 0 auto 8px; border: 2px solid rgba(0, 212, 255, 0.2); border-top-color: #00D4FF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="color: rgba(255,255,255,0.6); font-size: 11px;">Searching...</p>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
  }
  
  chrome.runtime.sendMessage({ type: 'SEARCH_WEB_MEMORY', query });
}

clearMemoryBtn?.addEventListener('click', () => {
  if (confirm('Clear all Web Memory? This cannot be undone.')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_WEB_MEMORY' });
    loadMemoryData();
  }
});

refreshMemoryBtn?.addEventListener('click', () => {
  loadMemoryData();
});

// Open full memory options
document.getElementById('openMemoryOptionsBtn')?.addEventListener('click', () => {
  // Open options page and navigate to memory tab
  chrome.runtime.openOptionsPage();
  // Note: We could pass a parameter to jump to memory tab, but for now just open options
});

// Handle recent pages response
function handleRecentPages(pages: any[]) {
  if (!recentPagesList) return;
  
  if (!pages || pages.length === 0) {
    recentPagesList.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">
        No pages in memory yet.<br>
        Browse the web and I'll remember!
      </div>
    `;
    return;
  }
  
  recentPagesList.innerHTML = pages.slice(0, 10).map(page => `
    <a href="${escapeHtml(page.url)}" target="_blank" style="
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 10px;
      margin-bottom: 8px;
      text-decoration: none;
      transition: all 0.2s;
    ">
      <img src="https://www.google.com/s2/favicons?domain=${page.domain}&sz=32" 
           style="width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;"
           onerror="this.style.display='none'">
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 11px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(page.title || 'Untitled')}
        </div>
        <div style="font-size: 10px; color: var(--text-muted);">
          ${escapeHtml(page.domain)} • ${new Date(page.visited_at).toLocaleDateString()}
        </div>
      </div>
    </a>
  `).join('');
}

function formatMemoryAnswer(text: string): string {
  let formatted = escapeHtml(text);
  // Handle bullet points
  formatted = formatted.replace(/^[-•]\s+(.+)$/gm, '<div style="margin-left: 10px; margin-bottom: 4px;">• $1</div>');
  // Handle numbered lists
  formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="margin-left: 10px; margin-bottom: 4px;"><strong style="color: #00D4FF;">$1.</strong> $2</div>');
  // Handle bold
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #00D4FF;">$1</strong>');
  // Line breaks
  formatted = formatted.replace(/\n\n/g, '</p><p style="margin-bottom: 8px;">');
  formatted = formatted.replace(/\n/g, '<br>');
  return `<p style="margin-bottom: 8px;">${formatted}</p>`;
}

function handleMemoryResult(message: any) {
  if (!memorySearchResults) return;
  
  const results = message.results || [];
  const answer = message.answer || '';
  
  memorySearchResults.style.display = 'block';
  let html = '';
  
  if (answer) {
    html += `
      <div style="background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(139, 92, 246, 0.1)); border: 1px solid rgba(0, 212, 255, 0.2); border-radius: 10px; padding: 12px; margin-bottom: 10px;">
        <div style="font-weight: 600; color: #00D4FF; margin-bottom: 6px; font-size: 11px;">🧠 AI Answer</div>
        <div style="color: rgba(255,255,255,0.9); font-size: 11px; line-height: 1.5;">${formatMemoryAnswer(answer)}</div>
      </div>
    `;
  }
  
  if (results.length > 0) {
    html += `<div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-bottom: 8px;">Found ${results.length} page${results.length > 1 ? 's' : ''}:</div>`;
    
    for (const result of results.slice(0, 5)) {
      const date = new Date(result.visited_at).toLocaleDateString();
      html += `
        <a href="${escapeHtml(result.url)}" target="_blank" style="display: block; background: rgba(24,24,32,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; text-decoration: none; margin-bottom: 6px; transition: all 0.2s;">
          <div style="font-weight: 500; color: #fff; font-size: 11px; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(result.title)}</div>
          <div style="font-size: 9px; color: #00D4FF;">${escapeHtml(result.domain)} • ${date}</div>
        </a>
      `;
    }
  } else if (!answer) {
    html = '<div style="text-align: center; padding: 16px;"><p style="color: rgba(255,255,255,0.6); font-size: 11px;">No matching websites found</p></div>';
  }
  
  memorySearchResults.innerHTML = html;
}

function handleMemoryStats(stats: any) {
  // Update stat counters
  if (memoryPageCount) memoryPageCount.textContent = stats.totalPages?.toString() || '0';
  if (memoryDomainCount) memoryDomainCount.textContent = stats.uniqueDomains?.toString() || '0';
  if (memoryVisitCount) memoryVisitCount.textContent = stats.totalVisits?.toString() || '0';
  
  // Also load recent pages when we get stats
  if (stats.recentPages) {
    handleRecentPages(stats.recentPages);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// SMART BOOKMARKS TAB FUNCTIONALITY
// ============================================

const bookmarkSearchInput = document.getElementById('bookmarkSearchInput') as HTMLInputElement;
const bookmarkSearchBtn = document.getElementById('bookmarkSearchBtn') as HTMLButtonElement;
const bookmarkResults = document.getElementById('bookmarkResults') as HTMLElement;
const bookmarkStats = document.getElementById('bookmarkStats') as HTMLElement;
const bookmarkMinRating = document.getElementById('bookmarkMinRating') as HTMLSelectElement;
const bookmarkCategoryFilter = document.getElementById('bookmarkCategoryFilter') as HTMLSelectElement;
const manageBookmarksBtn = document.getElementById('manageBookmarksBtn') as HTMLButtonElement;

// Load bookmark stats on startup
chrome.runtime.sendMessage({ type: 'GET_BOOKMARK_STATS' });
// Load all bookmarks initially
chrome.runtime.sendMessage({ type: 'SEARCH_BOOKMARKS' });

bookmarkSearchBtn?.addEventListener('click', performBookmarkSearch);
bookmarkSearchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performBookmarkSearch();
});

bookmarkMinRating?.addEventListener('change', performBookmarkSearch);
bookmarkCategoryFilter?.addEventListener('change', performBookmarkSearch);

function performBookmarkSearch() {
  const query = bookmarkSearchInput?.value.trim() || '';
  const minRating = bookmarkMinRating?.value ? parseInt(bookmarkMinRating.value) : undefined;
  const category = bookmarkCategoryFilter?.value || undefined;
  
  console.log('🔖 Bookmark search:', { query, minRating, category });
  
  if (bookmarkResults) {
    bookmarkResults.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="width: 40px; height: 40px; margin: 0 auto 16px; border: 3px solid rgba(0, 212, 255, 0.2); border-top-color: #00D4FF; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="color: rgba(255,255,255,0.6); font-size: 13px;">Searching bookmarks...</p>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
  }
  
  chrome.runtime.sendMessage({ 
    type: 'SEARCH_BOOKMARKS', 
    query: query || undefined,
    minRating,
    categories: category ? [category] : undefined
  });
}

manageBookmarksBtn?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function handleBookmarksResult(message: any) {
  if (!bookmarkResults) return;
  
  const bookmarks = message.bookmarks || [];
  const answer = message.answer || '';
  
  let html = '';
  
  if (answer) {
    html += `
      <div style="background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(139, 92, 246, 0.1)); border: 1px solid rgba(0, 212, 255, 0.2); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
        <div style="font-weight: 600; color: #00D4FF; margin-bottom: 8px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          AI Search
        </div>
        <div style="color: rgba(255,255,255,0.9); font-size: 12px; line-height: 1.5;">${escapeHtml(answer)}</div>
      </div>
    `;
  }
  
  if (bookmarks.length > 0) {
    html += `<div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-bottom: 10px;">${bookmarks.length} bookmark${bookmarks.length > 1 ? 's' : ''}</div>`;
    
    for (const bookmark of bookmarks) {
      const date = new Date(bookmark.bookmarked_at).toLocaleDateString();
      const categories = bookmark.categories.length > 0 
        ? bookmark.categories.slice(0, 3).join(', ') 
        : 'Uncategorized';
      
      html += `
        <a href="${escapeHtml(bookmark.url)}" target="_blank" style="display: block; background: rgba(24,24,32,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; text-decoration: none; margin-bottom: 8px; transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="font-weight: 600; color: #fff; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${escapeHtml(bookmark.title)}</div>
            <div style="font-size: 11px; color: #00FF88; font-weight: 600; margin-left: 8px; white-space: nowrap;">${bookmark.rating}/10</div>
          </div>
          <div style="font-size: 10px; color: #00D4FF; margin-bottom: 4px;">${escapeHtml(bookmark.domain)}</div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 6px;">${escapeHtml(categories)}</div>
          ${bookmark.ai_summary ? `<div style="font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(bookmark.ai_summary)}</div>` : ''}
          ${bookmark.comment ? `<div style="font-size: 10px; color: rgba(139, 92, 246, 0.8); margin-top: 6px; font-style: italic;">"${escapeHtml(bookmark.comment)}"</div>` : ''}
          <div style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 6px;">Saved ${date}</div>
        </a>
      `;
    }
  } else if (!answer) {
    html = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 40px; margin-bottom: 12px;">🔖</div>
        <p style="color: rgba(255,255,255,0.6); font-size: 13px;">No bookmarks found</p>
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 8px;">Click the bookmark button on any page to add one!</p>
      </div>
    `;
  }
  
  bookmarkResults.innerHTML = html;
}

function handleBookmarkStats(stats: any) {
  if (!bookmarkStats) return;
  
  if (stats.totalBookmarks === 0) {
    bookmarkStats.innerHTML = '<span style="color: rgba(255,255,255,0.5);">📊 No bookmarks yet</span>';
  } else {
    bookmarkStats.innerHTML = `
      <span style="color: #00D4FF;">📊 ${stats.totalBookmarks} bookmarks</span> • 
      <span style="color: rgba(255,255,255,0.5);">${stats.uniqueDomains} domains</span> •
      <span style="color: #00FF88;">Avg: ${stats.averageRating}/10</span>
    `;
  }
  
  // Update category filter dropdown
  if (bookmarkCategoryFilter && stats.categories) {
    const currentValue = bookmarkCategoryFilter.value;
    bookmarkCategoryFilter.innerHTML = '<option value="">All Categories</option>';
    for (const cat of stats.categories) {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      bookmarkCategoryFilter.appendChild(option);
    }
    bookmarkCategoryFilter.value = currentValue;
  }
}

// Update message listener to handle bookmark messages
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === 'CHAT_RESPONSE') {
    removeTypingIndicator();
    if ((message as any).error) {
      addMessage('Error: ' + (message as any).error, 'system');
    } else {
      addMessage((message as any).response, 'assistant');
    }
    isProcessing = false;
    if (sendBtn) sendBtn.disabled = false;
  } else if (message.type === 'WEB_MEMORY_RESULT') {
    handleMemoryResult(message);
  } else if (message.type === 'WEB_MEMORY_STATS_RESULT') {
    handleMemoryStats((message as any).stats);
  } else if (message.type === 'RECENT_PAGES_RESULT') {
    handleRecentPages((message as any).pages);
  } else if (message.type === 'BOOKMARKS_RESULT') {
    handleBookmarksResult(message);
  } else if (message.type === 'BOOKMARK_STATS_RESULT') {
    handleBookmarkStats((message as any).stats);
  }
});

// Remove the old listener that was just for chat/memory
// (We replaced it with the combined one above)

// Initialize
loadConversationHistory();
updatePageInfo();
updateSendButton();

console.log('Main panel loaded');

