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
        Upload your personal and business documents to build your AI-powered knowledge base
      </p>

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

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
  );
};

export default App;

