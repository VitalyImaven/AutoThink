import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { saveDocumentIndex, getAllChunks, getAllDocuments, clearAllChunks, deleteDocument, getChunkCount, getDocumentCount, getAllTags } from '../db';

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
  const [activeTab, setActiveTab] = useState<'upload' | 'interview'>('upload');
  const [chunks, setChunks] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    loadKnowledgeBase();
  }, []);

  useEffect(() => {
    // Auto-scroll logs to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [processingLogs]);

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
      // Save to backend file
      const response = await fetch(`${config.backendUrl}/interview/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: interviewProfile,
          conversation: messages.filter(m => m.role !== 'typing')
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('💾 Auto-saved:', result);
        addLog(`💾 Auto-saved ${result.total_qa_pairs} Q&A pairs to ${result.filename}`, 'success');
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  };

  const handleExportInterview = async () => {
    try {
      const response = await fetch(`${config.backendUrl}/interview/export/${interviewProfile}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${interviewProfile}_profile.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showStatus('success', `Exported ${interviewProfile} profile!`);
    } catch (error) {
      showStatus('error', 'Export failed: ' + (error as Error).message);
    }
  };

  const handleUploadInterviewToKB = async () => {
    try {
      addLog(`📤 Uploading ${interviewProfile} interview to knowledge base...`, 'info');
      
      // First, export the file content
      const response = await fetch(`${config.backendUrl}/interview/export/${interviewProfile}`);
      
      if (!response.ok) {
        throw new Error('No interview data found');
      }
      
      const text = await response.text();
      
      // Upload to knowledge base for indexing
      const uploadResponse = await fetch(`${config.backendUrl}/upload/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_file_name: `${interviewProfile}_profile.txt`,
          text: text
        })
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await uploadResponse.json();
      
      addLog(`✅ Indexed into knowledge base!`, 'success');
      addLog(`  🧠 ${result.document_index.discovered_topics.length} topics discovered`, 'success');
      addLog(`  🏷️ ${result.document_index.all_tags.length} tags generated`, 'success');
      addLog(`  📦 ${result.document_index.chunk_count} chunks created`, 'success');
      
      // Save to IndexedDB
      await saveDocumentIndex(result.document_index);
      await loadKnowledgeBase();
      
      showStatus('success', `${interviewProfile} profile added to knowledge base!`);
    } catch (error) {
      addLog(`❌ Upload failed: ${(error as Error).message}`, 'error');
      showStatus('error', 'Upload to KB failed: ' + (error as Error).message);
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
    if (!confirm('Are you sure you want to clear ALL documents? This cannot be undone.')) {
      return;
    }

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
      <h1>🤖 AI Smart Autofill - Knowledge Base</h1>
      <p className="subtitle">
        Build your AI-powered knowledge base through documents or interactive interviews
      </p>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '24px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'upload' ? '#667eea' : 'transparent',
            color: activeTab === 'upload' ? 'white' : '#666',
            borderBottom: activeTab === 'upload' ? '3px solid #667eea' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          📄 Upload Documents
        </button>
        <button
          onClick={() => setActiveTab('interview')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'interview' ? '#667eea' : 'transparent',
            color: activeTab === 'interview' ? 'white' : '#666',
            borderBottom: activeTab === 'interview' ? '3px solid #667eea' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          🎙️ Interactive Interview
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2>📋 Processing Log</h2>
            <button className="btn btn-secondary" onClick={clearLogs} style={{ padding: '6px 12px', fontSize: '13px' }}>
              Clear Log
            </button>
          </div>
          <div style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '16px',
            borderRadius: '8px',
            fontFamily: 'Monaco, Consolas, monospace',
            fontSize: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            lineHeight: '1.6'
          }}>
            {processingLogs.map((log, index) => (
              <div key={index} style={{
                color: log.type === 'success' ? '#4ec9b0' : log.type === 'error' ? '#f48771' : '#d4d4d4',
                marginBottom: '4px'
              }}>
                <span style={{ color: '#808080' }}>
                  [{log.timestamp.toLocaleTimeString()}]
                </span> {log.message}
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

        <div className="actions">
          <button className="btn btn-primary" onClick={loadKnowledgeBase} disabled={loading}>
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleClearKnowledgeBase}
            disabled={loading || chunkCount === 0}
          >
            🗑️ Clear All
          </button>
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
              background: '#f8f9fa',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #dee2e6'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ fontWeight: '600', fontSize: '16px', color: '#333', flex: 1 }}>
                📄 {doc.source_file}
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDeleteDocument(doc.document_id, doc.source_file)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  title="Delete this document"
                >
                  🗑️ Delete
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                Uploaded: {new Date(doc.uploaded_at).toLocaleString()} • {doc.chunk_count} chunks • {doc.all_tags.length} semantic tags
              </div>
              
              {doc.discovered_topics && doc.discovered_topics.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#555' }}>
                    🎯 Discovered Topics:
                  </div>
                  {doc.discovered_topics.map((topic: any, i: number) => (
                    <div key={i} style={{ marginLeft: '12px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#667eea' }}>
                        • {topic.topic}
                      </div>
                      {topic.subtopics && topic.subtopics.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#999', marginLeft: '12px' }}>
                          {topic.subtopics.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <details style={{ fontSize: '13px' }}>
                <summary style={{ cursor: 'pointer', color: '#667eea', fontWeight: '500' }}>
                  View All Tags ({doc.all_tags.length})
                </summary>
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px', 
                  background: 'white', 
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {doc.all_tags.map((tag: string, i: number) => (
                    <span key={i} className="tag" style={{ margin: '2px' }}>
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
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {/* Default profiles */}
            {['me', 'spouse'].map(profile => (
              <button
                key={profile}
                onClick={() => setInterviewProfile(profile)}
                style={{
                  padding: '10px 16px',
                  border: interviewProfile === profile ? '2px solid #667eea' : '1px solid #e0e0e0',
                  background: interviewProfile === profile ? '#f9f9ff' : 'white',
                  color: interviewProfile === profile ? '#667eea' : '#666',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                {profile === 'me' ? '👤 Me' : '💑 Spouse'}
              </button>
            ))}
            
            {/* Custom profiles */}
            {customProfiles.map(profile => (
              <button
                key={profile}
                onClick={() => setInterviewProfile(profile)}
                style={{
                  padding: '10px 16px',
                  border: interviewProfile === profile ? '2px solid #667eea' : '1px solid #e0e0e0',
                  background: interviewProfile === profile ? '#f9f9ff' : 'white',
                  color: interviewProfile === profile ? '#667eea' : '#666',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                👤 {profile.split('-').map(word => 
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
                    fontSize: '14px'
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
                  padding: '10px 16px',
                  border: '2px dashed #667eea',
                  background: 'white',
                  color: '#667eea',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
              >
                + Add Person
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddProfile()}
                  placeholder="Name (e.g., Jan, Mom, Friend)"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                    width: '150px'
                  }}
                  autoFocus
                />
                <button
                  onClick={handleAddProfile}
                  className="btn btn-primary"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowAddProfile(false);
                    setNewProfileName('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          
          <div style={{
            background: '#f8f9fa',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#666'
          }}>
            💡 <strong>Current Profile:</strong> {
              interviewProfile === 'me' ? 'Information about yourself' :
              interviewProfile === 'spouse' ? 'Information about your spouse/partner' :
              interviewProfile.startsWith('kid') ? `Information about ${interviewProfile.replace('kid-', 'child ')}` :
              'Information about another person'
            }
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
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            height: '400px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              background: '#f5f5f5'
            }}>
              {interviewMessages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎙️</div>
                  <p style={{ marginBottom: '16px' }}>No interview started yet</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setInterviewMessages([{
                        role: 'assistant',
                        content: `Hi! Let's gather information about ${interviewProfile === 'me' ? 'you' : interviewProfile}. I'll ask you questions to build a comprehensive profile. Ready to start?`
                      }]);
                    }}
                    style={{ marginTop: '8px' }}
                  >
                    🚀 Start Interview
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
                          background: 'white',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                        }}
                      >
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#667eea',
                          margin: '0 3px',
                          animation: 'typing 1.4s infinite'
                        }}></span>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#667eea',
                          margin: '0 3px',
                          animation: 'typing 1.4s infinite 0.2s'
                        }}></span>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#667eea',
                          margin: '0 3px',
                          animation: 'typing 1.4s infinite 0.4s'
                        }}></span>
                        <style>{`
                          @keyframes typing {
                            0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
                            30% { transform: translateY(-8px); opacity: 1; }
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
                            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                            'white',
                          color: msg.role === 'user' ? 'white' : '#333',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          boxShadow: msg.role === 'assistant' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
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
                padding: '12px',
                background: 'white',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                gap: '8px',
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
                  placeholder={isRecording ? "Recording... Click button to stop" : "Type your answer or click 🎤 to speak..."}
                  disabled={interviewProcessing || isRecording}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '20px',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'inherit'
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
                    padding: '10px 20px',
                    background: isRecording ? '#dc3545' : 
                               interviewInput.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' :
                               '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: isRecording || !interviewInput.trim() ? '16px' : '13px',
                    fontWeight: '500',
                    minWidth: isRecording || !interviewInput.trim() ? '48px' : '70px',
                    transition: 'all 0.3s',
                    animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                  }}
                  title={
                    isRecording ? 'Click to stop recording' :
                    interviewInput.trim() ? 'Send message' :
                    'Click to start voice input'
                  }
                >
                  {isRecording ? '⏹️' : 
                   interviewInput.trim() ? 'Send' :
                   '🎤'}
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
              marginTop: '12px',
              padding: '12px',
              background: '#f8f9fa',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#666'
            }}>
              💡 <strong>Auto-Save:</strong> Conversation is automatically saved to <code>backend/interview_data/{interviewProfile}_profile.txt</code> after each exchange.
              You can export it or upload to knowledge base anytime!
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  );
};

export default App;

