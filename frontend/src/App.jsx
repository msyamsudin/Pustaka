import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, CheckCircle, Search, AlertCircle, Sparkles, Settings, Save, RefreshCw, History, X, Trash2, BookOpen, RotateCcw, Home, PenTool, Eye, EyeOff, Copy, Check, Tag, Edit3, Bold, Italic, List, Quote, Heading, Code, Minus, MessageSquarePlus, Share2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";


const getImageUrl = (url, timestamp) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:')) return url;

  // Handle relative paths (with or without leading slash)
  const baseUrl = API_BASE_URL.replace('/api', '');
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;

  // Cache busting: append timestamp if provided
  const fullUrl = `${baseUrl}${cleanUrl}`;
  return timestamp ? `${fullUrl}?t=${new Date(timestamp).getTime()}` : fullUrl;
};

const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setSearch(value);
    }
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        // On close, reset search to value if logic requires, but simple close is fine 
        // Logic handled by effect above (if !isOpen -> search=value)
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (opt) => {
    onChange(opt);
    setSearch(opt);
    setIsOpen(false);
  };

  return (
    <div className="searchable-select-container" ref={containerRef}>
      <input
        type="text"
        className="input-field"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearch("");
        }}
        placeholder={placeholder}
        style={{ marginBottom: 0 }}
      />
      {isOpen && (
        <div className="searchable-select-menu custom-scrollbar animate-fade-in">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt}
                className={`searchable-select-item ${opt === value ? "selected" : ""}`}
                onClick={() => handleSelect(opt)}
              >
                {opt}
              </div>
            ))
          ) : (
            <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Tidak ditemukan
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SimpleModal = ({ isOpen, title, message, onClose, onConfirm, confirmText = "OK", cancelText = "Batal", isDanger = false, showCancel = true }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', textAlign: 'center' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.25rem' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          {showCancel && (
            <button onClick={onClose} className="btn-secondary" style={{ minWidth: '80px' }}>
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className={isDanger ? "btn-danger" : "btn-primary"}
            style={{ minWidth: '80px', color: isDanger ? 'white' : '' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const CoverSelectionModal = ({ isOpen, book, onClose, onSave }) => {
  const [candidates, setCandidates] = useState([]);
  const [customUrl, setCustomUrl] = useState('');
  const [selectedUrl, setSelectedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && book) {
      setSearchQuery(`${book.title} ${book.author}`);
      setCandidates([]);
      setSelectedUrl(book.image_url || '');
      setCustomUrl('');
      // Pre-populate with existing verified sources if any
      const existing = book.summaries?.[0]?.metadata?.sources
        .filter(s => s.image_url)
        .map(s => ({ url: s.image_url, source: s.source })) || [];

      // Also add current book image if not in sources (e.g. manually set before)
      if (book.image_url && !existing.find(e => e.url === book.image_url)) {
        existing.unshift({ url: book.image_url, source: 'Current' });
      }
      setCandidates(existing);

      // Auto-search if no candidates
      if (existing.length === 0) {
        handleSearch(`${book.title} ${book.author}`);
      }
    }
  }, [isOpen, book]);

  const handleSearch = async (query) => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/covers/search`, { params: { query } });
      // Merge with existing but avoid duplicates
      setCandidates(prev => {
        const newOnes = res.data.filter(n => !prev.find(p => p.url === n.url));
        return [...prev, ...newOnes];
      });
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const finalUrl = selectedUrl === 'custom' ? customUrl : selectedUrl;
    onSave(finalUrl);
  };

  if (!isOpen || !book) return null;

  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 1200 }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '700px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Ganti Sampul: "{book.title}"</h3>
          <button onClick={onClose} className="icon-btn"><X size={20} /></button>
        </div>

        <div className="input-group">
          <label>Cari Kandidat Sampul</label>
          <div className="mobile-stack" style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
            />
            <button className="btn-secondary" onClick={() => handleSearch(searchQuery)} disabled={loading} style={{ minWidth: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Pilih Sampul:</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
            {candidates.map((cand, index) => (
              <div
                key={index}
                className={`cover-option ${selectedUrl === cand.url ? 'selected' : ''}`}
                onClick={() => { setSelectedUrl(cand.url); setCustomUrl(''); }}
                style={{
                  aspectRatio: '2/3', border: `2px solid ${selectedUrl === cand.url ? 'var(--accent-color)' : 'transparent'}`,
                  borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)', backgroundColor: '#000'
                }}
              >
                <img src={getImageUrl(cand.url)} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />

                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.65rem', padding: '2px 4px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cand.source}
                </div>

                {selectedUrl === cand.url && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent-color)', borderRadius: '50%', padding: '2px', display: 'flex' }}>
                    <CheckCircle size={14} color="white" />
                  </div>
                )}
              </div>
            ))}
            {candidates.length === 0 && !loading && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Tidak ada kandidat. Coba cari manual.
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Atau URL Gambar Manual:</label>
          <input
            type="text"
            className="input-field"
            placeholder="https://example.com/cover.jpg"
            value={customUrl}
            onChange={(e) => { setCustomUrl(e.target.value); setSelectedUrl('custom'); }}
          />
          {customUrl && selectedUrl === 'custom' && (
            <div style={{ width: '80px', height: '120px', border: '2px solid var(--accent-color)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem' }}>
              <img src={customUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={onClose} className="btn-secondary">Batal</button>
          <button onClick={handleSave} className="btn-primary" disabled={(!selectedUrl || (selectedUrl === 'custom' && !customUrl))}>Simpan Sampul</button>
        </div>
      </div>
    </div>
  );
};


const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="animate-fade-in" style={{
      position: 'fixed', bottom: '24px', right: '24px',
      backgroundColor: type === 'error' ? 'var(--error)' : 'var(--success)',
      color: 'white', padding: '1rem 1.5rem', borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 2000,
      display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '500'
    }}>
      {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
      {message}
    </div>
  );
};



const SkeletonSummary = ({ status, progress, onStop }) => (
  <div className="glass-card animate-slide-up" style={{ marginBottom: '2rem', border: '1px dashed var(--border-color)', position: 'relative', overflow: 'hidden' }}>
    {/* Progress Bar Background */}
    {progress > 0 && (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '4px',
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        zIndex: 10
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--accent-color), #60a5fa)',
          boxShadow: '0 0 10px var(--accent-color)',
          transition: 'width 0.4s ease-out'
        }}></div>
      </div>
    )}

    <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: progress > 0 ? '1rem 0 0 0' : '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <div className="spinner" style={{ width: '20px', height: '20px', flexShrink: 0 }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {status || "Initializing intelligence synthesis engine..."}
          </span>
          {progress > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              PHASE PROGRESS: {progress}%
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onStop}
        className="btn-secondary"
        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
      >
        <X size={14} /> Batal
      </button>
    </div>
    <div className="skeleton-block" style={{ width: '90%' }}></div>
    <div className="skeleton-block" style={{ width: '95%' }}></div>
    <div className="skeleton-block" style={{ width: '85%' }}></div>
    <div className="skeleton-block" style={{ width: '40%', marginTop: '1.5rem' }}></div>
    <div className="skeleton-block" style={{ width: '92%' }}></div>
    <div className="skeleton-block" style={{ width: '88%' }}></div>
  </div>
);

const MetadataEditModal = ({ isOpen, book, title, author, isbn, genre, setTitle, setAuthor, setIsbn, setGenre, onSave, onClose, isSaving }) => {
  if (!isOpen || !book) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card animate-scale-up" style={{ maxWidth: '500px', width: '90%' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit Info Buku</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Judul</label>
          <input
            type="text"
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Penulis</label>
          <input
            type="text"
            className="input-field"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ISBN</label>
          <input
            type="text"
            className="input-field"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Genre</label>
          <input
            type="text"
            className="input-field"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Contoh: Computer Science, Fiction"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>Batal</button>
          <button className="btn-primary" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [diversityAnalysis, setDiversityAnalysis] = useState(null);
  const [synthesisMetadata, setSynthesisMetadata] = useState(null);

  const [error, setError] = useState(null);

  // Settings
  const [provider, setProvider] = useState('OpenRouter');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.0-flash-exp:free');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [notionApiKey, setNotionApiKey] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [isNotionSharing, setIsNotionSharing] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [keyValid, setKeyValid] = useState(null); // null, true, false
  const [keyError, setKeyError] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [backendUp, setBackendUp] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedSummaries, setSavedSummaries] = useState([]);
  const [showIsbn, setShowIsbn] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedId, setSavedId] = useState(null); // Track if current summary is saved

  const [currentBook, setCurrentBook] = useState(null); // Track which book is currently loaded
  const [currentVariant, setCurrentVariant] = useState(null); // Track active variant
  const [existingSummary, setExistingSummary] = useState(null); // Proactive duplicate check

  // Custom Modals State
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null, isDanger: false });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });
  const [toast, setToast] = useState(null); // { message, type }

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState(null);

  // Streaming & UI Enhancements
  const [streamingStatus, setStreamingStatus] = useState('');
  const [tokensReceived, setTokensReceived] = useState(0);
  const [highQuality, setHighQuality] = useState(false);
  const [draftCount, setDraftCount] = useState(3);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);
  const abortControllerRef = useRef(null);

  const [isStuck, setIsStuck] = useState(false);
  const headerRef = useRef(null);
  const libraryContentRef = useRef(null);

  // Cover Edit State
  const [coverEditBook, setCoverEditBook] = useState(null);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

  // Elaboration State
  const [selectionContext, setSelectionContext] = useState(null);
  const [elaborationChat, setElaborationChat] = useState([]); // Array of {role: 'user'|'ai', content: string}
  const [isElaborating, setIsElaborating] = useState(false);
  const [elaborationQuery, setElaborationQuery] = useState("");
  const [showElaborationPanel, setShowElaborationPanel] = useState(false);

  const [progress, setProgress] = useState(0);

  // Refinement State
  const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refinedPreview, setRefinedPreview] = useState(null);
  const [isRefinementPreviewOpen, setIsRefinementPreviewOpen] = useState(false);

  // Note Review State
  const [isNoteReviewOpen, setIsNoteReviewOpen] = useState(false);
  const [noteReviewContent, setNoteReviewContent] = useState("");
  const [notes, setNotes] = useState([]); // Dedicated notes state
  const [editingNoteId, setEditingNoteId] = useState(null); // Track note being edited
  const noteReviewTextareaRef = useRef(null);

  // Editor Toolbar Handler
  const handleFormat = (command) => {
    const textarea = noteReviewTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = noteReviewContent;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    let newText = text;
    let newCursorPos = end;

    switch (command) {
      case 'bold':
        newText = `${before}**${selection}**${after}`;
        newCursorPos = end + 4;
        break;
      case 'italic':
        newText = `${before}*${selection}*${after}`;
        newCursorPos = end + 2;
        break;
      case 'h2':
        newText = `${before}\n## ${selection}${after}`;
        newCursorPos = end + 4;
        break;
      case 'quote':
        newText = `${before}\n> ${selection}${after}`;
        newCursorPos = end + 3;
        break;
      case 'list':
        newText = `${before}\n- ${selection}${after}`;
        newCursorPos = end + 3;
        break;
      case 'code':
        newText = `${before}\`${selection}\`${after}`;
        newCursorPos = end + 2;
        break;
      case 'hr':
        newText = `${before}\n\n---\n\n${after}`;
        newCursorPos = start + 5;
        break;
      default:
        return;
    }

    setNoteReviewContent(newText);

    // Defer focus restoration
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Selection Handler
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
        // Only clear if we are NOT interacting with the elaboration panel
        if (!showElaborationPanel) {
          setSelectionContext(null);
        }
        return;
      }

      // Check if selection is within markdown content
      const markdownEl = document.querySelector('.markdown-content');
      if (markdownEl && markdownEl.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionContext({
          text: selection.toString(),
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          }
        });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [showElaborationPanel]);

  const handleElaborate = async () => {
    if (!selectionContext) return;

    const currentQuery = elaborationQuery.trim();
    // Optimistic update
    const newHistory = [...elaborationChat];
    if (currentQuery) {
      newHistory.push({ role: 'user', content: currentQuery });
    } else if (newHistory.length === 0) {
      // Initial auto-query if empty
      newHistory.push({ role: 'user', content: "Jelaskan ini." });
    }

    setElaborationChat(newHistory);
    setElaborationQuery(""); // Clear input
    setIsElaborating(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/elaborate`, {
        selection: selectionContext.text,
        query: currentQuery,
        context: summary,
        history: newHistory.map(msg => ({ role: msg.role, content: msg.content })),
        api_key: provider === 'OpenRouter' ? openRouterKey : (provider === 'Groq' ? groqKey : null),
        provider: provider,
        model: provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel),
        base_url: ollamaBaseUrl
      });

      if (res.data.error) {
        showAlert("Error", res.data.error);
      } else {
        setElaborationChat(prev => [...prev, { role: 'ai', content: res.data.content }]);
      }
    } catch (err) {
      console.error("Elaboration failed", err);
      showAlert("Error", "Gagal melakukan elaborasi.");
    } finally {
      setIsElaborating(false);
    }
  };

  const handleInitiateSave = () => {
    if (elaborationChat.length === 0) return;

    let chatLog = "";
    elaborationChat.forEach(msg => {
      const icon = msg.role === 'ai' ? "🤖 PustakaAI" : "👤 User";
      chatLog += `**${icon}:** ${msg.content.trim()}\n\n`;
    });

    const noteEntry = `### 💡 Diskusi Elaborasi\n*Ref: "${selectionContext.text.substring(0, 80)}..."*\n\n${chatLog.trim()}`;

    setNoteReviewContent(noteEntry);
    setEditingNoteId(null);
    setIsNoteReviewOpen(true);
  };

  const handleEditNote = (note) => {
    setNoteReviewContent(note.content_markdown);
    setEditingNoteId(note.id);
    setIsNoteReviewOpen(true);
  };

  const handleDeleteNote = (noteId) => {
    showConfirm(
      "Hapus Catatan?",
      "Apakah Anda yakin ingin menghapus catatan ini secara permanen?",
      async () => {
        try {
          await axios.delete(`${API_BASE_URL}/saved/${savedId}/notes/${noteId}`);
          setNotes(prev => prev.filter(n => n.id !== noteId));
          // Update local library state
          setSavedSummaries(prev => prev.map(book => {
            if (book.summaries.some(s => s.id === savedId)) {
              return {
                ...book,
                summaries: book.summaries.map(s =>
                  s.id === savedId ? {
                    ...s,
                    notes: s.notes.filter(n => n.id !== noteId),
                    timestamp: new Date().toISOString()
                  } : s
                ),
                last_updated: new Date().toISOString()
              };
            }
            return book;
          }));
          showToast("Catatan dihapus", "success");
        } catch (err) {
          console.error("Failed to delete note", err);
          showToast("Gagal menghapus catatan", "error");
        }
      },
      true // isDanger
    );
  };

  const handleFinalizeSave = async () => {
    // Convert HTML back to Markdown
    const markdownContent = noteReviewContent.trim();

    // Persistent storage integration (New Architecture: Dedicated Notes)
    if (savedId) {
      try {
        let newNote;
        if (editingNoteId) {
          // Update existing note
          const res = await axios.put(`${API_BASE_URL}/saved/${savedId}/notes/${editingNoteId}`, {
            content_markdown: markdownContent
          });
          newNote = res.data;
          setNotes(prev => prev.map(n => n.id === editingNoteId ? newNote : n));
        } else {
          // Create new note
          const res = await axios.post(`${API_BASE_URL}/saved/${savedId}/notes`, {
            ref_text: selectionContext?.text || "Manual Note",
            content_markdown: markdownContent
          });
          newNote = res.data;
          setNotes(prev => [...prev, newNote]);
        }

        // Also update the local savedSummaries list to stay in sync
        setSavedSummaries(prev => prev.map(book => {
          if (book.summaries.some(s => s.id === savedId)) {
            return {
              ...book,
              summaries: book.summaries.map(s =>
                s.id === savedId ? {
                  ...s,
                  notes: editingNoteId
                    ? s.notes.map(n => n.id === editingNoteId ? newNote : n)
                    : [...(s.notes || []), newNote],
                  timestamp: new Date().toISOString()
                } : s
              ),
              last_updated: new Date().toISOString()
            };
          }
          return book;
        }));
        showToast(editingNoteId ? "Catatan diperbarui" : "Diskusi berhasil diarsipkan ke Lampiran", "success");
      } catch (err) {
        console.error("Failed to save note", err);
        showToast("Gagal menyimpan catatan ke backend", "error");
      }
    } else {
      // Fallback: If not saved, we can still append to local summary for now 
      // or show a warning. Let's append to local summary as a fallback.
      const newSummary = (summary || "").trim() + "\n\n---\n\n" + markdownContent;
      setSummary(newSummary);
      showToast("Diskusi ditambahkan ke ringkuman (Belum diarsipkan)", "info");
    }

    setIsNoteReviewOpen(false);
    setNoteReviewContent("");
    setEditingNoteId(null);

    // Cleanup Elaboration
    setShowElaborationPanel(false);
    setElaborationChat([]);
    setElaborationQuery("");
    setSelectionContext(null);
    window.getSelection()?.removeAllRanges();
  };

  const showAlert = (title, message) => {
    setAlertModal({ isOpen: true, title, message });
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const closeAlert = () => {
    setAlertModal({ ...alertModal, isOpen: false });
  };

  const showConfirm = (title, message, onConfirm, isDanger = false) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, isDanger });
  };

  const closeConfirm = () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const handleUpdateCover = async (newUrl) => {
    if (!coverEditBook) return;
    try {
      const response = await axios.put(`${API_BASE_URL}/books/${coverEditBook.id}/cover`, { image_url: newUrl });
      const serverPath = response.data; // Backend returns the new local path string

      // Update local summaries list immediately
      setSavedSummaries(prev => prev.map(book => {
        if (book.id === coverEditBook.id) {
          return { ...book, image_url: serverPath, last_updated: new Date().toISOString() };
        }
        return book;
      }));

      // Update current book if it's the one we're looking at
      if (currentBook && currentBook.id === coverEditBook.id) {
        setCurrentBook(prev => ({
          ...prev,
          image_url: serverPath,
          last_updated: new Date().toISOString()
        }));
      }

      setIsCoverModalOpen(false);
      setCoverEditBook(null);
      showToast("Sampul berhasil diperbarui");
    } catch (err) {
      console.error("Failed to update cover", err);
      showAlert("Gagal", "Gagal memperbarui sampul buku.");
    }
  };

  useEffect(() => {
    // Load History
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const checkBackendAndLoadConfig = async () => {
      try {
        await axios.get(`${API_BASE_URL.replace('/api', '')}/`);
        setBackendUp(true);

        // Load Config
        const configRes = await axios.get(`${API_BASE_URL}/config`);
        if (configRes.data) {
          if (configRes.data.provider) setProvider(configRes.data.provider);

          if (configRes.data.openrouter_key) {
            setOpenRouterKey(configRes.data.openrouter_key);
            // We'll validate below if the provider is OpenRouter
          }
          if (configRes.data.openrouter_model) setOpenRouterModel(configRes.data.openrouter_model);

          if (configRes.data.ollama_base_url) setOllamaBaseUrl(configRes.data.ollama_base_url);
          if (configRes.data.ollama_model) setOllamaModel(configRes.data.ollama_model);

          if (configRes.data.groq_key) setGroqKey(configRes.data.groq_key);
          if (configRes.data.groq_model) setGroqModel(configRes.data.groq_model);

          if (configRes.data.notion_api_key) setNotionApiKey(configRes.data.notion_api_key);
          if (configRes.data.notion_database_id) setNotionDatabaseId(configRes.data.notion_database_id);

          // Initial model fetch based on active provider
          const activeProvider = configRes.data.provider || 'OpenRouter';
          if (activeProvider === 'OpenRouter' && configRes.data.openrouter_key) {
            validateApiKey(configRes.data.openrouter_key, false, 'OpenRouter');
          } else if (activeProvider === 'Groq' && configRes.data.groq_key) {
            validateApiKey(configRes.data.groq_key, false, 'Groq');
          } else if (activeProvider === 'Ollama') {
            validateApiKey(null, false, 'Ollama', configRes.data.ollama_base_url || 'http://localhost:11434');
          }

          setConfigLoaded(true);
        }
      } catch (err) {
        setBackendUp(false);
      }
    };
    checkBackendAndLoadConfig();

    // Scroll listener for sticky header
    const handleScroll = () => {
      if (headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        // If the header reaches the top, mark it as stuck
        setIsStuck(rect.top <= 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Metadata Edit Modal State
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [metadataEditBook, setMetadataEditBook] = useState(null);
  const [metadataTitle, setMetadataTitle] = useState("");
  const [metadataAuthor, setMetadataAuthor] = useState("");
  const [metadataIsbn, setMetadataIsbn] = useState("");
  const [metadataGenre, setMetadataGenre] = useState("");
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Load saved summaries when opening library
  useEffect(() => {
    if (showLibrary && libraryContentRef.current) {
      libraryContentRef.current.scrollTop = 0;
    }
  }, [savedSummaries, showLibrary]);

  const loadSavedSummaries = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/saved`);
      // Sort by last_updated descending (newest first)
      const sorted = res.data.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
      setSavedSummaries(sorted);
    } catch (err) {
      console.error("Failed to load saved summaries", err);
    }
  };

  useEffect(() => {
    loadSavedSummaries();
  }, []);

  const handleSaveSummary = async () => {
    if (!summary || !verificationResult) return;

    // Check if image exists in sources
    let imageUrl = "";
    if (verificationResult.sources) {
      // Find first valid image_url in sources
      for (const src of verificationResult.sources) {
        if (src.image_url) {
          imageUrl = src.image_url;
          break;
        }
      }
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/save`, {
        title: title || currentBook?.title || verificationResult.sources[0]?.title || "Unknown Title",
        author: author || currentBook?.author || verificationResult.sources[0]?.author || "Unknown Author",
        summary_content: summary,
        usage_stats: usageStats || {},
        metadata: {
          isbn: isbn,
          genre: currentBook?.genre || (verificationResult.sources.find(s => s.genre)?.genre || ""),
          sources: verificationResult.sources,
          image_url: imageUrl
        }
      });

      const newVariant = response.data;
      setSavedId(newVariant.id);
      setCurrentVariant(newVariant);
      showToast("Intelligence Brief berhasil disimpan");
      loadSavedSummaries();
    } catch (err) {
      showAlert("Gagal Menyimpan", "Terjadi kesalahan saat menyimpan rangkuman.");
    }
  };

  const handleDeleteCurrent = () => {
    if (!savedId || !currentVariant) return;

    const bookTitle = currentBook?.title || title || (verificationResult?.sources?.[0]?.title) || "Buku Ini";
    const modelName = currentVariant.model ? currentVariant.model.split('/').pop() : "Unknown Model";

    showConfirm(
      "Hapus Intelligence Brief",
      `Apakah Anda yakin ingin menghapus brief buku "${bookTitle}" versi model "${modelName}" dari arsip?`,
      () => performDeleteCurrent(savedId),
      true
    );
  };

  const performDeleteCurrent = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/saved/${id}`);

      // Fetch updated list to check current book status
      const res = await axios.get(`${API_BASE_URL}/saved`);
      const sorted = res.data.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
      setSavedSummaries(sorted);

      if (currentBook) {
        // Find this book in the updated list
        const updatedBook = sorted.find(b => b.id === currentBook.id);

        if (updatedBook && updatedBook.summaries && updatedBook.summaries.length > 0) {
          // Stay on book, load the first available summary variant
          setCurrentBook(updatedBook);
          loadVariant(updatedBook.summaries[0]);
        } else {
          // No more summaries for this book, return to home
          handleReset();
        }
      } else {
        setSavedId(null);
      }

      showToast("Intelligence Brief dihapus dari arsip.", "success");
    } catch (err) {
      console.error("Delete failed:", err);
      showAlert("Error", "Gagal menghapus rangkuman.");
    }
  };

  const handleDeleteBook = (bookId, e) => {
    e.stopPropagation();
    const book = savedSummaries.find(b => b.id === bookId);
    setBookToDelete(book);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteBook = async () => {
    if (!bookToDelete) return;
    try {
      await axios.delete(`${API_BASE_URL}/books/${bookToDelete.id}`);
      loadSavedSummaries();
      if (currentBook && currentBook.id === bookToDelete.id) {
        handleReset();
      }
      showAlert("Terhapus", `Buku "${bookToDelete.title}" dihapus dari arsip.`);
    } catch (err) {
      console.error("Failed to delete book", err);
      showAlert("Error", "Gagal menghapus buku.");
    } finally {
      setDeleteConfirmOpen(false);
      setBookToDelete(null);
    }
  }

  const loadFromLibrary = (book) => {
    setCurrentBook(book);
    if (book.summaries && book.summaries.length > 0) {
      loadVariant(book.summaries[0]);
    }
    setShowLibrary(false);

    setIsbn(book.isbn || '');

    // Populate verificationResult with a source reconstructed from saved data
    // This is CRITICAL for 'Regenerate' and other features that read from verificationResult.sources
    const reconstructedSource = {
      source: "Library",
      title: book.title,
      author: book.author,
      genre: book.genre || "",
      image_url: book.image_url || "",
      description: "Data dimuat dari perpustakaan lokal."
    };

    setVerificationResult({
      is_valid: true,
      sources: [reconstructedSource],
      status: 'success',
      message: "Loaded from Library",
      title: book.title,
      authors: [book.author]
    });
  };

  const loadVariant = (variant) => {
    setCurrentVariant(variant);
    setSummary(variant.summary_content);
    setUsageStats(variant.usage_stats);
    setSavedId(variant.id);
    setNotes(variant.notes || []); // Load associated notes
  };

  const validateApiKey = async (key, shouldSave = true, targetProvider = provider, baseUrl = ollamaBaseUrl) => {
    if (targetProvider === 'OpenRouter' && !key) { setKeyValid(null); setKeyError(''); return; }

    setValidatingKey(true);
    setKeyValid(null);
    setKeyError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/models`, {
        provider: targetProvider,
        api_key: key,
        base_url: baseUrl
      });
      if (response.data.valid) {
        setKeyValid(true);
        setAvailableModels(response.data.models);
        if (shouldSave) {
          saveConfig({
            provider: targetProvider,
            openrouter_key: targetProvider === 'OpenRouter' ? key : openRouterKey,
            groq_key: targetProvider === 'Groq' ? key : groqKey,
            ollama_base_url: targetProvider === 'Ollama' ? baseUrl : ollamaBaseUrl,
            notion_api_key: notionApiKey,
            notion_database_id: notionDatabaseId
          });
        }
      }
    } catch (err) {
      setKeyValid(false);
      if (err.code === "ERR_NETWORK") {
        setKeyError(targetProvider === 'Ollama' ? "Gagal terhubung ke Ollama. Pastikan Ollama berjalan." : "Gagal terhubung ke Backend. Server mati?");
      } else {
        const msg = err.response?.data?.detail || err.message;
        setKeyError(msg);
      }
    } finally {
      setValidatingKey(false);
    }
  };

  const saveConfig = async (updates) => {
    try {
      await axios.post(`${API_BASE_URL}/config`, updates);
    } catch (err) {
      console.error("Failed to save config", err);
    }
  };

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    if (provider === 'OpenRouter') {
      setOpenRouterModel(newModel);
      saveConfig({ openrouter_model: newModel });
    } else if (provider === 'Groq') {
      setGroqModel(newModel);
      saveConfig({ groq_model: newModel });
    } else {
      setOllamaModel(newModel);
      saveConfig({ ollama_model: newModel });
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setVerificationResult(null);
    setSummary(null);
    setError(null);
    setCurrentBook(null); // Reset current book context on new search

    // Add to history
    if (isbn || title || author) {
      addToHistory({ isbn, title, author });
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/verify`, {
        isbn: isbn || null,
        title: title || null,
        author: author || null
      });
      setVerificationResult(response.data);
      setBackendUp(true);
    } catch (err) {
      if (err.code === "ERR_NETWORK") {
        setBackendUp(false);
        setError("Gagal terhubung ke Backend Server. Pastikan 'backend' sudah dijalankan (port 8000).");
      } else {
        setError("Terjadi kesalahan pada server.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Check for existing summary proactively
  useEffect(() => {
    if (!verificationResult || !verificationResult.is_valid) {
      setExistingSummary(null);
      return;
    }

    const currentIsbn = isbn ? isbn.replace(/-/g, '') : null;
    const currentTitle = title || verificationResult.sources[0]?.title;
    const currentAuthor = author || verificationResult.sources[0]?.author;

    const existingBook = savedSummaries.find(b => {
      const bIsbn = b.isbn ? b.isbn.replace(/-/g, '') : null;
      if (currentIsbn && bIsbn === currentIsbn) return true;
      return (
        b.title.toLowerCase() === (currentTitle || "").toLowerCase() &&
        b.author.toLowerCase() === (currentAuthor || "").toLowerCase()
      );
    });

    if (existingBook) {
      const currentActiveModel = provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel);
      const found = existingBook.summaries.find(s => s.model === currentActiveModel);
      if (found) {
        setExistingSummary({ book: existingBook, variant: found });
        return;
      }
    }
    setExistingSummary(null);
  }, [verificationResult, provider, openRouterModel, groqModel, ollamaModel, isbn, title, author, savedSummaries]);

  const handleSummarize = async (isResume = false, force = false, overrideConfig = null) => {
    if (existingSummary && !isResume && !force) {
      setCurrentBook(existingSummary.book);
      loadVariant(existingSummary.variant);
      showToast("Memuat Intelligence Brief tersimpan...", "success");
      return;
    }

    if (!verificationResult || !verificationResult.is_valid) return;

    setSummarizing(true);
    setError(null);
    if (!isResume) {
      setSummary(null);
      setUsageStats(null);
      setSavedId(null);
      setNotes([]); // Reset notes for new summary
      setCurrentVariant(null);
      setTokensReceived(0);
      setProgress(0);
    }
    setStreamingStatus(isResume ? "Re-establishing knowledge gateway..." : "Initializing synthesis engine...");

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          metadata: verificationResult.sources,
          provider: overrideConfig ? overrideConfig.provider : provider,
          api_key: overrideConfig
            ? (overrideConfig.provider === 'OpenRouter' ? openRouterKey : overrideConfig.provider === 'Groq' ? groqKey : null)
            : (provider === 'OpenRouter' ? openRouterKey : (provider === 'Groq' ? groqKey : null)),
          model: overrideConfig ? overrideConfig.model : (provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)),
          base_url: overrideConfig ? overrideConfig.base_url : (provider === 'Ollama' ? ollamaBaseUrl : null),
          partial_content: isResume ? summary : null,
          enhance_quality: highQuality,
          draft_count: highQuality ? draftCount : 1
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Gagal membuat rangkuman.");
      }

      setStreamingStatus(isResume ? "Resuming synthesis flow..." : "AI is analyzing conceptual book architecture...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedSummary = (isResume === true && summary) ? summary : "";
      let tokenCount = isResume ? tokensReceived : 0;
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.error) {
                setError(`Error: ${data.error}`);
                setSummarizing(false);
                return;
              }

              if (data.status) {
                setStreamingStatus(data.status);
              }

              if (data.progress) {
                setProgress(data.progress);
              }

              if (data.content) {
                if (firstChunk) {
                  setStreamingStatus(isResume ? "Resuming synthesis flow..." : "Generating intelligence brief...");
                  firstChunk = false;
                }
                accumulatedSummary += data.content;
                setSummary(accumulatedSummary);
                tokenCount += 1;
                setTokensReceived(tokenCount);
              }

              if (data.done) {
                setUsageStats({
                  model: data.model,
                  provider: data.provider,
                  tokens: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                  cost_estimate: data.cost_estimate || { total_usd: 0, total_idr: 0, is_free: true },
                  duration_seconds: data.duration_seconds,
                  is_enhanced: data.is_enhanced,
                  draft_count: data.draft_count
                });
                if (data.is_enhanced) {
                  showToast("Kualitas ditingkatkan via Refining Mode", "success");
                }
              }
            } catch (e) {
              console.error("Error parsing stream chunk", e, line);
            }
          }
        }
      }
      setBackendUp(true);
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast("Generasi dihentikan", "info");
      } else {
        console.error("Summarize error:", err);
        setError(`Error: ${err.message}`);
      }
    } finally {
      setSummarizing(false);
      setStreamingStatus('');
      abortControllerRef.current = null;
    }
  };

  const handleSynthesize = async () => {
    if (selectedVariantIds.length < 2) {
      showAlert("Pilih Minimal 2", "Silakan pilih setidaknya 2 versi brief untuk disintesis.");
      return;
    }

    setSummarizing(true);
    setStreamingStatus("Menyintesis varian terpilih...");
    setError(null);
    setSummary(null);
    setUsageStats(null);
    setSavedId(null);
    setNotes([]); // Reset notes for synthesis
    setCurrentVariant(null);
    setTokensReceived(0);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          summary_ids: selectedVariantIds,
          provider: provider,
          model: provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Gagal menyintesis intelligence brief.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedSummary = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.status) {
                setStreamingStatus(data.status);
              }

              if (data.progress) {
                setProgress(data.progress);
              }

              if (data.content) {
                accumulatedSummary += data.content;
                setSummary(accumulatedSummary);
              }

              if (data.done) {
                setUsageStats({
                  model: data.model,
                  provider: data.provider,
                  tokens: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                  cost_estimate: data.cost_estimate || { total_usd: 0, total_idr: 0, is_free: true },
                  duration_seconds: data.duration_seconds,
                  is_synthesis: true,
                  source_count: data.source_draft_count,
                  source_models: data.source_models || [],
                  source_summary_ids: data.source_summary_ids || [],
                  synthesis_method: data.synthesis_method,
                  sections_analyzed: data.sections_analyzed
                });

                // Store diversity analysis and synthesis metadata
                if (data.diversity_analysis) {
                  setDiversityAnalysis(data.diversity_analysis);
                }
                if (data.synthesis_metadata) {
                  setSynthesisMetadata(data.synthesis_metadata);
                }

                showToast("Sintesis berhasil!", "success");
              }
            } catch (e) {
              console.error("Syntax error in stream", e);
              throw e; // Re-throw to be caught by outer catch
            }
          }
        }
      }
      setIsSelectionMode(false);
      setSelectedVariantIds([]);
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast("Sintesis dibatalkan", "info");
      } else {
        console.error("Synthesis error:", err);
        setError(`Sintesis Gagal: ${err.message}`);
        showAlert("Sintesis Gagal", err.message);
      }
    } finally {
      setSummarizing(false);
      setStreamingStatus("");
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = () => {
    if (!currentVariant) {
      handleSummarize(false, true);
      return;
    }

    const originalProvider = currentVariant.usage_stats?.provider || currentVariant.provider || "OpenRouter";
    const originalModel = currentVariant.usage_stats?.model || currentVariant.model || "Unknown";
    const originalBaseUrl = currentVariant.usage_stats?.base_url;

    const currentActiveModel = provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel);

    // Check for mismatch
    const isModelMismatch = (originalProvider !== provider) || (originalModel !== currentActiveModel);

    const configToUse = {
      provider: originalProvider,
      model: originalModel,
      base_url: originalBaseUrl || ollamaBaseUrl
    };

    if (isModelMismatch) {
      showConfirm(
        "Konfirmasi Generate Ulang",
        `Brief ini dibuat dengan model "${originalModel.split('/').pop()}" (${originalProvider}). Pengaturan Anda saat ini adalah "${currentActiveModel.split('/').pop()}" (${provider}).\n\nIngin tetap menggunakan model asli untuk hasil yang konsisten?`,
        () => handleSummarize(false, true, configToUse),
        false
      );
    } else {
      handleSummarize(false, true);
    }
  };

  // Helper for History
  const addToHistory = (newItem) => {
    // Filter out existing duplicates (same title/author/isbn) to keep history unique
    const filteredHistory = history.filter(item => {
      const sameTitle = (item.title || '').trim().toLowerCase() === (newItem.title || '').trim().toLowerCase();
      const sameAuthor = (item.author || '').trim().toLowerCase() === (newItem.author || '').trim().toLowerCase();
      const sameIsbn = (item.isbn || '').trim().replace(/-/g, '') === (newItem.isbn || '').trim().replace(/-/g, '');

      // If it's effectively the same search, remove the old one (so new one goes to top)
      if (newItem.title && newItem.author) return !(sameTitle && sameAuthor);
      if (newItem.title) return !sameTitle;
      if (newItem.isbn) return !sameIsbn;

      // Fallback for strict equality if simple checks pass
      return JSON.stringify(item) !== JSON.stringify(newItem);
    });

    const newEntry = { ...newItem, timestamp: new Date().toISOString() };
    const newHistory = [newEntry, ...filteredHistory];

    // Limit history size to e.g. 50
    if (newHistory.length > 50) newHistory.length = 50;

    setHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  // Helper for Average Duration
  const getAverageDuration = (targetProvider) => {
    let totalSeconds = 0;
    let count = 0;

    savedSummaries.forEach(book => {
      book.summaries.forEach(s => {
        const p = s.usage_stats?.provider || s.provider;
        if (p === targetProvider && s.usage_stats?.duration_seconds) {
          totalSeconds += s.usage_stats.duration_seconds;
          count++;
        }
      });
    });

    if (count === 0) return null;
    return (totalSeconds / count).toFixed(1);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('searchHistory');
  };

  const deleteHistoryItem = (index) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const loadFromHistory = (item) => {
    setIsbn(item.isbn || '');
    setTitle(item.title || '');
    setAuthor(item.author || '');
    setShowHistory(false);
  };

  const handleReset = () => {
    setIsbn('');
    setTitle('');
    setAuthor('');
    setVerificationResult(null);
    setMetadataGenre("");
    setSummary(null);
    setUsageStats(null);
    setSavedId(null);
    setNotes([]); // Clear notes on reset
    setError(null);
    setCurrentBook(null);
    setCurrentVariant(null);
    setCopied(false);
    setShowSettings(false);
    setShowLibrary(false);
    setShowHistory(false);
    setHighQuality(false);
    setIsSelectionMode(false);
    setSelectedVariantIds([]);
  };

  const handleCopy = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast("Berhasil disalin ke clipboard!", "success");
  };

  const handleUpdateMetadata = async () => {
    if (!metadataEditBook) return;
    setIsSavingMetadata(true);

    try {
      const response = await axios.put(`${API_BASE_URL}/books/${metadataEditBook.id}/metadata`, {
        title: metadataTitle,
        author: metadataAuthor,
        isbn: metadataIsbn,
        genre: metadataGenre
      });

      // Update local state
      const updatedBook = response.data;
      setSavedSummaries(prev => prev.map(book => book.id === updatedBook.id ? updatedBook : book));

      // Update current book if it's the one we're looking at
      if (currentBook && currentBook.id === updatedBook.id) {
        setCurrentBook(updatedBook);
      }

      showToast("Info buku berhasil diperbarui");
      setIsMetadataModalOpen(false);
    } catch (err) {
      console.error("Failed to update metadata:", err);
      showAlert("Gagal", "Gagal memperbarui info buku.");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleShareToNotion = async () => {
    if (!summary) return;

    setIsNotionSharing(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/share/notion`, {
        title: currentBook?.title || title || verificationResult?.sources[0]?.title || "Unknown Title",
        author: currentBook?.author || author || verificationResult?.sources[0]?.author || "Unknown Author",
        summary_content: summary,
        metadata: {
          isbn: isbn,
          genre: currentBook?.genre || verificationResult?.sources.find(s => s.genre)?.genre || "",
          model: currentVariant?.model || (provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)),
          provider: currentVariant?.usage_stats?.provider || provider
        }
      });

      if (res.data.error) {
        showAlert("Gagal Berbagi", res.data.error);
      } else {
        showToast("Berhasil dibagikan ke Notion!", "success");
      }
    } catch (err) {
      console.error("Notion sharing failed", err);
      const msg = err.response?.data?.detail || "Gagal menghubungkan ke Notion API.";
      showAlert("Gagal Berbagi", msg);
    } finally {
      setIsNotionSharing(false);
    }
  };

  // Status Cycling Effect (Chain of Density)
  useEffect(() => {
    if (!summarizing || summary || (tokensReceived > 0)) return;

    const messages = highQuality ? [
      "Generating parallel knowledge drafts...",
      "Performing comparative analysis...",
      "The Judge is weighting analytical precision...",
      "Synthesizing gold-standard insights...",
      "Finalizing intelligence artifact..."
    ] : (isSelectionMode ? [
      "Reading selected variants...",
      "Comparing arguments across nodes...",
      "Synthesizing cross-variant insights...",
      "Merging best-of-breed intelligence...",
      "Finalizing consolidated brief..."
    ] : [
      "Establishing connection to knowledge synthesis grid...",
      "Extracting core entities & technical terms...",
      "Constructing reasoned blueprint...",
      "Applying Chain of Density compression...",
      "Finalizing knowledge artifact structure..."
    ]);

    let index = 0;

    // Timer to cycle messages
    const intervalId = setInterval(() => {
      index = (index + 1) % messages.length;
      setStreamingStatus(messages[index]);
    }, 3500);

    return () => clearInterval(intervalId);
  }, [summarizing, summary, tokensReceived]);

  return (
    <>
      <div className="container animate-fade-in">
        {/* Backend Status Banner */}
        {!backendUp && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AlertCircle size={20} style={{ marginRight: '10px' }} />
            <div>
              <strong>Backend Tidak Terdeteksi!</strong>
              <div style={{ fontSize: '0.9rem', marginTop: '4px', opacity: 0.8 }}>
                Silakan jalankan file <code>run_app.bat</code>.
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header style={{
          textAlign: 'center',
          marginBottom: '2rem',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          {/* Mobile-friendly Header Top Bar (Icons & Settings) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { handleReset(); setShowSettings(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                title="Initialize New Synthesis"
              >
                <Home size={22} />
              </button>
              <button
                onClick={() => {
                  setShowHistory(!showHistory);
                  setShowSettings(false);
                  setShowLibrary(false);
                }}
                style={{ background: 'none', border: 'none', color: showHistory ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                title="Research History"
              >
                <History size={22} />
              </button>
              <button
                onClick={() => {
                  setShowLibrary(!showLibrary);
                  setShowSettings(false);
                  setShowHistory(false);
                }}
                style={{ background: 'none', border: 'none', color: showLibrary ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                title="Archived Intel (Saved)"
              >
                <BookOpen size={22} />
              </button>
            </div>

            {/* API Status (Now triggers Settings) */}
            <div
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: 'pointer',
                padding: '0.4rem 0.6rem',
                borderRadius: '8px',
                border: showSettings ? '1px solid var(--text-primary)' : '1px solid var(--border-color)',
                background: showSettings ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s',
              }}
              className="hover-card"
              title="Klik untuk Pengaturan AI"
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: (provider === 'OpenRouter' ? openRouterKey : (provider === 'Groq' ? groqKey : ollamaBaseUrl)) ? (keyValid !== false ? 'var(--success)' : 'var(--error)') : 'var(--border-color)',
                boxShadow: (provider === 'OpenRouter' ? openRouterKey : (provider === 'Groq' ? groqKey : ollamaBaseUrl)) && keyValid !== false ? '0 0 8px var(--success)' : 'none'
              }}></div>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: showSettings ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 500,
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {keyValid !== false ? `${provider}: ${provider === 'OpenRouter' ? openRouterModel.split('/').pop().split(':')[0] : (provider === 'Groq' ? groqModel : ollamaModel)}` : "Config"}
              </span>
              {validatingKey && <RefreshCw size={10} className="spin-animation" style={{ color: 'var(--text-secondary)' }} />}
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <h1 style={{ margin: '0' }}>
              <span className="title-gradient">Pustaka+</span>
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '0.25rem', letterSpacing: '1px' }}>
              Advanced Synthetic Analytical Briefing
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '0.25rem', fontStyle: 'italic', maxWidth: '400px', margin: '0.5rem auto' }}>
              Deep-tier knowledge synthesis engine for high-stakes intelligence.
            </p>
          </div>
        </header>

        {/* Settings Modal/Panel */}
        {showSettings && (
          <div className="glass-card animate-fade-in" style={{
            marginBottom: '2rem',
            border: '1px solid var(--border-color)',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Settings size={20} color="var(--text-secondary)" />
                Konfigurasi OpenRouter
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="btn-secondary"
                style={{ padding: '0.25rem', minWidth: 'auto', border: 'none', background: 'none' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <button
                onClick={() => { setProvider('OpenRouter'); validateApiKey(openRouterKey, true, 'OpenRouter'); }}
                style={{
                  background: 'none', border: 'none', color: provider === 'OpenRouter' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  fontWeight: provider === 'OpenRouter' ? 'bold' : 'normal', cursor: 'pointer', paddingBottom: '0.5rem',
                  borderBottom: provider === 'OpenRouter' ? '2px solid var(--accent-color)' : 'none'
                }}
              >
                OpenRouter
              </button>
              <button
                onClick={() => { setProvider('Groq'); validateApiKey(groqKey, true, 'Groq'); }}
                style={{
                  background: 'none', border: 'none', color: provider === 'Groq' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  fontWeight: provider === 'Groq' ? 'bold' : 'normal', cursor: 'pointer', paddingBottom: '0.5rem',
                  borderBottom: provider === 'Groq' ? '2px solid var(--accent-color)' : 'none'
                }}
              >
                Groq
              </button>
              <button
                onClick={() => { setProvider('Ollama'); validateApiKey(null, true, 'Ollama', ollamaBaseUrl); }}
                style={{
                  background: 'none', border: 'none', color: provider === 'Ollama' ? 'var(--accent-color)' : 'var(--text-secondary)',
                  fontWeight: provider === 'Ollama' ? 'bold' : 'normal', cursor: 'pointer', paddingBottom: '0.5rem',
                  borderBottom: provider === 'Ollama' ? '2px solid var(--accent-color)' : 'none'
                }}
              >
                Ollama (Local)
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {provider === 'OpenRouter' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    OpenRouter API Key
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        className="input-field"
                        placeholder="sk-or-v1-..."
                        style={{
                          paddingRight: '3rem',
                          marginBottom: 0,
                          borderColor: keyValid === true ? 'var(--success)' : (keyValid === false ? 'var(--error)' : 'var(--border-color)')
                        }}
                      />
                      <div style={{
                        position: 'absolute', right: '0.5rem', top: '0', height: '100%',
                        display: 'flex', alignItems: 'center', pointerEvents: 'none'
                      }}>
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-secondary)',
                            cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', pointerEvents: 'auto'
                          }}
                        >
                          {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => validateApiKey(openRouterKey, true)}
                      disabled={validatingKey || !openRouterKey}
                      className="btn-secondary"
                      style={{ height: '42px', minWidth: '42px' }}
                    >
                      {validatingKey ? <span className="spinner"></span> : <RefreshCw size={14} />}
                    </button>
                  </div>
                </div>
              ) : provider === 'Groq' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Groq API Key
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        className="input-field"
                        placeholder="gsk_..."
                        style={{
                          paddingRight: '3rem',
                          marginBottom: 0,
                          borderColor: keyValid === true ? 'var(--success)' : (keyValid === false ? 'var(--error)' : 'var(--border-color)')
                        }}
                      />
                      <div style={{
                        position: 'absolute', right: '0.5rem', top: '0', height: '100%',
                        display: 'flex', alignItems: 'center', pointerEvents: 'none'
                      }}>
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-secondary)',
                            cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', pointerEvents: 'auto'
                          }}
                        >
                          {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => validateApiKey(groqKey, true, 'Groq')}
                      disabled={validatingKey || !groqKey}
                      className="btn-secondary"
                      style={{ height: '42px', minWidth: '42px' }}
                    >
                      {validatingKey ? <span className="spinner"></span> : <RefreshCw size={14} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Ollama Base URL
                  </label>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      value={ollamaBaseUrl}
                      onChange={(e) => setOllamaBaseUrl(e.target.value)}
                      className="input-field"
                      placeholder="http://localhost:11434"
                      style={{ marginBottom: 0, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => validateApiKey(null, true, 'Ollama', ollamaBaseUrl)}
                      disabled={validatingKey}
                      className="btn-secondary"
                      style={{ height: '42px', minWidth: '42px' }}
                    >
                      {validatingKey ? <span className="spinner"></span> : <RefreshCw size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Default AI Model ({provider})
                </label>
                <SearchableSelect
                  options={availableModels}
                  value={provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)}
                  onChange={(val) => {
                    if (provider === 'OpenRouter') {
                      setOpenRouterModel(val);
                      saveConfig({ openrouter_model: val });
                    } else if (provider === 'Groq') {
                      setGroqModel(val);
                      saveConfig({ groq_model: val });
                    } else {
                      setOllamaModel(val);
                      saveConfig({ ollama_model: val });
                    }
                  }}
                  placeholder="Pilih model..."
                />
              </div>

              <div style={{ marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Share2 size={18} color="var(--accent-color)" />
                  Konfigurasi Notion
                </h4>
                <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Notion API Key
                    </label>
                    <input
                      type="password"
                      value={notionApiKey}
                      onChange={(e) => {
                        setNotionApiKey(e.target.value);
                        saveConfig({ notion_api_key: e.target.value });
                      }}
                      className="input-field"
                      placeholder="secret_..."
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Database ID
                    </label>
                    <input
                      type="text"
                      value={notionDatabaseId}
                      onChange={(e) => {
                        setNotionDatabaseId(e.target.value);
                        saveConfig({ notion_database_id: e.target.value });
                      }}
                      className="input-field"
                      placeholder="32 chars ID"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', justifyContent: 'flex-end'
            }}>
              {keyError && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginRight: 'auto' }}>{keyError}</p>}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                Pengaturan disimpan secara otomatis.
              </p>
            </div>
          </div>
        )}

        {/* Library Card */}
        {showLibrary && (
          <div className="glass-card animate-fade-in" style={{
            marginBottom: '2rem',
            border: '1px solid var(--border-color)',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '1.25rem' }}>
                <BookOpen size={20} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
                Archived Intel
              </h3>
              <button
                onClick={() => setShowLibrary(false)}
                className="btn-secondary"
                style={{ padding: '0.25rem', minWidth: 'auto', border: 'none', background: 'none' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              id="library-content"
              ref={libraryContentRef}
              className="custom-scrollbar"
              style={{ maxHeight: 'none', padding: '1.5rem' }}
            >
              {savedSummaries.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  Belum ada brief tersimpan.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
                  {savedSummaries.map((book) => (
                    <div key={book.id} className="glass-card" style={{ padding: '0', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={() => loadFromLibrary(book)}>
                      <div style={{
                        width: '100%', height: '260px', backgroundColor: 'var(--bg-secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0, position: 'relative'
                      }}>
                        {book.image_url ? (
                          <img
                            src={getImageUrl(book.image_url, book.last_updated)}
                            alt={book.title}
                            className="sharp-image"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        ) : (
                          <Book size={48} color="var(--text-secondary)" opacity={0.3} />
                        )}

                        <div className="card-overlay" style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
                          opacity: 1, transition: 'opacity 0.2s',
                        }}>
                          <div
                            className="cover-edit-btn"
                            title="Ganti Cover"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverEditBook(book);
                              setIsCoverModalOpen(true);
                            }}
                            style={{
                              position: 'absolute', top: '8px', right: '8px',
                              background: 'rgba(0,0,0,0.6)', borderRadius: '50%',
                              width: '32px', height: '32px', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', color: 'white',
                              zIndex: 10, backdropFilter: 'blur(4px)'
                            }}
                          >
                            <Settings size={16} />
                          </div>

                          <div
                            className="metadata-edit-btn"
                            title="Edit Info Buku"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMetadataEditBook(book);
                              setMetadataTitle(book.title);
                              setMetadataAuthor(book.author);
                              setMetadataIsbn(book.isbn || "");
                              setMetadataGenre(book.genre || "");
                              setIsMetadataModalOpen(true);
                            }}
                            style={{
                              position: 'absolute', top: '8px', left: '8px',
                              background: 'rgba(0,0,0,0.6)', borderRadius: '50%',
                              width: '32px', height: '32px', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', color: 'white',
                              zIndex: 10, backdropFilter: 'blur(4px)'
                            }}
                          >
                            <PenTool size={16} />
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h4 style={{
                          margin: '0 0 0.35rem 0', color: 'var(--text-primary)',
                          fontSize: '0.95rem', fontWeight: '600',
                          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.5rem'
                        }} title={book.title}>
                          {book.title}
                        </h4>
                        <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.author}</p>

                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>
                            {book.summaries.length} Artifacts
                          </span>
                          <button
                            onClick={(e) => handleDeleteBook(book.id, e)}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.75rem', opacity: 0.7 }}
                          >
                            <Trash2 size={12} style={{ marginRight: '4px' }} /> Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


        {/* History Card */}
        {showHistory && (
          <div className="glass-card animate-fade-in" style={{
            marginBottom: '2rem',
            border: '1px solid var(--border-color)',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '1.25rem' }}>
                <History size={20} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
                Research History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="btn-secondary"
                style={{ padding: '0.25rem', minWidth: 'auto', border: 'none', background: 'none' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="custom-scrollbar" style={{ maxHeight: 'none', padding: '1.5rem' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  Belum ada riwayat pencarian.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {history.map((item, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      padding: '1rem',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start'
                    }}>
                      <div onClick={() => loadFromHistory(item)} style={{ cursor: 'pointer', flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                          {item.title || item.isbn}
                        </div>
                        {item.author && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.author}</div>}
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteHistoryItem(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', opacity: 0.6, cursor: 'pointer', padding: '0.25rem' }}
                        title="Hapus item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
                <button
                  onClick={clearHistory}
                  className="btn-danger"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem'
                  }}
                >
                  Clear Research Log
                </button>
              </div>
            )}
          </div>
        )}

        {/* Phase A: Input Form - Only show if no verification result, no current book, settings hidden, library hidden, and history hidden */}
        {!verificationResult && !currentBook && !showSettings && !showLibrary && !showHistory && (
          <div className="glass-card animate-slide-up" style={{ marginBottom: '2rem' }}>
            <form onSubmit={handleVerify}>
              <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: showIsbn ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
                {showIsbn && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ISBN</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Contoh: 978-0132350884"
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Source Title</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Contoh: Clean Code"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Primary Author / Entity</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Contoh: Robert C. Martin"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowIsbn(!showIsbn)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-color)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {showIsbn ? "Sembunyikan ISBN" : "Tampilkan Opsi ISBN"}
                </button>
              </div>
              <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}>
                <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {loading ? <><span className="spinner"></span> Validating Source...</> : <><Search size={18} style={{ marginRight: '8px' }} /> Analyze Book Source</>}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem' }}
                  title="Reset Sesi"
                >
                  <RotateCcw size={18} />
                  <span style={{ marginLeft: '8px' }}>Reset Environment</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Phase B: Verification Result - Only show if verification exists, not yet summarizing/summary, and settings hidden */}
        {verificationResult && !summarizing && !summary && !showSettings && (
          <div className="glass-card animate-slide-up" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {verificationResult.status === 'success' ? (
                  <CheckCircle size={32} color="var(--success)" style={{ marginRight: '1rem' }} />
                ) : verificationResult.status === 'warning' ? (
                  <AlertCircle size={32} color="var(--warning)" style={{ marginRight: '1rem' }} />
                ) : (
                  <AlertCircle size={32} color="var(--error)" style={{ marginRight: '1rem' }} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                    {verificationResult.status === 'success' ? "Source Verified" :
                      verificationResult.status === 'warning' ? "Partial Match" : "Source Refined Fail"}
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{verificationResult.message}</p>
                </div>
              </div>
              <button
                onClick={() => setVerificationResult(null)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} /> Cari Ulang
              </button>
            </div>

            {verificationResult.sources.length > 0 && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Sumber Ditemukan</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {verificationResult.sources.map((src, idx) => (
                    <li key={idx} style={{ padding: '0.5rem 0', borderBottom: idx < verificationResult.sources.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{src.source}</span>: {src.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Synopsis Display */}
            {verificationResult.sources.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Source Intel (Abstract)</h4>
                <p
                  className="custom-scrollbar"
                  style={{
                    fontSize: '0.9rem', lineHeight: '1.5', color: '#e2e8f0',
                    background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '6px',
                    maxHeight: '150px', overflowY: 'auto', fontStyle: verificationResult.sources.some(s => s.description) ? 'normal' : 'italic',
                    opacity: verificationResult.sources.some(s => s.description) ? 1 : 0.7
                  }}
                >
                  {verificationResult.sources.find(s => s.description)?.description || "No abstract available from intelligence source."}
                </p>
              </div>
            )}

            {verificationResult.is_valid && (
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem' }}>
                {verificationResult.sources.find(s => s.image_url) && (
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={verificationResult.sources.find(s => s.image_url).image_url}
                      alt="Cover"
                      className="sharp-image"
                      style={{ width: '100px', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, textAlign: 'center', alignSelf: 'center' }}>
                  {!summary && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'rgba(255,255,255,0.03)',
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer'
                      }} onClick={() => setHighQuality(!highQuality)}>
                        <div className={`toggle-switch ${highQuality ? 'active' : ''}`} style={{
                          width: '36px', height: '18px', background: highQuality ? 'var(--accent-color)' : '#333',
                          borderRadius: '10px', position: 'relative', transition: 'all 0.3s'
                        }}>
                          <div style={{
                            width: '14px', height: '14px', background: 'white', borderRadius: '50%',
                            position: 'absolute', top: '2px', left: highQuality ? '20px' : '2px', transition: 'all 0.3s'
                          }}></div>
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: '500', color: highQuality ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                          Analytical Refining Mode
                        </span>
                        <Sparkles size={14} color={highQuality ? 'var(--accent-color)' : 'var(--text-secondary)'} opacity={highQuality ? 1 : 0.5} />
                      </div>

                      {highQuality && !summary && (
                        <div className="animate-fade-in" style={{
                          width: '100%',
                          maxWidth: '240px',
                          background: 'rgba(255,255,255,0.02)',
                          padding: '0.75rem',
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>DRAFT DEPTH: {draftCount}</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={draftCount}
                            onChange={(e) => setDraftCount(parseInt(e.target.value))}
                            style={{
                              width: '100%',
                              accentColor: 'var(--accent-color)',
                              cursor: 'pointer',
                              height: '4px'
                            }}
                          />
                        </div>
                      )}

                      <button
                        onClick={() => handleSummarize(false)}
                        className="btn-primary"
                        disabled={summarizing}
                        style={{
                          backgroundColor: existingSummary ? 'var(--success)' : '',
                          borderColor: existingSummary ? 'var(--success)' : '',
                          padding: '1rem 2rem',
                          fontSize: '1.1rem'
                        }}
                      >
                        {existingSummary ? (
                          <><BookOpen size={20} style={{ marginRight: '10px' }} /> Load Existing Artifact</>
                        ) : (
                          summarizing ? <><span className="spinner"></span> Synthesizing...</> : <><Sparkles size={20} style={{ marginRight: '10px' }} /> Synthesize Intelligence Brief</>
                        )}
                      </button>

                      {highQuality && !existingSummary && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                          * Mode ini menggunakan biaya token ~{draftCount}x lebih banyak.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="glass-card animate-fade-in" style={{ padding: '1rem', border: '1px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--error)' }}>
              <AlertCircle size={20} style={{ marginRight: '0.75rem', flexShrink: 0 }} />
              <span style={{ fontSize: '0.9rem' }}>{error}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {summary && (
                <button
                  onClick={() => handleSummarize(true)}
                  className="btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} /> Lanjutkan
                </button>
              )}
              <button
                onClick={() => handleSummarize(false)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} /> {summary ? "Mulai Ulang" : "Coba Lagi"}
              </button>
            </div>
          </div>
        )}

        {/* Summary Result Area */}
        {summarizing && !summary && !showSettings && <SkeletonSummary status={streamingStatus} progress={progress} onStop={() => abortControllerRef.current?.abort()} />}

        {/* Summary Result */}
        {summary && !showSettings && (
          <div className="glass-card animate-slide-up summary-card" style={{ position: 'relative' }}>
            {/* Real-time Progress Bar */}
            {summarizing && progress > 0 && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '4px',
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                zIndex: 100,
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--accent-color), #60a5fa)',
                  boxShadow: '0 0 10px var(--accent-color)',
                  transition: 'width 0.4s ease-out'
                }}></div>
              </div>
            )}

            {/* Version Switcher if multiple versions available */}
            {currentBook && currentBook.summaries && currentBook.summaries.length > 1 && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
                    Intelligence Artifact Variants (Model Selective)
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => {
                        setIsSelectionMode(!isSelectionMode);
                        setSelectedVariantIds([]);
                      }}
                      className="btn-secondary"
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', minWidth: 'auto', border: isSelectionMode ? '1px solid var(--accent-color)' : '' }}
                    >
                      {isSelectionMode ? "Batal Seleksi" : "Sintesis Varian"}
                    </button>
                    {isSelectionMode && selectedVariantIds.length >= 2 && (
                      <button
                        onClick={handleSynthesize}
                        className="btn-primary"
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', minWidth: 'auto' }}
                      >
                        <Sparkles size={12} style={{ marginRight: '4px' }} /> Gabungkan ({selectedVariantIds.length})
                      </button>
                    )}
                  </div>
                </div>

                {Object.entries(
                  currentBook.summaries.reduce((acc, variant) => {
                    const p = variant.usage_stats?.provider || 'Other';
                    if (!acc[p]) acc[p] = [];
                    acc[p].push(variant);
                    return acc;
                  }, {})
                ).map(([providerName, variants]) => (
                  <div key={providerName} style={{ marginBottom: providerName === Object.keys(currentBook.summaries.reduce((acc, v) => { const p = v.usage_stats?.provider || 'Other'; if (!acc[p]) acc[p] = []; acc[p].push(v); return acc; }, {})).pop() ? 0 : '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-color)', marginBottom: '0.4rem', fontWeight: '600', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {providerName.toUpperCase()}
                      {getAverageDuration(providerName) && !isSelectionMode && (
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '0.65rem' }}>
                          (Rata-rata: {getAverageDuration(providerName)}s)
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {variants.map((variant) => {
                        const isSelected = selectedVariantIds.includes(variant.id);
                        return (
                          <button
                            key={variant.id}
                            onClick={() => {
                              if (isSelectionMode) {
                                setSelectedVariantIds(prev =>
                                  isSelected ? prev.filter(id => id !== variant.id) : [...prev, variant.id]
                                );
                              } else {
                                loadVariant(variant);
                              }
                            }}
                            className={currentVariant && currentVariant.id === variant.id && !isSelectionMode ? "btn-primary" : "btn-secondary"}
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.25rem 0.75rem',
                              opacity: (currentVariant && currentVariant.id === variant.id && !isSelectionMode) || isSelected ? 1 : 0.7,
                              minWidth: 'auto',
                              borderColor: (currentVariant && currentVariant.id === variant.id && !isSelectionMode) || isSelected ? 'var(--accent-color)' : '',
                              position: 'relative',
                              paddingLeft: isSelectionMode ? '2rem' : '0.75rem'
                            }}
                          >
                            {isSelectionMode && (
                              <div style={{
                                position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                                width: '14px', height: '14px', borderRadius: '3px', border: '1px solid var(--border-color)',
                                backgroundColor: isSelected ? 'var(--accent-color)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}>
                                {isSelected && <Check size={10} color="white" />}
                              </div>
                            )}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {variant.model ? variant.model.split('/').pop() : 'Unknown'}
                              {Object.keys(variant.usage_stats || {}).length > 0 && (
                                <div style={{ display: 'flex', gap: '2px' }}>
                                  {variant.usage_stats?.is_synthesis && <Sparkles size={10} color="#9333ea" title="Hasil Sintesis" />}
                                  {variant.usage_stats?.is_enhanced && <Sparkles size={10} color="#d4af37" title="Kualitas Tinggi" />}
                                </div>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              ref={headerRef}
              className={`sticky-summary-header ${isStuck ? 'is-stuck' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                  {/* Book Cover in Header - Container controlled by CSS transitions */}
                  <div className="book-cover-container" style={{ marginLeft: isStuck ? 0 : '10px' }}>
                    {currentBook && currentBook.image_url ? (
                      <img
                        src={getImageUrl(currentBook.image_url, currentBook.last_updated)}
                        alt="Cover"
                        className="sharp-image"
                        style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    ) : (
                      verificationResult?.sources?.find(s => s.image_url) && (
                        <img
                          src={getImageUrl(verificationResult.sources.find(s => s.image_url).image_url, verificationResult.timestamp)}
                          alt="Cover"
                          className="sharp-image"
                          style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      )
                    )}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: isStuck ? 'row' : 'column', alignItems: isStuck ? 'baseline' : 'stretch', gap: isStuck ? '0.75rem' : '0' }}>
                    <h2 className="header-title" style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Book size={isStuck ? 14 : 20} color="var(--accent-color)" />
                      {currentBook ? currentBook.title : (verificationResult?.sources?.[0]?.title || verificationResult?.title)}
                    </h2>
                    <div className="header-author" style={{ color: 'var(--text-secondary)', fontSize: isStuck ? '0.7rem' : '0.8rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {currentBook ? currentBook.author : (verificationResult?.sources[0]?.author || author)}
                      </span>
                      {((currentBook && currentBook.genre) || (verificationResult?.sources?.find(s => s.genre)?.genre)) && !isStuck && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.15rem 0.6rem',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          <Tag size={10} />
                          {currentBook ? currentBook.genre : verificationResult.sources.find(s => s.genre).genre}
                        </div>
                      )}
                      {summarizing && (
                        <div className="token-badge-realtime animate-fade-in" style={{
                          padding: isStuck ? '0.1rem 0.5rem' : '0.25rem 0.75rem',
                          fontSize: isStuck ? '0.65rem' : '0.75rem'
                        }}>
                          <div className="pulse-dot" style={{ width: isStuck ? '4px' : '6px', height: isStuck ? '4px' : '6px' }}></div>
                          <span>{tokensReceived} tokens</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  {summarizing && summary && (
                    <button
                      onClick={() => abortControllerRef.current?.abort()}
                      className="btn-danger"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.75rem',
                      }}
                    >
                      <X size={isStuck ? 13 : 14} style={{ marginRight: isStuck ? '0' : '4px' }} /> {!isStuck && "Stop"}
                    </button>
                  )}
                  {!summarizing && summary && (
                    <>
                      <button
                        onClick={handleRegenerate}
                        className="btn-secondary"
                        title="Generate Ulang"
                        style={{
                          padding: '0.35rem 0.6rem',
                        }}
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={handleCopy}
                        className="btn-secondary"
                        title={copied ? "Tersalin!" : "Salin Rangkuman"}
                        style={{
                          padding: '0.35rem 0.6rem',
                          borderColor: copied ? 'var(--success)' : ''
                        }}
                      >
                        {copied ? (
                          <Check size={14} color="var(--success)" />
                        ) : (
                          <Copy size={14} title="Salin Brief" />
                        )}
                      </button>

                      <button
                        onClick={handleShareToNotion}
                        disabled={isNotionSharing}
                        className="btn-secondary"
                        title="Kirim ke Notion"
                        style={{
                          padding: '0.35rem 0.7rem',
                          marginLeft: '5px',
                          marginTop: '2px',
                          marginBottom: '2px',
                          marginRight: '2px',
                          color: 'var(--accent-color)'
                        }}
                      >
                        {isNotionSharing ? (
                          <RefreshCw size={14} className="spin" />
                        ) : (
                          <Share2 size={14} />
                        )}
                      </button>

                      <button
                        onClick={savedId ? handleDeleteCurrent : handleSaveSummary}
                        className={savedId ? "btn-danger" : "btn-primary"}
                        title={savedId ? "Archive Intel Purge" : "Commit to Archive"}
                        style={{
                          fontSize: '0.8rem',
                          padding: savedId ? '0.35rem 0.7rem' : '0.35rem 1rem',
                          marginLeft: '0',
                          marginTop: '2px',
                          marginBottom: '2px',
                          marginRight: '20px',
                          backgroundColor: savedId ? 'var(--error)' : '',
                          borderColor: savedId ? 'var(--error)' : '',
                          color: savedId ? 'white' : ''
                        }}
                      >
                        {savedId ? (
                          <Trash2 size={14} />
                        ) : (
                          <><Save size={isStuck ? 13 : 14} style={{ marginRight: isStuck ? '0' : '6px' }} /> {!isStuck && "Archive"}</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }) {
                    const content = String(children);
                    if (content.startsWith('intel-synth:')) {
                      return (
                        <span className="synthesis-mark">
                          <Sparkles size={10} style={{ color: 'var(--accent-color)' }} />
                          {content.replace('intel-synth:', '')}
                        </span>
                      );
                    }
                    if (content.startsWith('claim-tag:')) {
                      const tag = content.replace('claim-tag:', '');
                      let color = 'var(--accent-color)';

                      return (
                        <span
                          className="claim-dot"
                          style={{ backgroundColor: color, color: color }}
                          title={tag}
                        />
                      );
                    }
                    return <code className={className} {...props}>{children}</code>;
                  }
                }}
              >
                {summary ? summary
                  .replace(/\[\[(.*?)\]\]/g, '`intel-synth:$1`')
                  .replace(/\[Analisis Terintegrasi\]/g, '`claim-tag:Analisis Terintegrasi`')
                  : ""}
              </ReactMarkdown>
              {summarizing && summary && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1.5rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{streamingStatus}</span>
                    {progress > 0 && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                        PHASE PROGRESS: {progress}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(usageStats || summarizing) && (
              <div style={{
                marginTop: '2rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    Provider: {usageStats?.provider || provider}
                  </span>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    Model: {(usageStats?.model || (provider === 'OpenRouter' ? openRouterModel : ollamaModel)).split('/').pop()}
                  </span>
                  {usageStats?.cost_estimate && (
                    <span className="badge" style={{
                      background: usageStats.cost_estimate.is_free ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: usageStats.cost_estimate.is_free ? 'var(--success)' : 'inherit',
                      border: usageStats.cost_estimate.is_free ? '1px solid rgba(34, 197, 94, 0.2)' : 'none'
                    }}>
                      Biaya: {usageStats.cost_estimate.is_free ? "GRATIS" :
                        usageStats.cost_estimate.total_idr
                          ? `Rp ${usageStats.cost_estimate.total_idr.toLocaleString('id-ID')}($${usageStats.cost_estimate.total_usd})`
                          : (usageStats.cost_estimate.total_usd !== null ? `$${usageStats.cost_estimate.total_usd}` : "Estimasi N/A")
                      }
                    </span>
                  )}
                  {usageStats?.duration_seconds && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      Waktu: {usageStats.duration_seconds}s
                    </span>
                  )}
                  {usageStats?.tokens && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--accent-color)', borderColor: 'var(--accent-color)' }}>
                      Token: {usageStats.tokens.total_tokens}
                    </span>
                  )}
                  {usageStats?.is_enhanced && (
                    <span className="badge" style={{ background: 'rgba(212, 175, 55, 0.1)', color: '#d4af37', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                      <Sparkles size={12} style={{ marginRight: '4px' }} /> High Quality ({usageStats.draft_count} draf)
                    </span>
                  )}
                  {usageStats?.is_synthesis && (
                    <span className="badge"
                      style={{ background: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', border: '1px solid rgba(147, 51, 234, 0.3)' }}
                      title={usageStats.source_models?.length > 0 ? `Gabungan dari: ${usageStats.source_models.map(m => m.split('/').pop()).join(', ')}` : "Hasil Sintesis"}
                    >
                      <Sparkles size={12} style={{ marginRight: '4px' }} />
                      Hasil Sintesis ({usageStats.source_count} Varian: {usageStats.source_models?.map(m => m.split('/').pop()).join(', ')})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Diversity Analysis Visualization */}
            {diversityAnalysis && usageStats?.is_synthesis && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                  📊 Draft Diversity Analysis
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      Diversity Score
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        flex: 1,
                        height: '8px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${diversityAnalysis.diversity_score * 100}%`,
                          height: '100%',
                          background: diversityAnalysis.diversity_score < 0.15 ? 'var(--error)' :
                            diversityAnalysis.diversity_score < 0.40 ? 'var(--warning)' : 'var(--success)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', minWidth: '45px' }}>
                        {(diversityAnalysis.diversity_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                      {diversityAnalysis.interpretation === 'very_similar' && '⚠️ Varian sangat mirip'}
                      {diversityAnalysis.interpretation === 'moderate_diversity' && '✓ Keragaman moderat'}
                      {diversityAnalysis.interpretation === 'high_diversity' && '✨ Keragaman tinggi (ideal)'}
                    </div>
                  </div>
                  {diversityAnalysis.most_different_sections && diversityAnalysis.most_different_sections.length > 0 && (
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        Bagian Paling Berbeda
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {diversityAnalysis.most_different_sections.slice(0, 3).map((section, idx) => (
                          <span key={idx} className="badge" style={{
                            background: 'rgba(147, 51, 234, 0.1)',
                            color: '#9333ea',
                            border: '1px solid rgba(147, 51, 234, 0.2)',
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.5rem'
                          }}>
                            {section}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Synthesis Metadata Display */}
            {synthesisMetadata && usageStats?.is_synthesis && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                  🔬 Synthesis Transparency Report
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div className="badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    ✨ {synthesisMetadata.unique_insights_count} Merged Insights
                  </div>
                  <div className="badge" style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                    ⚖️ {synthesisMetadata.conflict_resolutions} Conflicts Resolved
                  </div>
                  {usageStats.sections_analyzed && (
                    <div className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      📑 {usageStats.sections_analyzed} Sections Analyzed
                    </div>
                  )}
                  {usageStats.synthesis_method && (
                    <div className="badge" style={{ background: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', border: '1px solid rgba(147, 51, 234, 0.2)' }}>
                      🔧 {usageStats.synthesis_method === 'section_by_section' ? 'Section-by-Section' : 'Whole Document'}
                    </div>
                  )}
                </div>

                {synthesisMetadata.section_sources && Object.keys(synthesisMetadata.section_sources).length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Section Sources:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }} className="custom-scrollbar">
                      {Object.entries(synthesisMetadata.section_sources).map(([section, source]) => (
                        <div key={section} style={{
                          padding: '0.4rem 0.6rem',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {section.split('(')[0].trim()}
                          </span>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            whiteSpace: 'nowrap',
                            background: source === 'merged' ? 'rgba(34, 197, 94, 0.2)' :
                              source === 'single_source' ? 'rgba(59, 130, 246, 0.2)' :
                                source === 'synthesis_failed_using_fallback' ? 'rgba(251, 191, 36, 0.2)' :
                                  source.includes('dominant') ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: source === 'merged' ? 'var(--success)' :
                              source === 'single_source' ? '#3b82f6' :
                                source === 'synthesis_failed_using_fallback' ? '#fbbf24' :
                                  source.includes('dominant') ? '#fbbf24' : 'var(--error)'
                          }}>
                            {source === 'merged' ? '🔀 Merged' :
                              source === 'single_source' ? '📄 Single Source' :
                                source === 'synthesis_failed_using_fallback' ? '⚠️ Fallback' :
                                  source.includes('dominant') ? `📌 Draft ${source.match(/\d+/)?.[0]}` : '❌ Failed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* New Appendix Section for Notes */}
            {notes && notes.length > 0 && (
              <div className="notes-appendix" style={{
                marginTop: '3rem',
                paddingTop: '2rem',
                borderTop: '1px solid var(--border-color)',
                width: '100%',
                overflow: 'hidden'
              }}>
                <h3 style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '2rem',
                  color: 'var(--accent-color)',
                  fontSize: '1.2rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  <PenTool size={20} />
                  Lampiran: Diskusi & Elaborasi
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                  {notes.map((note, idx) => (
                    <div key={note.id || idx} className="glass-card note-card" style={{
                      padding: '1.5rem',
                      background: 'rgba(255,255,255,0.02)',
                      borderLeft: '3px solid var(--accent-color)',
                      borderRadius: '0 8px 8px 0',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      wordBreak: 'break-word'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        paddingBottom: '0.5rem'
                      }}>
                        <span style={{
                          fontStyle: 'italic',
                          flex: 1,
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere'
                        }}>
                          Ref: "{note.ref_text}"
                        </span>
                        <span style={{ opacity: 0.6, flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {new Date(note.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="markdown-content notes-markdown" style={{
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        maxWidth: '100%',
                        overflowX: 'auto',
                        paddingBottom: '4px'
                      }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {note.content_markdown}
                        </ReactMarkdown>
                      </div>

                      <div style={{
                        marginTop: '1rem',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        borderTop: '1px solid rgba(255,255,255,0.03)',
                        paddingTop: '0.75rem'
                      }}>
                        <button
                          onClick={() => handleEditNote(note)}
                          className="btn-secondary"
                          style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            minWidth: 'auto',
                            opacity: 0.8
                          }}
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="btn-danger"
                          style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            minWidth: 'auto',
                            opacity: 0.8,
                            color: 'white',
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.1)'
                          }}
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Modals */}
      <SimpleModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        onClose={closeAlert}
        onConfirm={closeAlert}
        showCancel={false}
      />

      <SimpleModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        confirmText="Hapus"
        isDanger={confirmModal.isDanger}
      />

      <SimpleModal
        isOpen={deleteConfirmOpen}
        title="Purge Intel From Archive?"
        message={`Are you sure you want to permanently delete "${bookToDelete?.title}" and all its intelligence artifacts?`}
        confirmText="Confirm Purge"
        isDanger={true}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteBook}
      />

      <CoverSelectionModal
        isOpen={isCoverModalOpen}
        book={coverEditBook}
        onClose={() => setIsCoverModalOpen(false)}
        onSave={handleUpdateCover}
      />

      <MetadataEditModal
        isOpen={isMetadataModalOpen}
        book={metadataEditBook}
        title={metadataTitle}
        author={metadataAuthor}
        isbn={metadataIsbn}
        genre={metadataGenre}
        setTitle={setMetadataTitle}
        setAuthor={setMetadataAuthor}
        setIsbn={setMetadataIsbn}
        setGenre={setMetadataGenre}
        onSave={handleUpdateMetadata}
        onClose={() => setIsMetadataModalOpen(false)}
        isSaving={isSavingMetadata}
      />


      {/* Floating Elaboration Trigger */}
      {
        selectionContext && !showElaborationPanel && (
          <div style={{
            position: 'fixed',
            top: `${selectionContext.rect.top - 50}px`,
            left: `${selectionContext.rect.left}px`,
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <button
              className="btn-primary"
              onClick={() => setShowElaborationPanel(true)}
              style={{
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                padding: '0.4rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.9rem'
              }}
            >
              <Sparkles size={16} /> Tanya AI
            </button>
          </div >
        )
      }

      {/* Elaboration Panel */}
      {
        showElaborationPanel && selectionContext && (
          <div className="glass-card animate-scale-up" style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '450px',
            height: '600px',
            maxHeight: '80vh',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
            border: '1px solid var(--accent-color)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <Sparkles size={16} color="var(--accent-color)" /> Tanya {(provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)).split('/').pop()}
              </h4>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {elaborationChat.length > 0 && (
                  <button
                    onClick={handleInitiateSave}
                    className="btn-primary"
                    title="Simpan Percakapan ke Catatan"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    <Save size={14} /> Simpan
                  </button>
                )}
                <button onClick={() => setShowElaborationPanel(false)} className="icon-btn"><X size={18} /></button>
              </div>
            </div>

            {/* Context Quote */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontStyle: 'italic',
              marginBottom: '0.5rem',
              borderLeft: '3px solid var(--accent-color)',
              maxHeight: '80px',
              overflowY: 'auto',
              flexShrink: 0
            }} className="custom-scrollbar">
              "{selectionContext.text}"
            </div>

            {/* Chat History */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }} className="custom-scrollbar">
              {elaborationChat.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  Tanyakan sesuatu tentang teks yang Anda pilih atau klik tombol kirim untuk penjelasan umum.
                </div>
              ) : (
                elaborationChat.map((msg, idx) => (
                  <div key={idx} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.role === 'user' ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(255,255,255,0.03)',
                    border: msg.role === 'user' ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    maxWidth: '85%',
                    fontSize: '0.9rem',
                    lineHeight: '1.5'
                  }}>
                    {msg.role === 'ai' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    ) : msg.content}
                  </div>
                ))
              )}
              {isElaborating && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <span className="spinner" style={{ width: '12px', height: '12px', display: 'inline-block' }}></span> Mengetik...
                </div>
              )}
            </div>

            {/* Input Area */}
            <div style={{ flexShrink: 0, marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Tulis pertanyaan lanjutan..."
                value={elaborationQuery}
                onChange={(e) => setElaborationQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleElaborate();
                  }
                }}
                style={{ marginBottom: 0, resize: 'none', fontSize: '0.9rem' }}
              />
              <button
                onClick={handleElaborate}
                className="btn-primary"
                disabled={isElaborating}
                style={{ minWidth: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isElaborating ? <span className="spinner"></span> : <Sparkles size={20} />}
              </button>
            </div>
          </div>
        )
      }

      {/* Note Review Modal */}
      {
        isNoteReviewOpen && (
          <div className="modal-overlay animate-fade-in">
            <div className="glass-card animate-scale-up" style={{ padding: '2rem', maxWidth: '700px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Edit3 size={20} color="var(--accent-color)" /> {editingNoteId ? "Edit Catatan" : "Review Catatan (Markdown)"}
                </h3>
                <div className="editor-toolbar" style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => handleFormat('bold')} className="icon-btn" title="Bold"><Bold size={16} /></button>
                  <button onClick={() => handleFormat('italic')} className="icon-btn" title="Italic"><Italic size={16} /></button>
                  <button onClick={() => handleFormat('h2')} className="icon-btn" title="Heading"><Heading size={16} /></button>
                  <button onClick={() => handleFormat('quote')} className="icon-btn" title="Quote"><Quote size={16} /></button>
                  <button onClick={() => handleFormat('list')} className="icon-btn" title="List"><List size={16} /></button>
                  <button onClick={() => handleFormat('code')} className="icon-btn" title="Code"><Code size={16} /></button>
                  <button onClick={() => handleFormat('hr')} className="icon-btn" title="Separator"><Minus size={16} /></button>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Gunakan format Markdown untuk mengatur struktur catatan Anda.
              </p>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '350px' }}>
                <textarea
                  ref={noteReviewTextareaRef}
                  className="input-field custom-scrollbar"
                  value={noteReviewContent}
                  onChange={(e) => setNoteReviewContent(e.target.value)}
                  style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    padding: '1rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid var(--border-color)',
                    resize: 'none'
                  }}
                  placeholder="Tulis catatan Anda di sini..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setIsNoteReviewOpen(false)}
                  className="btn-secondary"
                >
                  Batal
                </button>
                <button
                  onClick={handleFinalizeSave}
                  className="btn-primary"
                >
                  <Check size={16} style={{ marginRight: '6px' }} /> Simpan ke Lampiran
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )
      }
    </>
  );
}

export default App;

