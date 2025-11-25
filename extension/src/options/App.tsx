import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { KnowledgeChunk } from '../types';
import { saveChunks, getAllChunks, clearAllChunks, getChunkCount } from '../db';

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

const App: React.FC = () => {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
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
      const count = await getChunkCount();
      setChunks(allChunks);
      setChunkCount(count);
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

        const newChunks: KnowledgeChunk[] = await response.json();

        // Save chunks to IndexedDB
        await saveChunks(newChunks);

        successCount++;
        showStatus('success', `✓ Processed ${file.name}: ${newChunks.length} chunks extracted (${i + 1}/${files.length})`);
        
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

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      personal_basic: '#e8f0fe',
      personal_contact: '#fce8e6',
      startup_one_liner: '#e6f4ea',
      startup_problem: '#fef7e0',
      startup_solution: '#f3e8fd',
      startup_traction: '#e8f5e9',
      startup_team: '#fff3e0',
      startup_use_of_funds: '#fce4ec',
      insurance_profile: '#e0f2f1',
      generic_other: '#f5f5f5',
    };
    return colors[category] || '#f5f5f5';
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
        <h2>📊 Knowledge Base</h2>
        <div className="kb-stats">
          <div className="stat-card">
            <div className="stat-value">{chunkCount}</div>
            <div className="stat-label">Total Chunks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {new Set(chunks.map((c) => c.meta.source_file)).size}
            </div>
            <div className="stat-label">Source Files</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {new Set(chunks.map((c) => c.meta.category)).size}
            </div>
            <div className="stat-label">Categories</div>
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

      {/* Chunks Table */}
      <div className="section">
        <h2>📚 Knowledge Chunks</h2>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : chunks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div>No knowledge chunks yet. Upload some documents to get started!</div>
          </div>
        ) : (
          <table className="chunks-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Category</th>
                <th>Section</th>
                <th>Tags</th>
                <th>Length</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {chunks.map((chunk) => (
                <tr key={chunk.meta.id}>
                  <td>{chunk.meta.source_file}</td>
                  <td>
                    <span
                      className="category-badge"
                      style={{ background: getCategoryColor(chunk.meta.category) }}
                    >
                      {chunk.meta.category}
                    </span>
                  </td>
                  <td>{chunk.meta.section || '-'}</td>
                  <td>
                    {chunk.meta.tags.map((tag, i) => (
                      <span key={i} className="tag">
                        {tag}
                      </span>
                    ))}
                  </td>
                  <td>{chunk.meta.length_hint || '-'}</td>
                  <td>{chunk.meta.priority?.toFixed(2) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default App;

