import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { saveDocumentIndex, getAllChunks, getAllDocuments, clearAllChunks, deleteDocument, getChunkCount, getDocumentCount, getAllTags, saveInterview, exportInterviewAsText, exportKnowledgeBase, importKnowledgeBase, KnowledgeBaseBackup, BackupOptions, getAllVisitedPages, getWebMemoryStats, clearWebMemory, deleteVisitedPage, VisitedPage, deleteOldPages, enforcePageLimit, deletePagesByDomain, getPagesByDomain, getVisitedPageCount } from '../db';

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
  const [activeTab, setActiveTab] = useState<'upload' | 'interview' | 'webmemory'>('upload');
  const [chunks, setChunks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
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
  const [webMemoryPageCount, setWebMemoryPageCount] = useState(0);

  useEffect(() => {
    loadKnowledgeBase();
    loadWebMemory();
  }, []);

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

  const handleAddProfile = () => {
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

  const handleExportInterview = async () => {
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

  const handleUploadInterviewToKB = async () => {
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
          onClick={() => setActiveTab('upload')}
          className={activeTab === 'upload' ? 'tab-button active' : 'tab-button'}
          style={{
            padding: '14px 24px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'upload' ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 12 15 15"></polyline></svg>
          Upload Documents
        </button>
        <button
          onClick={() => setActiveTab('interview')}
          className={activeTab === 'interview' ? 'tab-button active' : 'tab-button'}
          style={{
            padding: '14px 24px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'interview' ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          Interactive Interview
        </button>
        <button
          onClick={() => { setActiveTab('webmemory'); loadWebMemory(); }}
          className={activeTab === 'webmemory' ? 'tab-button active' : 'tab-button'}
          style={{
            padding: '14px 24px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'webmemory' ? '#00D4FF' : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '14px',
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
      </div>

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
              <div>
      {/* Upload Section */}
      <div className="section">
        <h2>📤 Upload Documents</h2>
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

      {/* Knowledge Base Stats */}
      <div className="section">
        <h2>📊 Knowledge Base (Dynamic AI System)</h2>
        <div className="kb-stats">
          <div className="stat-card">
            <div className="stat-value">{chunkCount}</div>
            <div className="stat-label">Total Chunks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{documentCount}</div>
            <div className="stat-label">Documents</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{allTags.length}</div>
            <div className="stat-label">Semantic Tags</div>
          </div>
        </div>

        {/* Backup Options */}
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          background: 'rgba(0, 212, 255, 0.05)',
          border: '1px solid rgba(0, 212, 255, 0.15)',
          borderRadius: '12px'
        }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: '600', 
            color: '#00D4FF', 
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Backup Options
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <input
                type="checkbox"
                checked={backupOptions.includeDocuments}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeDocuments: e.target.checked }))}
                style={{ 
                  width: '18px', 
                  height: '18px', 
                  accentColor: '#00D4FF',
                  cursor: 'pointer'
                }}
              />
              <span>📚 Documents & Chunks</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>({chunkCount})</span>
            </label>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <input
                type="checkbox"
                checked={backupOptions.includeInterviews}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeInterviews: e.target.checked }))}
                style={{ 
                  width: '18px', 
                  height: '18px', 
                  accentColor: '#8B5CF6',
                  cursor: 'pointer'
                }}
              />
              <span>🎤 Interview Profiles</span>
            </label>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <input
                type="checkbox"
                checked={backupOptions.includeWebMemory}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeWebMemory: e.target.checked }))}
                style={{ 
                  width: '18px', 
                  height: '18px', 
                  accentColor: '#00FF88',
                  cursor: 'pointer'
                }}
              />
              <span>🧠 Web Memory</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>({webMemoryPageCount} pages)</span>
            </label>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <input
                type="checkbox"
                checked={backupOptions.includeBookmarks}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeBookmarks: e.target.checked }))}
                style={{ 
                  width: '18px', 
                  height: '18px', 
                  accentColor: '#FFB800',
                  cursor: 'pointer'
                }}
              />
              <span>🔖 Smart Bookmarks</span>
            </label>
          </div>
        </div>

        <div className="actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={loadKnowledgeBase} disabled={loading}>
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleBackupKnowledgeBase}
            disabled={loading || (!backupOptions.includeDocuments && !backupOptions.includeInterviews && !backupOptions.includeWebMemory && !backupOptions.includeBookmarks)}
            style={{ background: 'linear-gradient(135deg, #00FF88, #00D4FF)' }}
          >
            💾 Backup Selected
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
            📥 Restore
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreKnowledgeBase}
              style={{ display: 'none' }}
            />
          </label>
          <button
            className="btn btn-danger"
            onClick={handleClearKnowledgeBase}
            disabled={loading || chunkCount === 0}
          >
            🗑️ Clear All
          </button>
        </div>
        
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: 'rgba(0, 212, 255, 0.1)', 
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <strong style={{ color: '#00D4FF' }}>💡 Tip:</strong> Select what you want to backup using the checkboxes above. Web Memory includes all your visited sites history!
        </div>
      </div>

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

      {/* Interview Tab */}
      {activeTab === 'interview' && (
      <div>
        {/* Profile Selector */}
        <div className="section">
          <h2>👤 Select Profile</h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
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
                  border: interviewProfile === profile ? '1px solid #00D4FF' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: interviewProfile === profile ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: interviewProfile === profile ? '#00D4FF' : 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.3s',
                  boxShadow: interviewProfile === profile ? '0 0 20px rgba(0, 212, 255, 0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                {profile === 'me' ? 'Me' : 'Spouse'}
              </button>
            ))}
            
            {/* Custom profiles */}
            {customProfiles.map(profile => (
              <button
                key={profile}
                onClick={() => setInterviewProfile(profile)}
                style={{
                  padding: '12px 18px',
                  border: interviewProfile === profile ? '1px solid #00D4FF' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: interviewProfile === profile ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: interviewProfile === profile ? '#00D4FF' : 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.3s',
                  boxShadow: interviewProfile === profile ? '0 0 20px rgba(0, 212, 255, 0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                {profile.split('-').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete profile "${profile}"?`)) {
                      setCustomProfiles(prev => prev.filter(p => p !== profile));
                      if (interviewProfile === profile) {
                        setInterviewProfile('me');
                      }
                    }
                  }}
                  style={{
                    marginLeft: '4px',
                    opacity: 0.6,
                    fontSize: '14px',
                    color: '#FF4757'
                  }}
                >
                  ×
                </span>
              </button>
            ))}
            
            {/* Add Profile Button */}
            {!showAddProfile ? (
              <button
                onClick={() => setShowAddProfile(true)}
                style={{
                  padding: '12px 18px',
                  border: '2px dashed rgba(0, 212, 255, 0.5)',
                  background: 'transparent',
                  color: '#00D4FF',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                Add Person
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddProfile()}
                  placeholder="Name (e.g., Jan, Mom)"
                  style={{
                    padding: '10px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    outline: 'none',
                    width: '160px',
                    background: 'rgba(24, 24, 32, 0.9)',
                    color: '#fff'
                  }}
                  autoFocus
                />
                <button
                  onClick={handleAddProfile}
                  className="btn btn-primary"
                  style={{ padding: '10px 14px', fontSize: '12px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button
                  onClick={() => {
                    setShowAddProfile(false);
                    setNewProfileName('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '10px 14px', fontSize: '12px' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            )}
          </div>
          
          <div style={{
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            padding: '14px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <span><strong style={{color: '#00D4FF'}}>Current Profile:</strong> {
              interviewProfile === 'me' ? 'Information about yourself' :
              interviewProfile === 'spouse' ? 'Information about your spouse/partner' :
              interviewProfile.startsWith('kid') ? `Information about ${interviewProfile.replace('kid-', 'child ')}` :
              'Information about another person'
            }</span>
          </div>
        </div>

        {/* Interview Chat */}
        <div className="section">
          <h2>🎙️ Interactive Interview</h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            Answer questions to build comprehensive knowledge. Use text or voice input. All answers are automatically saved to your knowledge base.
          </p>
          
          {/* Chat Container */}
          <div style={{
            background: 'rgba(24, 24, 32, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            height: '400px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              background: 'rgba(10, 10, 15, 0.5)'
            }}>
              {interviewMessages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  color: 'rgba(255, 255, 255, 0.4)'
                }}>
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    margin: '0 auto 20px',
                    background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(139, 92, 246, 0.2))',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(0, 212, 255, 0.3)'
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                  </div>
                  <p style={{ marginBottom: '20px', color: 'rgba(255, 255, 255, 0.6)' }}>No interview started yet</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setInterviewMessages([{
                        role: 'assistant',
                        content: `Hi! Let's gather information about ${interviewProfile === 'me' ? 'you' : interviewProfile}. I'll ask you questions to build a comprehensive profile. Ready to start?`
                      }]);
                    }}
                    style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Start Interview
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {interviewMessages.map((msg, idx) => (
                    msg.role === 'typing' ? (
                      // Typing indicator
                      <div
                        key={idx}
                        style={{
                          maxWidth: '85%',
                          alignSelf: 'flex-start',
                          background: 'rgba(24, 24, 32, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '14px 18px',
                          borderRadius: '16px',
                          display: 'flex',
                          gap: '6px'
                        }}
                      >
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                          animation: 'typing 1.4s infinite'
                        }}></span>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                          animation: 'typing 1.4s infinite 0.2s'
                        }}></span>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #00D4FF, #8B5CF6)',
                          animation: 'typing 1.4s infinite 0.4s'
                        }}></span>
                        <style>{`
                          @keyframes typing {
                            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
                            30% { transform: translateY(-10px); opacity: 1; }
                          }
                        `}</style>
                      </div>
                    ) : (
                      // Regular message
                      <div
                        key={idx}
                        style={{
                          maxWidth: '85%',
                          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          background: msg.role === 'user' ? 
                            'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)' : 
                            'rgba(24, 24, 32, 0.9)',
                          border: msg.role === 'assistant' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                          color: msg.role === 'user' ? 'white' : 'rgba(255, 255, 255, 0.9)',
                          padding: '12px 16px',
                          borderRadius: '16px',
                          borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                          borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          boxShadow: msg.role === 'user' ? '0 4px 15px rgba(0, 212, 255, 0.3)' : 'none'
                        }}
                      >
                        {msg.content}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
            
            {/* Input Area */}
            {interviewMessages.length > 0 && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '10px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  value={interviewInput}
                  onChange={(e) => setInterviewInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !interviewProcessing && interviewInput.trim()) {
                      handleInterviewMessage();
                    }
                  }}
                  placeholder={isRecording ? "Recording... Click button to stop" : "Type your answer or click mic to speak..."}
                  disabled={interviewProcessing || isRecording}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '24px',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    background: 'rgba(24, 24, 32, 0.9)',
                    color: '#fff',
                    transition: 'all 0.3s'
                  }}
                />
                
                {/* Smart Button: Mic by default, Send when text entered, Stop when recording */}
                <button
                  onClick={() => {
                    if (isRecording) {
                      // Stop recording
                      handleStopRecording();
                    } else if (interviewInput.trim()) {
                      // Send text message
                      handleInterviewMessage();
                    } else {
                      // Start recording
                      handleStartRecording();
                    }
                  }}
                  disabled={interviewProcessing}
                  style={{
                    padding: '12px 20px',
                    background: isRecording ? 'linear-gradient(135deg, #FF4757, #FF006E)' : 
                               'linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '24px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    minWidth: interviewInput.trim() ? '80px' : '48px',
                    transition: 'all 0.3s',
                    boxShadow: isRecording ? '0 0 20px rgba(255, 71, 87, 0.5)' : '0 4px 15px rgba(0, 212, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  title={
                    isRecording ? 'Click to stop recording' :
                    interviewInput.trim() ? 'Send message' :
                    'Click to start voice input'
                  }
                >
                  {isRecording ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
                  ) : interviewInput.trim() ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                      Send
                    </>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                  )}
                </button>
              </div>
            )}
          </div>
          
          {/* Interview Actions */}
          {interviewMessages.length > 0 && (
            <div style={{
              marginTop: '16px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                className="btn btn-primary"
                onClick={handleUploadInterviewToKB}
                style={{ fontSize: '13px' }}
                title="Upload this interview to knowledge base for auto-fill"
              >
                📤 Upload to Knowledge Base
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleExportInterview}
                style={{ fontSize: '13px' }}
                title="Download as .txt file"
              >
                💾 Export File
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (confirm('Restart interview? Current conversation will be saved first.')) {
                    // Save before clearing
                    autoSaveInterview(interviewMessages.filter(m => m.role !== 'typing'));
                    setInterviewMessages([]);
                    setInterviewInput('');
                  }
                }}
                style={{ fontSize: '13px' }}
              >
                🔄 Restart
              </button>
            </div>
          )}
          
          {/* Interview Info */}
          {interviewMessages.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.6)',
              lineHeight: '1.7'
            }}>
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" strokeWidth="2" style={{flexShrink: 0, marginTop: '2px'}}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <div>
                  <strong style={{color: '#00D4FF'}}>Auto-Indexing:</strong> Your answers are automatically indexed for auto-fill:
                  <ul style={{ margin: '8px 0 0 16px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    <li>After every <strong style={{color: 'rgba(255, 255, 255, 0.7)'}}>5 Q&A pairs</strong></li>
                    <li>After <strong style={{color: 'rgba(255, 255, 255, 0.7)'}}>10 minutes of inactivity</strong></li>
                    <li>Or click "Upload to KB" to index immediately</li>
                  </ul>
                </div>
              </div>
              {pendingIndexCount > 0 && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '10px 12px', 
                  background: 'rgba(255, 184, 0, 0.1)', 
                  border: '1px solid rgba(255, 184, 0, 0.3)',
                  borderRadius: '8px',
                  color: '#FFB800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <strong>{pendingIndexCount} Q&A pair(s)</strong> pending indexing (auto-indexes at 5)
                </div>
              )}
              <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  Stored locally
                </span>
                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export to backup
                </span>
                <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Private & secure
                </span>
              </div>
            </div>
          )}
        </div>
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
    </div>
  );
};

export default App;

