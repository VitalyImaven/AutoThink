import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { saveDocumentIndex, getAllChunks, getAllDocuments, clearAllChunks, getChunkCount, getDocumentCount, getAllTags } from '../db';

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  text: string;
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
  const [enabled, setEnabled] = useState(true);
  const [autoSuggest, setAutoSuggest] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadKnowledgeBase();
    loadSettings();
  }, []);

  const loadSettings = () => {
    chrome.storage.sync.get(['enabled', 'autoSuggest'], (result) => {
      setEnabled(result.enabled !== false);
      setAutoSuggest(result.autoSuggest === true);
    });
  };

  const handleEnabledToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    chrome.storage.sync.set({ enabled: newEnabled });
    showStatus('info', `Extension ${newEnabled ? 'enabled' : 'disabled'}`);
  };

  const handleAutoSuggestToggle = () => {
    const newAutoSuggest = !autoSuggest;
    setAutoSuggest(newAutoSuggest);
    chrome.storage.sync.set({ autoSuggest: newAutoSuggest });
    showStatus('info', `Auto-suggest ${newAutoSuggest ? 'enabled' : 'disabled'}`);
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
    let successCount = 0;
    let errorCount = 0;

    const supportedTypes = [
      '.txt', '.md', '.pdf', '.docx', '.doc', 
      '.xlsx', '.xls', '.json', '.xml', '.pptx', '.ppt'
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();

      // Check file type
      const isSupported = supportedTypes.some(ext => fileName.endsWith(ext));
      if (!isSupported) {
        showStatus('error', `Skipped ${file.name}: Unsupported file type. Supported: ${supportedTypes.join(', ')}`);
        errorCount++;
        continue;
      }

      try {
        // Show progress
        showStatus('info', `📤 Uploading ${file.name} (${i + 1}/${files.length})...`);

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

        showStatus('info', `⚙️ Processing ${file.name}...`);

        const result = await response.json();

        // Save document index to IndexedDB (with discovered topics and chunks!)
        await saveDocumentIndex(result.document_index);

        successCount++;
        const summary = `✓ ${file.name}: ${result.document_index.discovered_topics.length} topics, ${result.document_index.all_tags.length} tags, ${result.document_index.chunk_count} chunks`;
        showStatus('success', summary);
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errorCount++;
        showStatus('error', `Failed to process ${file.name}: ${(error as Error).message}`);
      }
    }

    setUploading(false);

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


  const handleClearKnowledgeBase = async () => {
    if (!confirm('Are you sure you want to clear all knowledge? This cannot be undone.')) {
      return;
    }

    try {
      await clearAllChunks();
      await loadKnowledgeBase();
      showStatus('info', 'Knowledge base cleared');
    } catch (error) {
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
      <h1>🤖 AI Smart Autofill</h1>
      <p className="subtitle">
        Upload your personal and business documents to build your AI-powered knowledge base
      </p>

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.text}
        </div>
      )}

      {/* Extension Settings */}
      <div className="section">
        <h2>⚙️ Extension Settings</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="setting-card">
            <div className="setting-header">
              <span style={{ fontSize: '20px' }}>{enabled ? '✅' : '❌'}</span>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Extension Enabled</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {enabled ? 'Extension is active' : 'Extension is disabled'}
                </div>
              </div>
            </div>
            <button
              className={`btn ${enabled ? 'btn-danger' : 'btn-primary'}`}
              onClick={handleEnabledToggle}
              style={{ marginTop: '12px', width: '100%' }}
            >
              {enabled ? 'Disable Extension' : 'Enable Extension'}
            </button>
          </div>

          <div className="setting-card">
            <div className="setting-header">
              <span style={{ fontSize: '20px' }}>{autoSuggest ? '⚡' : '👆'}</span>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Suggestion Mode</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {autoSuggest ? 'Auto-suggest on focus' : 'Manual (right-click)'}
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAutoSuggestToggle}
              style={{ marginTop: '12px', width: '100%' }}
            >
              {autoSuggest ? 'Switch to Manual' : 'Enable Auto-Suggest'}
            </button>
          </div>
        </div>
        
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: '#f8f9fa', 
          borderRadius: '8px',
          fontSize: '14px',
          color: '#666'
        }}>
          💡 <strong>Tip:</strong> {autoSuggest 
            ? 'Auto-suggest will show suggestions automatically when you click on a field.' 
            : 'Right-click on any field and select "✨ AI Autofill Suggest" to get suggestions on demand.'}
        </div>
      </div>

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
              <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px', color: '#333' }}>
                📄 {doc.source_file}
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

