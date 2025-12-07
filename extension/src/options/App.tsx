import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { saveDocumentIndex, getAllChunks, getAllDocuments, clearAllChunks, deleteDocument, getChunkCount, getDocumentCount, getAllTags, saveInterview, exportInterviewAsText, exportKnowledgeBase, importKnowledgeBase, KnowledgeBaseBackup, BackupOptions, getAllVisitedPages, getWebMemoryStats, clearWebMemory, deleteVisitedPage, VisitedPage, deleteOldPages, enforcePageLimit, deletePagesByDomain, getPagesByDomain, getVisitedPageCount, getAllBookmarks, getBookmarkCount, getBookmarkStats, deleteBookmark, clearAllBookmarks, SmartBookmark } from '../db';

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ProcessingLog {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error';
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'webmemory' | 'bookmarks'>('overview');
  const [chunks, setChunks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<SmartBookmark[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [bookmarkStats, setBookmarkStats] = useState<{totalBookmarks: number, avgRating: number, categoriesCount: number}>({totalBookmarks: 0, avgRating: 0, categoriesCount: 0});
  const [bookmarkFilter, setBookmarkFilter] = useState('');
  const [bookmarkMinRating, setBookmarkMinRating] = useState(0);
  const [bookmarkCategoryFilter, setBookmarkCategoryFilter] = useState('');
  const [bookmarkSortBy, setBookmarkSortBy] = useState('date');
  const [showBookmarkCleanup, setShowBookmarkCleanup] = useState(false);
  const [cleanupCategory, setCleanupCategory] = useState('');
  const [cleanupRating, setCleanupRating] = useState(0);
  const [cleanupDaysBookmark, setCleanupDaysBookmark] = useState(0);
  
  // Web Memory state
  const [visitedPages, setVisitedPages] = useState<VisitedPage[]>([]);
  const [webMemoryStats, setWebMemoryStats] = useState<{totalPages: number, uniqueDomains: number, totalVisits: number}>({totalPages: 0, uniqueDomains: 0, totalVisits: 0});
  const [webMemoryFilter, setWebMemoryFilter] = useState('');
  const [pagesByDomain, setPagesByDomain] = useState<Map<string, VisitedPage[]>>(new Map());
  const [viewMode, setViewMode] = useState<'list' | 'domains'>('list');
  const [displayLimit, setDisplayLimit] = useState(50);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [showCleanupOptions, setShowCleanupOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Interview state
  const [interviewProfile, setInterviewProfile] = useState<string>('me');
  const [customProfiles, setCustomProfiles] = useState<string[]>([]);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [interviewMessages, setInterviewMessages] = useState<Array<{role: string, content: string}>>([]);
  const [interviewInput, setInterviewInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interviewProcessing, setInterviewProcessing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [lastInterviewActivity, setLastInterviewActivity] = useState<Date>(new Date());
  const [pendingIndexCount, setPendingIndexCount] = useState(0);
  const inactivityTimerRef = useRef<number | null>(null);
  
  // Backup options state
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    includeDocuments: true,
    includeInterviews: true,
    includeWebMemory: true,
    includeBookmarks: true
  });
  // @ts-ignore - used by setWebMemoryPageCount
  const [_webMemoryPageCount, setWebMemoryPageCount] = useState(0);

  useEffect(() => {
    loadKnowledgeBase();
    loadWebMemory();
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const allBookmarks = await getAllBookmarks();
      const count = await getBookmarkCount();
      const stats = await getBookmarkStats();
      setBookmarks(allBookmarks.sort((a, b) => new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime()));
      setBookmarkCount(count);
      setBookmarkStats({
        totalBookmarks: stats.totalBookmarks,
        avgRating: stats.averageRating,
        categoriesCount: stats.categories.length
      });
      console.log(`Bookmarks: ${count} total`);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  };

  const loadWebMemory = async () => {
    try {
      const pages = await getAllVisitedPages();
      const stats = await getWebMemoryStats();
      const domainGroups = await getPagesByDomain();
      const pageCount = await getVisitedPageCount();
      setVisitedPages(pages.sort((a, b) => new Date(b.last_visited).getTime() - new Date(a.last_visited).getTime()));
      setWebMemoryStats(stats);
      setPagesByDomain(domainGroups);
      setWebMemoryPageCount(pageCount);
      setDisplayLimit(50); // Reset pagination on reload
      console.log(`Web Memory: ${stats.totalPages} pages, ${stats.uniqueDomains} domains`);
    } catch (error) {
      console.error('Failed to load web memory:', error);
    }
  };

  const handleDeleteOldPages = async () => {
    if (!confirm(`Delete all pages older than ${cleanupDays} days?\n\nThis cannot be undone.`)) {
      return;
    }
    try {
      const deleted = await deleteOldPages(cleanupDays);
      await loadWebMemory();
      showStatus('success', `Deleted ${deleted} old pages!`);
    } catch (error) {
      showStatus('error', 'Failed to delete old pages');
    }
  };

  const handleDeleteDomain = async (domain: string) => {
    const count = pagesByDomain.get(domain)?.length || 0;
    if (!confirm(`Delete ALL ${count} pages from ${domain}?\n\nThis cannot be undone.`)) {
      return;
    }
    try {
      const deleted = await deletePagesByDomain(domain);
      await loadWebMemory();
      showStatus('success', `Deleted ${deleted} pages from ${domain}`);
    } catch (error) {
      showStatus('error', 'Failed to delete domain pages');
    }
  };

  const handleEnforceLimit = async (limit: number) => {
    if (!confirm(`Keep only the ${limit} most recent pages?\n\nOlder pages will be deleted.`)) {
      return;
    }
    try {
      const deleted = await enforcePageLimit(limit);
      await loadWebMemory();
      showStatus('success', deleted > 0 ? `Deleted ${deleted} oldest pages!` : 'Already under limit!');
    } catch (error) {
      showStatus('error', 'Failed to enforce limit');
    }
  };

  const loadMorePages = () => {
    setDisplayLimit(prev => prev + 50);
  };

  const handleClearWebMemory = async () => {
    if (!confirm('⚠️ Clear ALL Web Memory?\n\nThis will delete all saved website data. This cannot be undone.')) {
      return;
    }
    try {
      await clearWebMemory();
      await loadWebMemory();
      showStatus('success', 'Web Memory cleared!');
    } catch (error) {
      showStatus('error', 'Failed to clear web memory');
    }
  };

  const handleDeleteVisitedPage = async (pageId: string, title: string) => {
    if (!confirm(`Delete "${title}" from Web Memory?`)) return;
    try {
      await deleteVisitedPage(pageId);
      await loadWebMemory();
      showStatus('success', `Deleted: ${title}`);
    } catch (error) {
      showStatus('error', 'Failed to delete page');
    }
  };

  const filteredPages = visitedPages.filter(page => {
    if (!webMemoryFilter) return true;
    const filter = webMemoryFilter.toLowerCase();
    return page.title.toLowerCase().includes(filter) ||
           page.url.toLowerCase().includes(filter) ||
           page.domain.toLowerCase().includes(filter) ||
           page.content.toLowerCase().includes(filter);
  });
  
  useEffect(() => {
    // Auto-scroll logs to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [processingLogs]);

  useEffect(() => {
    // Inactivity timer for auto-indexing
    if (interviewMessages.length > 0 && pendingIndexCount > 0) {
      // Clear existing timer
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      // Set new timer: 10 minutes of inactivity
      inactivityTimerRef.current = setTimeout(() => {
        console.log('⏰ 10 minutes of inactivity - auto-indexing interview...');
        autoIndexInterview('inactivity');
      }, 10 * 60 * 1000); // 10 minutes
    }
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [lastInterviewActivity, pendingIndexCount]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setProcessingLogs(prev => [...prev, {
      timestamp: new Date(),
      message,
      type
    }]);
  };

  const clearLogs = () => {
    setProcessingLogs([]);
  };

  const handleInterviewMessage = async () => {
    if (!interviewInput.trim()) return;
    
    setInterviewProcessing(true);
    const userMessage = interviewInput.trim();
    setInterviewInput('');
    
    // Add user message
    setInterviewMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Add typing indicator
    setInterviewMessages(prev => [...prev, { role: 'typing', content: '...' }]);
    
    try {
      // Call backend for AI response
      const response = await fetch(`${config.backendUrl}/interview/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: interviewProfile,
          message: userMessage,
          conversation_history: interviewMessages
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${errorText}`);
      }
      
      const result = await response.json();
      
      // Remove typing indicator and add AI response
      setInterviewMessages(prev => {
        const withoutTyping = prev.filter(m => m.role !== 'typing');
        const newMessages = [...withoutTyping, { 
          role: 'assistant', 
          content: result.response 
        }];
        
        // Auto-save after each exchange
        setTimeout(() => autoSaveInterview(newMessages), 500);
        
        // Update activity timestamp
        setLastInterviewActivity(new Date());
        
        // Increment pending count
        const newPendingCount = pendingIndexCount + 1;
        setPendingIndexCount(newPendingCount);
        
        // Auto-index after every 5 Q&A pairs (10 messages)
        if (newPendingCount >= 5) {
          console.log('✅ 5 Q&A pairs reached - auto-indexing...');
          setTimeout(() => autoIndexInterview('count'), 1000);
          setPendingIndexCount(0);
        }
        
        return newMessages;
      });
      
    } catch (error) {
      console.error('Interview error:', error);
      showStatus('error', 'Interview error: ' + (error as Error).message);
      
      // Remove typing indicator and add error
      setInterviewMessages(prev => {
        const withoutTyping = prev.filter(m => m.role !== 'typing');
        return [...withoutTyping, { 
          role: 'assistant', 
          content: '❌ Sorry, I encountered an error. Make sure the backend is running. Error: ' + (error as Error).message
        }];
      });
    } finally {
      setInterviewProcessing(false);
    }
  };

  const handleStartRecording = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Create audio blob
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Send to Whisper for transcription
        await transcribeAudio(audioBlob);
        
        setIsRecording(false);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      showStatus('info', '🎤 Recording... Click again to stop');
      
    } catch (error) {
      console.error('Microphone error:', error);
      showStatus('error', 'Could not access microphone. Please grant permission.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      showStatus('info', '⏹️ Processing audio...');
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch(`${config.backendUrl}/interview/transcribe`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const result = await response.json();
      
      // Set transcribed text as input
      setInterviewInput(result.text);
      showStatus('success', '✅ Transcribed! Click Send to submit.');
      
    } catch (error) {
      showStatus('error', 'Transcription error: ' + (error as Error).message);
    }
  };

  // @ts-ignore - kept for potential future use
  const _handleAddProfile = () => {
    if (!newProfileName.trim()) return;
    
    const profileId = newProfileName.toLowerCase().replace(/\s+/g, '-');
    setCustomProfiles(prev => [...prev, profileId]);
    setInterviewProfile(profileId);
    setNewProfileName('');
    setShowAddProfile(false);
    showStatus('success', `Added profile: ${newProfileName}`);
  };

  const autoSaveInterview = async (messages: Array<{role: string, content: string}>) => {
    try {
      // Save to LOCAL IndexedDB (user's browser storage)
      const cleanMessages = messages.filter(m => m.role !== 'typing');
      await saveInterview(interviewProfile, cleanMessages);
      
      const qaCount = Math.floor(cleanMessages.length / 2);
      console.log('💾 Auto-saved to IndexedDB:', qaCount, 'Q&A pairs');
      addLog(`💾 Auto-saved ${qaCount} Q&A pairs locally (browser storage)`, 'success');
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  };

  // @ts-ignore - kept for potential future use
  const _handleExportInterview = async () => {
    try {
      // Export from LOCAL IndexedDB
      const text = await exportInterviewAsText(interviewProfile);
      
      // Download as file to user's Downloads folder
      const blob = new Blob([text], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${interviewProfile}_profile.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showStatus('success', `Exported ${interviewProfile} profile to Downloads folder!`);
      addLog(`📥 Downloaded ${interviewProfile}_profile.txt to your Downloads folder`, 'success');
    } catch (error) {
      showStatus('error', 'Export failed: ' + (error as Error).message);
    }
  };

  const autoIndexInterview = async (trigger: 'count' | 'inactivity') => {
    try {
      const triggerText = trigger === 'count' ? '5 Q&A pairs completed' : '10 minutes of inactivity';
      console.log(`🤖 Auto-indexing triggered by: ${triggerText}`);
      
      addLog(`🤖 Auto-indexing ${interviewProfile} profile (${triggerText})...`, 'info');
      showStatus('info', `Auto-indexing ${interviewProfile} profile...`);
      
      // Get interview text from LOCAL IndexedDB
      const text = await exportInterviewAsText(interviewProfile);
      
      // Upload to backend for AI processing and indexing
      const uploadResponse = await fetch(`${config.backendUrl}/upload/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_file_name: `${interviewProfile}_interview.txt`,
          text: text
        })
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await uploadResponse.json();
      
      addLog(`  ✅ Auto-indexed! ${result.document_index.chunk_count} chunks created`, 'success');
      
      // Save to IndexedDB for auto-fill
      await saveDocumentIndex(result.document_index);
      await loadKnowledgeBase();
      
      showStatus('success', `✨ ${interviewProfile} profile auto-indexed and ready for auto-fill!`);
    } catch (error) {
      console.error('Auto-index error:', error);
      addLog(`⚠️ Auto-index failed: ${(error as Error).message}`, 'error');
    }
  };

  // @ts-ignore - kept for potential future use
  const _handleUploadInterviewToKB = async () => {
    // Manual upload - same as auto-index but with different messaging
    try {
      addLog(`📤 Manually indexing ${interviewProfile} interview...`, 'info');
      
      const text = await exportInterviewAsText(interviewProfile);
      
      const uploadResponse = await fetch(`${config.backendUrl}/upload/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_file_name: `${interviewProfile}_interview.txt`,
          text: text
        })
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await uploadResponse.json();
      
      addLog(`  ✅ Indexed! ${result.document_index.chunk_count} chunks, ${result.document_index.all_tags.length} tags`, 'success');
      
      await saveDocumentIndex(result.document_index);
      await loadKnowledgeBase();
      
      // Reset pending count since we just indexed
      setPendingIndexCount(0);
      
      showStatus('success', `${interviewProfile} profile indexed!`);
    } catch (error) {
      addLog(`❌ Index failed: ${(error as Error).message}`, 'error');
      showStatus('error', 'Indexing failed: ' + (error as Error).message);
    }
  };

  const loadKnowledgeBase = async () => {
    setLoading(true);
    try {
      const allChunks = await getAllChunks();
      const allDocs = await getAllDocuments();
      const tags = await getAllTags();
      const chunkCnt = await getChunkCount();
      const docCnt = await getDocumentCount();
      
      setChunks(allChunks);
      setDocuments(allDocs);
      setAllTags(tags);
      setChunkCount(chunkCnt);
      setDocumentCount(docCnt);
      
      console.log(`Loaded: ${docCnt} documents, ${chunkCnt} chunks, ${tags.length} unique tags`);
    } catch (error) {
      showStatus('error', 'Failed to load knowledge base: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    clearLogs();
    let successCount = 0;
    let errorCount = 0;

    const supportedTypes = [
      '.txt', '.md', '.pdf', '.docx', '.doc', 
      '.xlsx', '.xls', '.json', '.xml', '.pptx', '.ppt'
    ];

    addLog(`📤 Starting upload of ${files.length} file(s)...`, 'info');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();

      addLog(`\n[${i + 1}/${files.length}] Processing: ${file.name}`, 'info');

      // Check file type
      const isSupported = supportedTypes.some(ext => fileName.endsWith(ext));
      if (!isSupported) {
        addLog(`  ❌ Unsupported file type. Skipping.`, 'error');
        errorCount++;
        continue;
      }

      try {
        addLog(`  📤 Uploading to backend...`, 'info');
        showStatus('info', `📤 Uploading ${file.name} (${i + 1}/${files.length})...`);
        
        // Small delay to ensure UI updates
        await new Promise(resolve => setTimeout(resolve, 50));

        // Create form data for file upload
        const formData = new FormData();
        formData.append('file', file);

        // Call backend to upload and process
        const response = await fetch(`${config.backendUrl}/upload/file`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        addLog(`  ⚙️ Analyzing document with AI...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        addLog(`  ⏳ This may take 30-60 seconds for semantic analysis...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        showStatus('info', `⚙️ AI processing ${file.name}...`);

        // Add progress dots during long wait
        const progressInterval = setInterval(() => {
          addLog(`     Still processing... (AI analyzing content)`, 'info');
        }, 5000); // Every 5 seconds

        const result = await response.json();
        
        clearInterval(progressInterval);

        addLog(`  🧠 Discovered ${result.document_index.discovered_topics.length} topics`, 'success');
        await new Promise(resolve => setTimeout(resolve, 30));
        
        addLog(`  🏷️ Generated ${result.document_index.all_tags.length} semantic tags`, 'success');
        await new Promise(resolve => setTimeout(resolve, 30));
        
        addLog(`  📦 Created ${result.document_index.chunk_count} knowledge chunks`, 'success');
        await new Promise(resolve => setTimeout(resolve, 30));
        
        addLog(`  💾 Saving to local IndexedDB...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 30));

        // Save document index to IndexedDB (with discovered topics and chunks!)
        await saveDocumentIndex(result.document_index);

        successCount++;
        addLog(`  ✅ Successfully processed ${file.name}!`, 'success');
        showStatus('success', `✓ ${file.name} processed!`);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        errorCount++;
        addLog(`  ❌ Error: ${(error as Error).message}`, 'error');
        showStatus('error', `Failed: ${file.name}`);
      }
    }

    setUploading(false);
    addLog(`\n📊 Upload Complete: ${successCount} succeeded, ${errorCount} failed`, successCount > 0 ? 'success' : 'error');

    // Reload knowledge base
    await loadKnowledgeBase();

    // Show summary
    if (successCount > 0) {
      showStatus(
        'success',
        `🎉 Successfully uploaded ${successCount} file(s)! ${errorCount > 0 ? `${errorCount} failed.` : ''}`
      );
    } else if (errorCount > 0) {
      showStatus('error', `❌ All ${errorCount} file(s) failed to upload.`);
    }
  };


  const handleDeleteDocument = async (documentId: string, sourceFile: string) => {
    if (!confirm(`Delete "${sourceFile}"?\n\nThis will remove the document and all its chunks. This cannot be undone.`)) {
      return;
    }

    try {
      addLog(`🗑️ Deleting document: ${sourceFile}`, 'info');
      await deleteDocument(documentId, sourceFile);
      await loadKnowledgeBase();
      addLog(`✅ Successfully deleted ${sourceFile}`, 'success');
      showStatus('success', `Deleted ${sourceFile}`);
    } catch (error) {
      addLog(`❌ Failed to delete ${sourceFile}: ${(error as Error).message}`, 'error');
      showStatus('error', 'Failed to delete document: ' + (error as Error).message);
    }
  };

  const handleClearKnowledgeBase = async () => {
    // Double confirmation for safety
    const firstConfirm = confirm(
      '⚠️ WARNING: Clear ALL Knowledge Base?\n\n' +
      'This will permanently delete:\n' +
      `• ${documentCount} document(s)\n` +
      `• ${chunkCount} knowledge chunk(s)\n` +
      `• All semantic tags\n\n` +
      '💡 TIP: Click "Backup" first to save your data!\n\n' +
      'Are you sure you want to continue?'
    );
    
    if (!firstConfirm) return;
    
    const secondConfirm = confirm(
      '🚨 FINAL CONFIRMATION\n\n' +
      'Type "DELETE" mentally and click OK to confirm.\n\n' +
      'This action CANNOT be undone!'
    );
    
    if (!secondConfirm) return;

    try {
      addLog('🗑️ Clearing entire knowledge base...', 'info');
      await clearAllChunks();
      await loadKnowledgeBase();
      addLog('✅ Knowledge base cleared', 'success');
      showStatus('info', 'Knowledge base cleared');
    } catch (error) {
      addLog(`❌ Error clearing knowledge base: ${(error as Error).message}`, 'error');
      showStatus('error', 'Failed to clear knowledge base: ' + (error as Error).message);
    }
  };

  // Backup knowledge base to JSON file with options
  const handleBackupKnowledgeBase = async () => {
    try {
      // Check if at least one option is selected
      if (!backupOptions.includeDocuments && !backupOptions.includeInterviews && !backupOptions.includeWebMemory && !backupOptions.includeBookmarks) {
        showStatus('error', 'Please select at least one item to backup');
        return;
      }
      
      addLog('📦 Creating backup...', 'info');
      showStatus('info', 'Creating backup...');
      
      const backup = await exportKnowledgeBase(backupOptions);
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-autofill-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Build summary message
      const parts = [];
      if (backup.documents.length > 0) parts.push(`${backup.documents.length} documents`);
      if (backup.chunks.length > 0) parts.push(`${backup.chunks.length} chunks`);
      if (backup.interviews.length > 0) parts.push(`${backup.interviews.length} interviews`);
      if (backup.webMemory && backup.webMemory.length > 0) parts.push(`${backup.webMemory.length} web pages`);
      
      const summary = parts.length > 0 ? parts.join(', ') : 'empty backup';
      addLog(`✅ Backup created: ${summary}`, 'success');
      showStatus('success', `Backup saved! ${summary}`);
    } catch (error) {
      addLog(`❌ Backup failed: ${(error as Error).message}`, 'error');
      showStatus('error', 'Backup failed: ' + (error as Error).message);
    }
  };

  // Restore knowledge base from JSON file
  const handleRestoreKnowledgeBase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      addLog(`📥 Restoring from ${file.name}...`, 'info');
      showStatus('info', `Restoring from ${file.name}...`);
      
      const text = await file.text();
      const backup: KnowledgeBaseBackup = JSON.parse(text);
      
      // Validate - version is required, but allow empty arrays for selective backups
      if (!backup.version) {
        throw new Error('Invalid backup file format');
      }
      
      const result = await importKnowledgeBase(backup);
      await loadKnowledgeBase();
      await loadWebMemory(); // Also reload web memory if restored
      
      // Build summary message
      const parts = [];
      if (result.documents > 0) parts.push(`${result.documents} documents`);
      if (result.chunks > 0) parts.push(`${result.chunks} chunks`);
      if (result.interviews > 0) parts.push(`${result.interviews} interviews`);
      if (result.webPages > 0) parts.push(`${result.webPages} web pages`);
      
      const summary = parts.length > 0 ? parts.join(', ') : 'nothing to restore';
      addLog(`✅ Restored: ${summary}`, 'success');
      showStatus('success', `Restored: ${summary}`);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      addLog(`❌ Restore failed: ${(error as Error).message}`, 'error');
      showStatus('error', 'Restore failed: ' + (error as Error).message);
      event.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <h1>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#gradient1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        AI Smart Autofill - Knowledge Base
      </h1>
      <p className="subtitle">
        Build your AI-powered knowledge base through documents or interactive interviews
      </p>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0', 
        marginBottom: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px 12px 0 0',
        padding: '0 8px'
      }}>
        <button
          onClick={() => setActiveTab('overview')}
          className={activeTab === 'overview' ? 'tab-button active' : 'tab-button'}
          style={{
            padding: '14px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'overview' ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.3s',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          Overview
        </button>
        <button
          onClick={() => setActiveTab('personal')}
          className={activeTab === 'personal' ? 'tab-button active' : 'tab-button'}
          style={{
            padding: '14px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'personal' ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.3s',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Personal Data
        </button>
        <button
          onClick={() => { setActiveTab('webmemory'); loadWebMemory(); }}
          className={activeTab === 'webmemory' ? 'tab-button active' : 'tab-button'}
          style={{
            padding: '14px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'webmemory' ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.3s',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
          Web Memory
        </button>
        <button
          onClick={() => { setActiveTab('bookmarks'); loadBookmarks(); }}
          className={activeTab === 'bookmarks' ? 'tab-button active' : 'tab-button'}
          style={{
            padding: '14px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'bookmarks' ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.3s',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          Bookmarks
        </button>
      </div>

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Knowledge Base Stats */}
          <div className="section">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
              Knowledge Base Overview
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginTop: '16px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#00D4FF' }}>{documentCount}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Documents</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(0, 212, 255, 0.1))',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#8B5CF6' }}>{chunkCount}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Knowledge Chunks</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(0, 212, 255, 0.1))',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#22C55E' }}>{allTags.length}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Semantic Tags</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.1), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(251, 146, 60, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#FB923C' }}>{webMemoryStats.totalPages}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Web Memories</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(251, 146, 60, 0.1))',
                border: '1px solid rgba(236, 72, 153, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#EC4899' }}>{bookmarkCount}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Bookmarks</div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(34, 197, 94, 0.1))',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#06B6D4' }}>{webMemoryStats.uniqueDomains}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Unique Domains</div>
              </div>
            </div>
          </div>

          {/* Backup & Restore Section */}
          <div className="section">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Backup & Restore
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
              Export your knowledge base to a file or restore from a previous backup.
            </p>
            
            {/* Backup Options */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '12px', color: 'rgba(255,255,255,0.8)' }}>
                Select data to include in backup:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input 
                    type="checkbox" 
                    checked={backupOptions.includeDocuments} 
                    onChange={(e) => setBackupOptions({...backupOptions, includeDocuments: e.target.checked})}
                    style={{ accentColor: '#00D4FF' }}
                  />
                  <span>Documents ({documentCount})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input 
                    type="checkbox" 
                    checked={backupOptions.includeInterviews} 
                    onChange={(e) => setBackupOptions({...backupOptions, includeInterviews: e.target.checked})}
                    style={{ accentColor: '#00D4FF' }}
                  />
                  <span>Interviews</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input 
                    type="checkbox" 
                    checked={backupOptions.includeWebMemory} 
                    onChange={(e) => setBackupOptions({...backupOptions, includeWebMemory: e.target.checked})}
                    style={{ accentColor: '#00D4FF' }}
                  />
                  <span>Web Memory ({webMemoryStats.totalPages})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input 
                    type="checkbox" 
                    checked={backupOptions.includeBookmarks} 
                    onChange={(e) => setBackupOptions({...backupOptions, includeBookmarks: e.target.checked})}
                    style={{ accentColor: '#00D4FF' }}
                  />
                  <span>Bookmarks ({bookmarkCount})</span>
                </label>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleBackupKnowledgeBase}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Export Backup
              </button>
              <label className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Import Backup
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleRestoreKnowledgeBase}
                />
              </label>
              <button 
                className="btn btn-secondary" 
                onClick={loadKnowledgeBase}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Refresh Stats
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="section" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <h2 style={{ color: '#EF4444' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" style={{marginRight: '8px'}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Danger Zone
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
              These actions are permanent and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button 
                className="btn"
                onClick={() => {
                  if (confirm('⚠️ Delete ALL documents and chunks?\n\nThis cannot be undone!')) {
                    clearAllChunks().then(() => {
                      loadKnowledgeBase();
                      showStatus('success', 'All documents cleared');
                    });
                  }
                }}
                style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444'
                }}
              >
                Clear Documents
              </button>
              <button 
                className="btn"
                onClick={() => {
                  if (confirm('⚠️ Delete ALL web memory?\n\nThis cannot be undone!')) {
                    clearWebMemory().then(() => {
                      loadWebMemory();
                      showStatus('success', 'Web memory cleared');
                    });
                  }
                }}
                style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444'
                }}
              >
                Clear Web Memory
              </button>
              <button 
                className="btn"
                onClick={() => {
                  if (confirm('⚠️ Delete ALL bookmarks?\n\nThis cannot be undone!')) {
                    clearAllBookmarks().then(() => {
                      loadBookmarks();
                      showStatus('success', 'All bookmarks cleared');
                    });
                  }
                }}
                style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444'
                }}
              >
                Clear Bookmarks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Data Tab (Upload + Interview) */}
      {activeTab === 'personal' && (
              <div>
      {/* Knowledge Base Stats */}
      <div className="section">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Personal Data - Knowledge Base
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '16px' }}>
          Your personal documents, interviews, and AI-powered knowledge system.
        </p>
        
        <div className="kb-stats">
          <div className="stat-card">
            <div className="stat-value">{documentCount}</div>
            <div className="stat-label">Documents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{chunkCount}</div>
            <div className="stat-label">Knowledge Chunks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{allTags.length}</div>
            <div className="stat-label">Semantic Tags</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{customProfiles.length + 2}</div>
            <div className="stat-label">Profiles</div>
          </div>
        </div>
        
        {/* Management Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            onClick={loadKnowledgeBase}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Refresh
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleClearKnowledgeBase}
            disabled={loading || chunkCount === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: chunkCount > 0 ? '#EF4444' : undefined }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Clear All Data
          </button>
        </div>
      </div>

      {/* Profile Selection */}
      <div className="section">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" style={{marginRight: '8px'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Select Profile
        </h2>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '16px' }}>
          Create separate profiles for different people - gather information about yourself, family members, or anyone else.
        </p>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {/* Default profiles */}
          {['me', 'spouse'].map(profile => (
            <button
              key={profile}
              onClick={() => setInterviewProfile(profile)}
              style={{
                padding: '12px 18px',
                border: interviewProfile === profile ? '2px solid #00D4FF' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                background: interviewProfile === profile ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                color: interviewProfile === profile ? '#00D4FF' : 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {profile === 'me' ? '👤' : '👥'} {profile.charAt(0).toUpperCase() + profile.slice(1)}
            </button>
          ))}
          
          {/* Custom profiles */}
          {customProfiles.map(profile => (
            <button
              key={profile}
              onClick={() => setInterviewProfile(profile)}
              style={{
                padding: '12px 18px',
                border: interviewProfile === profile ? '2px solid #8B5CF6' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                background: interviewProfile === profile ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                color: interviewProfile === profile ? '#8B5CF6' : 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              👤 {profile}
            </button>
          ))}
          
          {/* Add profile button */}
          {!showAddProfile ? (
            <button
              onClick={() => setShowAddProfile(true)}
              style={{
                padding: '12px 18px',
                border: '1px dashed rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              + Add Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Profile name..."
                style={{
                  padding: '10px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  width: '150px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newProfileName.trim()) {
                    setCustomProfiles([...customProfiles, newProfileName.trim()]);
                    setNewProfileName('');
                    setShowAddProfile(false);
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newProfileName.trim()) {
                    setCustomProfiles([...customProfiles, newProfileName.trim()]);
                    setNewProfileName('');
                    setShowAddProfile(false);
                  }
                }}
                style={{
                  padding: '10px 14px',
                  background: '#00D4FF',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#000',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddProfile(false); setNewProfileName(''); }}
                style={{
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        
        <div style={{ 
          fontSize: '12px', 
          color: 'rgba(255, 255, 255, 0.4)',
          padding: '12px',
          background: 'rgba(139, 92, 246, 0.05)',
          borderRadius: '10px',
          border: '1px solid rgba(139, 92, 246, 0.1)'
        }}>
          <strong style={{ color: '#8B5CF6' }}>Active Profile:</strong> {interviewProfile.charAt(0).toUpperCase() + interviewProfile.slice(1)}
        </div>
      </div>

      {/* Interactive Interview */}
      <div className="section">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          Interactive Interview
        </h2>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '16px' }}>
          Chat with AI to build your knowledge base. Use voice or text to describe yourself, preferences, and personal details.
        </p>
        
        {/* Interview Chat Interface */}
        <div style={{
          background: 'rgba(10, 10, 15, 0.6)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden'
        }}>
          {/* Messages */}
          <div style={{
            height: '300px',
            overflowY: 'auto',
            padding: '16px'
          }}>
            {interviewMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎙️</div>
                <div style={{ fontSize: '14px' }}>Start the interview by typing or using voice input</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>Tell me about yourself, your preferences, or anything you'd like me to remember!</div>
              </div>
            ) : (
              interviewMessages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #00D4FF, #8B5CF6)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    fontSize: '13px',
                    lineHeight: '1.5'
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Input Area */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={interviewProcessing}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: 'none',
                background: isRecording ? '#EF4444' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                cursor: interviewProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>
              )}
            </button>
            <input
              type="text"
              value={interviewInput}
              onChange={(e) => setInterviewInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !interviewProcessing && handleInterviewMessage()}
              placeholder={isRecording ? 'Recording...' : 'Type your message...'}
              disabled={isRecording || interviewProcessing}
              style={{
                flex: 1,
                padding: '14px 18px',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleInterviewMessage}
              disabled={!interviewInput.trim() || interviewProcessing}
              style={{
                padding: '14px 24px',
                borderRadius: '24px',
                border: 'none',
                background: interviewInput.trim() && !interviewProcessing ? 'linear-gradient(135deg, #00D4FF, #8B5CF6)' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                cursor: interviewInput.trim() && !interviewProcessing ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              {interviewProcessing ? '...' : 'Send'}
            </button>
          </div>
        </div>
        
        {/* Index Progress */}
        {pendingIndexCount > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(0, 212, 255, 0.1)',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#00D4FF'
          }}>
            ⏳ {pendingIndexCount} messages pending indexing... (auto-indexes after 30s of inactivity)
          </div>
        )}
      </div>

      {/* Upload Documents Section */}
      <div className="section">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 12 15 15"></polyline></svg>
          Upload Documents
        </h2>
        <div
          className={`upload-area ${dragging ? 'dragging' : ''}`}
          onClick={handleUploadClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="upload-icon">📄</div>
          <div className="upload-text">
            {uploading ? 'Processing...' : 'Click to upload or drag and drop files here'}
          </div>
          <div className="upload-hint">
            Supported formats: PDF, DOCX, XLSX, MD, TXT, JSON, XML, PPTX
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.docx,.doc,.xlsx,.xls,.json,.xml,.pptx,.ppt"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Processing Log */}
      {processingLogs.length > 0 && (
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              Processing Log
            </h2>
            <button className="btn btn-secondary" onClick={clearLogs} style={{ padding: '8px 14px', fontSize: '12px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Clear
            </button>
          </div>
          <div style={{
            background: 'rgba(10, 10, 15, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.7)',
            padding: '18px',
            borderRadius: '12px',
            fontFamily: '"JetBrains Mono", Monaco, Consolas, monospace',
            fontSize: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            lineHeight: '1.7'
          }}>
            {processingLogs.map((log, index) => (
              <div key={index} style={{
                color: log.type === 'success' ? '#00FF88' : log.type === 'error' ? '#FF4757' : 'rgba(255, 255, 255, 0.6)',
                marginBottom: '6px',
                display: 'flex',
                gap: '8px'
              }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.3)', flexShrink: 0 }}>
                  [{log.timestamp.toLocaleTimeString()}]
                </span>
                <span>{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Documents Section */}
      <div className="section">
        <h2>📚 Uploaded Documents</h2>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div>No documents yet. Upload some to get started!</div>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.document_id} style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '20px',
              borderRadius: '16px',
              marginBottom: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.3s'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ fontWeight: '600', fontSize: '15px', color: '#fff', flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  {doc.source_file}
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteDocument(doc.document_id, doc.source_file)}
                  style={{ padding: '8px 14px', fontSize: '12px' }}
                  title="Delete this document"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '4px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Delete
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginBottom: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span>Uploaded: {new Date(doc.uploaded_at).toLocaleString()}</span>
                <span style={{color: '#00D4FF'}}>{doc.chunk_count} chunks</span>
                <span style={{color: '#8B5CF6'}}>{doc.all_tags.length} semantic tags</span>
              </div>
              
              {doc.discovered_topics && doc.discovered_topics.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Discovered Topics
                  </div>
                  {doc.discovered_topics.map((topic: any, i: number) => (
                    <div key={i} style={{ marginLeft: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#00D4FF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"></circle></svg>
                        {topic.topic}
                      </div>
                      {topic.subtopics && topic.subtopics.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginLeft: '16px', marginTop: '4px' }}>
                          {topic.subtopics.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <details style={{ fontSize: '13px' }}>
                <summary style={{ cursor: 'pointer', color: '#8B5CF6', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  View All Tags ({doc.all_tags.length})
                </summary>
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  background: 'rgba(10, 10, 15, 0.5)', 
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {doc.all_tags.map((tag: string, i: number) => (
                    <span key={i} className="tag" style={{ margin: '3px' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </details>
            </div>
          ))
        )}
      </div>
      
      {/* Chunks Preview */}
      {chunks.length > 0 && (
        <div className="section">
          <h2>🔍 Chunk Preview ({chunks.length} total)</h2>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
            Showing first 10 chunks
          </div>
          <table className="chunks-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Semantic Tags</th>
                <th>Content Preview</th>
              </tr>
            </thead>
            <tbody>
              {chunks.slice(0, 10).map((chunk) => (
                <tr key={chunk.id}>
                  <td>{chunk.source_file}</td>
                  <td>
                    {chunk.semantic_tags && chunk.semantic_tags.slice(0, 3).map((tag: string, i: number) => (
                      <span key={i} className="tag">
                        {tag}
                      </span>
                    ))}
                    {chunk.semantic_tags && chunk.semantic_tags.length > 3 && (
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        +{chunk.semantic_tags.length - 3} more
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chunk.body.substring(0, 100)}
                    {chunk.body.length > 100 && '...'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      )}

      </div>
      )}

      {/* Web Memory Tab */}
      {activeTab === 'webmemory' && (
        <div>
          {/* Web Memory Stats */}
          <div className="section">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
              Web Memory - Saved Websites
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '16px' }}>
              Every website you visit is automatically saved here. Use natural language to search through your browsing history.
            </p>
            
            <div className="kb-stats">
              <div className="stat-card">
                <div className="stat-value">{webMemoryStats.totalPages}</div>
                <div className="stat-label">Pages Saved</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{webMemoryStats.uniqueDomains}</div>
                <div className="stat-label">Domains</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{webMemoryStats.totalVisits}</div>
                <div className="stat-label">Total Visits</div>
              </div>
            </div>
            
            <div className="actions" style={{ marginTop: '16px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={loadWebMemory}>
                🔄 Refresh
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCleanupOptions(!showCleanupOptions)}
              >
                🧹 Cleanup Options
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleClearWebMemory}
                disabled={webMemoryStats.totalPages === 0}
              >
                🗑️ Clear All Memory
              </button>
            </div>
            
            {/* Cleanup Options Panel */}
            {showCleanupOptions && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px'
              }}>
                <h3 style={{ fontSize: '14px', marginBottom: '14px', color: '#00D4FF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  Cleanup Options - Manage Storage
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Delete Old Pages */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Delete pages older than:</span>
                    <select
                      value={cleanupDays}
                      onChange={(e) => setCleanupDays(Number(e.target.value))}
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(24, 24, 32, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                      <option value={180}>180 days</option>
                      <option value={365}>1 year</option>
                    </select>
                    <button className="btn btn-secondary" onClick={handleDeleteOldPages} style={{ fontSize: '12px', padding: '8px 14px' }}>
                      Delete Old
                    </button>
                  </div>
                  
                  {/* Limit Total Pages */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Keep only most recent:</span>
                    <button className="btn btn-secondary" onClick={() => handleEnforceLimit(500)} style={{ fontSize: '12px', padding: '8px 14px' }}>
                      500 pages
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleEnforceLimit(1000)} style={{ fontSize: '12px', padding: '8px 14px' }}>
                      1000 pages
                    </button>
                    <button className="btn btn-secondary" onClick={() => handleEnforceLimit(2000)} style={{ fontSize: '12px', padding: '8px 14px' }}>
                      2000 pages
                    </button>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '8px' }}>
                    💡 Tip: Auto-cleanup runs automatically to keep max 2000 pages for performance.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search/Filter */}
          <div className="section">
            <h2>🔍 Search Your Browsing History</h2>
            <input
              type="text"
              value={webMemoryFilter}
              onChange={(e) => setWebMemoryFilter(e.target.value)}
              placeholder="Search by title, URL, domain, or content..."
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                background: 'rgba(24, 24, 32, 0.9)',
                color: '#fff',
                transition: 'all 0.3s'
              }}
            />
            {webMemoryFilter && (
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '10px' }}>
                Found {filteredPages.length} of {visitedPages.length} pages
              </p>
            )}
          </div>

          {/* Saved Pages List */}
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ margin: 0 }}>📚 Saved Websites ({filteredPages.length})</h2>
              
              {/* View Toggle */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '4px' }}>
                <button
                  onClick={() => setViewMode('list')}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    background: viewMode === 'list' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                    color: viewMode === 'list' ? '#00D4FF' : 'rgba(255, 255, 255, 0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                  List
                </button>
                <button
                  onClick={() => setViewMode('domains')}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    background: viewMode === 'domains' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                    color: viewMode === 'domains' ? '#00D4FF' : 'rgba(255, 255, 255, 0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  By Domain
                </button>
              </div>
            </div>
            
            {/* Domain View */}
            {viewMode === 'domains' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.from(pagesByDomain.entries())
                  .sort((a, b) => b[1].length - a[1].length)
                  .slice(0, displayLimit)
                  .map(([domain, pages]) => (
                  <details key={domain} style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <summary style={{ 
                      cursor: 'pointer', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      listStyle: 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                          alt="" 
                          style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span style={{ fontWeight: '600', color: '#00D4FF' }}>{domain}</span>
                        <span style={{ 
                          background: 'rgba(139, 92, 246, 0.2)', 
                          color: '#8B5CF6', 
                          padding: '2px 10px', 
                          borderRadius: '10px', 
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {pages.length} pages
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDomain(domain); }}
                        style={{
                          background: 'rgba(255, 71, 87, 0.1)',
                          border: '1px solid rgba(255, 71, 87, 0.3)',
                          color: '#FF4757',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Delete All
                      </button>
                    </summary>
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pages.slice(0, 10).map((page) => (
                        <div key={page.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: 'rgba(10, 10, 15, 0.5)',
                          borderRadius: '8px'
                        }}>
                          <a 
                            href={page.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              color: 'rgba(255, 255, 255, 0.8)', 
                              textDecoration: 'none',
                              fontSize: '12px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1
                            }}
                          >
                            {page.title || page.url}
                          </a>
                          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginLeft: '10px' }}>
                            {page.visit_count}x
                          </span>
                        </div>
                      ))}
                      {pages.length > 10 && (
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', padding: '8px' }}>
                          +{pages.length - 10} more pages
                        </div>
                      )}
                    </div>
                  </details>
                ))}
                
                {pagesByDomain.size > displayLimit && (
                  <button
                    onClick={loadMorePages}
                    className="btn btn-secondary"
                    style={{ alignSelf: 'center', marginTop: '16px' }}
                  >
                    Load More Domains ({pagesByDomain.size - displayLimit} remaining)
                  </button>
                )}
              </div>
            )}
            
            {/* List View */}
            {viewMode === 'list' && (
              filteredPages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧠</div>
                <div>
                  {visitedPages.length === 0 
                    ? 'No websites saved yet. Start browsing to build your Web Memory!' 
                    : 'No websites match your search.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredPages.slice(0, displayLimit).map((page) => (
                  <div key={page.id} style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.3s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a 
                          href={page.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            fontWeight: '600', 
                            fontSize: '14px', 
                            color: '#00D4FF', 
                            textDecoration: 'none',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {page.title || 'Untitled'}
                        </a>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px' }}>
                          {page.domain}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteVisitedPage(page.id, page.title)}
                        style={{
                          background: 'rgba(255, 71, 87, 0.1)',
                          border: '1px solid rgba(255, 71, 87, 0.3)',
                          color: '#FF4757',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          marginLeft: '12px',
                          transition: 'all 0.3s'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    
                    {page.description && (
                      <p style={{ 
                        fontSize: '13px', 
                        color: 'rgba(255, 255, 255, 0.6)', 
                        margin: '8px 0',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {page.description}
                      </p>
                    )}
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '16px', 
                      fontSize: '11px', 
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginTop: '10px',
                      flexWrap: 'wrap'
                    }}>
                      <span>Visited: {new Date(page.last_visited).toLocaleString()}</span>
                      <span style={{ color: '#8B5CF6' }}>{page.visit_count}x visits</span>
                      {page.headings.length > 0 && (
                        <span>{page.headings.length} headings</span>
                      )}
                      {page.keywords.length > 0 && (
                        <span>{page.keywords.length} keywords</span>
                      )}
                    </div>
                    
                    {page.keywords.length > 0 && (
                      <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {page.keywords.slice(0, 8).map((keyword, i) => (
                          <span key={i} style={{
                            background: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#8B5CF6',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            {keyword}
                          </span>
                        ))}
                        {page.keywords.length > 8 && (
                          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', padding: '4px' }}>
                            +{page.keywords.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                    
                    <details style={{ marginTop: '12px', fontSize: '12px' }}>
                      <summary style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.5)' }}>
                        View Content Preview
                      </summary>
                      <div style={{
                        marginTop: '10px',
                        padding: '12px',
                        background: 'rgba(10, 10, 15, 0.5)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        lineHeight: '1.6',
                        maxHeight: '200px',
                        overflow: 'auto'
                      }}>
                        {page.content.substring(0, 1000)}{page.content.length > 1000 && '...'}
                      </div>
                    </details>
                  </div>
                ))}
                
                {filteredPages.length > displayLimit && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px'
                  }}>
                    <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px', marginBottom: '12px' }}>
                      Showing {Math.min(displayLimit, filteredPages.length)} of {filteredPages.length} pages
                    </p>
                    <button
                      onClick={loadMorePages}
                      className="btn btn-primary"
                      style={{ padding: '12px 24px' }}
                    >
                      Load More ({filteredPages.length - displayLimit} remaining)
                    </button>
                  </div>
                )}
                
                {filteredPages.length <= displayLimit && filteredPages.length > 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '16px', 
                    color: 'rgba(255, 255, 255, 0.4)', 
                    fontSize: '13px' 
                  }}>
                    Showing all {filteredPages.length} pages
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookmarks Tab */}
      {activeTab === 'bookmarks' && (
        <div>
          {/* Bookmark Stats */}
          <div className="section">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{marginRight: '8px'}}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              Smart Bookmarks
            </h2>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '16px' }}>
              All your bookmarked websites with ratings, categories, and AI-generated summaries. Use AI search to find bookmarks by any criteria.
            </p>
            
            <div className="kb-stats">
              <div className="stat-card">
                <div className="stat-value">{bookmarkStats.totalBookmarks}</div>
                <div className="stat-label">Total Bookmarks</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{bookmarkStats.avgRating.toFixed(1)}</div>
                <div className="stat-label">Avg Rating</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{bookmarkStats.categoriesCount}</div>
                <div className="stat-label">Categories</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{bookmarks.filter(b => b.ai_summary).length}</div>
                <div className="stat-label">With AI Summary</div>
              </div>
            </div>
            
            {/* Management Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary" 
                onClick={loadBookmarks}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Refresh
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowBookmarkCleanup(!showBookmarkCleanup)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Cleanup Options {showBookmarkCleanup ? '▲' : '▼'}
              </button>
            </div>
            
            {/* Cleanup Options Panel */}
            {showBookmarkCleanup && (
              <div style={{
                marginTop: '16px',
                padding: '20px',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '12px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Cleanup Options
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Delete All */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn"
                      onClick={() => {
                        if (confirm('⚠️ Delete ALL bookmarks?\n\nThis cannot be undone!')) {
                          clearAllBookmarks().then(() => {
                            loadBookmarks();
                            showStatus('success', 'All bookmarks cleared');
                          });
                        }
                      }}
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#EF4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      Delete All Bookmarks
                    </button>
                  </div>
                  
                  {/* Delete by Category */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Delete by category:</span>
                    <select
                      value={cleanupCategory}
                      onChange={(e) => setCleanupCategory(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: '#1a1a2e',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none',
                        minWidth: '150px'
                      }}
                    >
                      <option value="">Select category...</option>
                      {Array.from(new Set(bookmarks.flatMap(b => b.categories || []))).sort().map(cat => (
                        <option key={cat} value={cat}>{cat} ({bookmarks.filter(b => b.categories?.includes(cat)).length})</option>
                      ))}
                    </select>
                    <button 
                      className="btn"
                      disabled={!cleanupCategory}
                      onClick={() => {
                        const count = bookmarks.filter(b => b.categories?.includes(cleanupCategory)).length;
                        if (confirm(`Delete ${count} bookmarks in category "${cleanupCategory}"?\n\nThis cannot be undone!`)) {
                          Promise.all(
                            bookmarks
                              .filter(b => b.categories?.includes(cleanupCategory))
                              .map(b => deleteBookmark(b.url))
                          ).then(() => {
                            loadBookmarks();
                            showStatus('success', `Deleted ${count} bookmarks from "${cleanupCategory}"`);
                            setCleanupCategory('');
                          });
                        }
                      }}
                      style={{ 
                        background: cleanupCategory ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: cleanupCategory ? '#EF4444' : 'rgba(255,255,255,0.3)',
                        cursor: cleanupCategory ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Delete Category
                    </button>
                  </div>
                  
                  {/* Delete by Rating */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Delete low-rated:</span>
                    <select
                      value={cleanupRating}
                      onChange={(e) => setCleanupRating(Number(e.target.value))}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: '#1a1a2e',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none',
                        minWidth: '150px'
                      }}
                    >
                      <option value={0}>Select max rating...</option>
                      <option value={3}>Rating 3 or below ({bookmarks.filter(b => b.rating <= 3).length})</option>
                      <option value={4}>Rating 4 or below ({bookmarks.filter(b => b.rating <= 4).length})</option>
                      <option value={5}>Rating 5 or below ({bookmarks.filter(b => b.rating <= 5).length})</option>
                    </select>
                    <button 
                      className="btn"
                      disabled={cleanupRating === 0}
                      onClick={() => {
                        const count = bookmarks.filter(b => b.rating <= cleanupRating).length;
                        if (confirm(`Delete ${count} bookmarks rated ${cleanupRating} or below?\n\nThis cannot be undone!`)) {
                          Promise.all(
                            bookmarks
                              .filter(b => b.rating <= cleanupRating)
                              .map(b => deleteBookmark(b.url))
                          ).then(() => {
                            loadBookmarks();
                            showStatus('success', `Deleted ${count} low-rated bookmarks`);
                            setCleanupRating(0);
                          });
                        }
                      }}
                      style={{ 
                        background: cleanupRating > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: cleanupRating > 0 ? '#EF4444' : 'rgba(255,255,255,0.3)',
                        cursor: cleanupRating > 0 ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Delete Low-Rated
                    </button>
                  </div>
                  
                  {/* Delete older than */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Delete older than:</span>
                    <select
                      value={cleanupDaysBookmark}
                      onChange={(e) => setCleanupDaysBookmark(Number(e.target.value))}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: '#1a1a2e',
                        color: '#fff',
                        fontSize: '13px',
                        outline: 'none',
                        minWidth: '150px'
                      }}
                    >
                      <option value={0}>Select age...</option>
                      <option value={30}>30 days ({bookmarks.filter(b => (Date.now() - new Date(b.bookmarked_at).getTime()) > 30*24*60*60*1000).length})</option>
                      <option value={60}>60 days ({bookmarks.filter(b => (Date.now() - new Date(b.bookmarked_at).getTime()) > 60*24*60*60*1000).length})</option>
                      <option value={90}>90 days ({bookmarks.filter(b => (Date.now() - new Date(b.bookmarked_at).getTime()) > 90*24*60*60*1000).length})</option>
                      <option value={180}>180 days ({bookmarks.filter(b => (Date.now() - new Date(b.bookmarked_at).getTime()) > 180*24*60*60*1000).length})</option>
                    </select>
                    <button 
                      className="btn"
                      disabled={cleanupDaysBookmark === 0}
                      onClick={() => {
                        const cutoff = Date.now() - cleanupDaysBookmark * 24 * 60 * 60 * 1000;
                        const oldBookmarks = bookmarks.filter(b => new Date(b.bookmarked_at).getTime() < cutoff);
                        if (confirm(`Delete ${oldBookmarks.length} bookmarks older than ${cleanupDaysBookmark} days?\n\nThis cannot be undone!`)) {
                          Promise.all(oldBookmarks.map(b => deleteBookmark(b.url))).then(() => {
                            loadBookmarks();
                            showStatus('success', `Deleted ${oldBookmarks.length} old bookmarks`);
                            setCleanupDaysBookmark(0);
                          });
                        }
                      }}
                      style={{ 
                        background: cleanupDaysBookmark > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: cleanupDaysBookmark > 0 ? '#EF4444' : 'rgba(255,255,255,0.3)',
                        cursor: cleanupDaysBookmark > 0 ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Delete Old
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Search */}
          <div className="section">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" style={{marginRight: '8px'}}><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
              AI-Powered Search
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '12px' }}>
              Ask in natural language: "shopping sites rated 8+", "articles about AI", "entertainment sites from last week"
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Find bookmarks... e.g., 'shopping sites with rating above 7'"
                value={bookmarkFilter}
                onChange={(e) => setBookmarkFilter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  background: 'rgba(139, 92, 246, 0.05)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button 
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
                Search
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="section">
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Min Rating:</span>
                <select
                  value={bookmarkMinRating}
                  onChange={(e) => setBookmarkMinRating(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#1a1a2e',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={0}>All</option>
                  <option value={6}>6+ ★★</option>
                  <option value={7}>7+ ★★★</option>
                  <option value={8}>8+ ★★★★</option>
                  <option value={9}>9+ ★★★★★</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Category:</span>
                <select
                  value={bookmarkCategoryFilter}
                  onChange={(e) => setBookmarkCategoryFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#1a1a2e',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                    minWidth: '140px'
                  }}
                >
                  <option value="">All Categories</option>
                  {Array.from(new Set(bookmarks.flatMap(b => b.categories || []))).sort().map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Sort:</span>
                <select
                  value={bookmarkSortBy}
                  onChange={(e) => setBookmarkSortBy(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#1a1a2e',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="date">Most Recent</option>
                  <option value="rating">Highest Rated</option>
                  <option value="title">Alphabetical</option>
                </select>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                Showing {bookmarks.filter(bm => 
                  (bookmarkFilter === '' || 
                    bm.title.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.url.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.ai_summary?.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.comment?.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.categories?.some(c => c.toLowerCase().includes(bookmarkFilter.toLowerCase()))
                  ) &&
                  bm.rating >= bookmarkMinRating &&
                  (bookmarkCategoryFilter === '' || bm.categories?.includes(bookmarkCategoryFilter))
                ).length} of {bookmarks.length}
              </span>
            </div>
          </div>

          {/* Bookmarks List */}
          <div className="section">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {bookmarks
                .filter(bm => 
                  (bookmarkFilter === '' || 
                    bm.title.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.url.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.ai_summary?.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.comment?.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                    bm.categories?.some(c => c.toLowerCase().includes(bookmarkFilter.toLowerCase()))
                  ) &&
                  bm.rating >= bookmarkMinRating &&
                  (bookmarkCategoryFilter === '' || bm.categories?.includes(bookmarkCategoryFilter))
                )
                .sort((a, b) => {
                  if (bookmarkSortBy === 'rating') return b.rating - a.rating;
                  if (bookmarkSortBy === 'title') return a.title.localeCompare(b.title);
                  return new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime();
                })
                .map((bookmark) => (
                <div
                  key={bookmark.url}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Favicon */}
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <img 
                      src={bookmark.favicon || `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`}
                      style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2300D4FF" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'; }}
                    />
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title & Domain */}
                    <a 
                      href={bookmark.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#fff', 
                        textDecoration: 'none', 
                        fontSize: '15px', 
                        fontWeight: '600',
                        display: 'block',
                        marginBottom: '4px'
                      }}
                    >
                      {bookmark.title}
                    </a>
                    <div style={{ fontSize: '12px', color: '#00D4FF', marginBottom: '10px' }}>
                      {bookmark.domain} • {new Date(bookmark.bookmarked_at).toLocaleDateString()}
                    </div>
                    
                    {/* Rating - Visual Stars */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ 
                        display: 'flex', 
                        gap: '2px',
                        padding: '4px 10px',
                        background: 'rgba(255, 215, 0, 0.1)',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 215, 0, 0.2)'
                      }}>
                        {[...Array(10)].map((_, i) => (
                          <span key={i} style={{ color: i < bookmark.rating ? '#FFD700' : 'rgba(255,255,255,0.2)', fontSize: '12px' }}>★</span>
                        ))}
                      </div>
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: '600',
                        color: bookmark.rating >= 8 ? '#22C55E' : bookmark.rating >= 6 ? '#FFD700' : 'rgba(255,255,255,0.5)'
                      }}>
                        {bookmark.rating}/10
                      </span>
                    </div>
                    
                    {/* Categories */}
                    {bookmark.categories && bookmark.categories.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        {bookmark.categories.map((cat, idx) => (
                          <span 
                            key={idx}
                            onClick={() => setBookmarkCategoryFilter(cat)}
                            style={{
                              padding: '4px 10px',
                              background: 'rgba(0, 212, 255, 0.1)',
                              border: '1px solid rgba(0, 212, 255, 0.3)',
                              borderRadius: '16px',
                              fontSize: '11px',
                              color: '#00D4FF',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* AI Summary */}
                    {bookmark.ai_summary && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'rgba(255,255,255,0.7)', 
                        lineHeight: '1.5',
                        padding: '12px',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(0, 212, 255, 0.05))',
                        borderRadius: '10px',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        marginBottom: '10px'
                      }}>
                        <div style={{ fontSize: '10px', color: '#8B5CF6', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🤖 AI Summary
                        </div>
                        {bookmark.ai_summary}
                      </div>
                    )}
                    
                    {/* User Comment */}
                    {bookmark.comment && (
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'rgba(255,255,255,0.6)', 
                        fontStyle: 'italic',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        borderLeft: '3px solid rgba(0, 212, 255, 0.5)'
                      }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>💬 Your Note:</span>
                        "{bookmark.comment}"
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={() => window.open(bookmark.url, '_blank')}
                      style={{
                        background: 'rgba(0, 212, 255, 0.1)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        borderRadius: '8px',
                        color: '#00D4FF',
                        cursor: 'pointer',
                        padding: '8px',
                        transition: 'all 0.2s'
                      }}
                      title="Open"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this bookmark?')) {
                          deleteBookmark(bookmark.url).then(() => loadBookmarks());
                        }
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: '8px',
                        transition: 'all 0.2s'
                      }}
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
              
              {bookmarks.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '80px 20px',
                  color: 'rgba(255, 255, 255, 0.4)'
                }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '20px', opacity: 0.3 }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                  <p style={{ fontSize: '16px', marginBottom: '8px' }}>No bookmarks yet</p>
                  <p style={{ fontSize: '13px' }}>
                    Use the ⚡ floating button on any page to bookmark websites
                  </p>
                </div>
              )}
              
              {bookmarks.length > 0 && bookmarks.filter(bm => 
                (bookmarkFilter === '' || 
                  bm.title.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                  bm.url.toLowerCase().includes(bookmarkFilter.toLowerCase()) ||
                  bm.categories?.some(c => c.toLowerCase().includes(bookmarkFilter.toLowerCase()))
                ) &&
                bm.rating >= bookmarkMinRating &&
                (bookmarkCategoryFilter === '' || bm.categories?.includes(bookmarkCategoryFilter))
              ).length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: 'rgba(255, 255, 255, 0.4)'
                }}>
                  <p style={{ fontSize: '14px' }}>No bookmarks match your filters</p>
                  <button 
                    onClick={() => { setBookmarkFilter(''); setBookmarkMinRating(0); setBookmarkCategoryFilter(''); }}
                    style={{ 
                      marginTop: '12px', 
                      padding: '8px 16px', 
                      background: 'rgba(0, 212, 255, 0.1)', 
                      border: '1px solid rgba(0, 212, 255, 0.3)', 
                      borderRadius: '8px',
                      color: '#00D4FF',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

