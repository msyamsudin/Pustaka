import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, CheckCircle, Search, AlertCircle, Sparkles, Settings, Save, RefreshCw, History, X, Trash2, BookOpen, RotateCcw, PenTool, Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = "http://127.0.0.1:8000/api";

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:')) return url;

  // Handle relative paths (with or without leading slash)
  const baseUrl = API_BASE_URL.replace('/api', '');
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanUrl}`;
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
        <div className="searchable-select-menu animate-fade-in">
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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

function App() {
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [usageStats, setUsageStats] = useState(null);

  const [error, setError] = useState(null);

  // Settings
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.0-flash-exp:free');
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

  // Cover Edit State
  const [coverEditBook, setCoverEditBook] = useState(null);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

  const libraryContentRef = React.useRef(null);

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
      await axios.put(`${API_BASE_URL}/books/${coverEditBook.id}/cover`, { image_url: newUrl });
      loadSavedSummaries(); // Refresh list to show new cover
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
          const loadedKey = configRes.data.openrouter_key;
          if (loadedKey) {
            setOpenRouterKey(loadedKey);
            validateApiKey(loadedKey, false);
          }
          if (configRes.data.openrouter_model) setOpenRouterModel(configRes.data.openrouter_model);
          setConfigLoaded(true);
        }
      } catch (err) {
        setBackendUp(false);
      }
    };
    checkBackendAndLoadConfig();
  }, []);

  // Metadata Edit Modal State
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [metadataEditBook, setMetadataEditBook] = useState(null);
  const [metadataTitle, setMetadataTitle] = useState("");
  const [metadataAuthor, setMetadataAuthor] = useState("");
  const [metadataIsbn, setMetadataIsbn] = useState("");
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
        title: title || verificationResult.sources[0]?.title || "Unknown Title",
        author: author || "Unknown Author",
        summary_content: summary,
        usage_stats: usageStats || {},
        metadata: {
          isbn: isbn,
          sources: verificationResult.sources,
          image_url: imageUrl
        }
      });

      const newVariant = response.data;
      setSavedId(newVariant.id);
      setCurrentVariant(newVariant);
      showToast("Rangkuman berhasil disimpan");
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
      "Hapus Rangkuman",
      `Apakah Anda yakin ingin menghapus rangkuman buku "${bookTitle}" versi model "${modelName}" dari pustaka?`,
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

      showToast("Rangkuman dihapus dari pustaka.", "success");
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
      showAlert("Terhapus", `Buku "${bookToDelete.title}" dihapus dari pustaka.`);
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

    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn || '');
    setVerificationResult({ is_valid: true, sources: [], message: "Loaded from Library", title: book.title, authors: [book.author] });
  };

  const loadVariant = (variant) => {
    setCurrentVariant(variant);
    setSummary(variant.summary_content);
    setUsageStats(variant.usage_stats);
    setSavedId(variant.id);
  };

  const validateApiKey = async (key, shouldSave = true) => {
    if (!key) { setKeyValid(null); setKeyError(''); return; }
    setValidatingKey(true);
    setKeyValid(null);
    setKeyError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/models`, {
        api_key: key
      });
      if (response.data.valid) {
        setKeyValid(true);
        setAvailableModels(response.data.models);
        if (shouldSave) {
          saveConfig(key, openRouterModel);
        }
      }
    } catch (err) {
      setKeyValid(false);
      if (err.code === "ERR_NETWORK") {
        setKeyError("Gagal terhubung ke Backend. Server mati?");
        setBackendUp(false);
      } else {
        const msg = err.response?.data?.detail || err.message;
        setKeyError(msg);
      }
    } finally {
      setValidatingKey(false);
    }
  };

  const saveConfig = async (key, model) => {
    try {
      await axios.post(`${API_BASE_URL}/config`, {
        openrouter_key: key,
        openrouter_model: model
      });
    } catch (err) {
      console.error("Failed to save config", err);
    }
  };

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    setOpenRouterModel(newModel);
    saveConfig(openRouterKey, newModel);
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
      const found = existingBook.summaries.find(s => s.model === openRouterModel);
      if (found) {
        setExistingSummary({ book: existingBook, variant: found });
        return;
      }
    }
    setExistingSummary(null);
  }, [verificationResult, openRouterModel, isbn, title, author, savedSummaries]);

  const handleSummarize = async () => {
    if (existingSummary) {
      setCurrentBook(existingSummary.book);
      loadVariant(existingSummary.variant);
      showToast("Memuat rangkuman tersimpan...", "success");
      return;
    }

    if (!verificationResult || !verificationResult.is_valid) return;

    setSummarizing(true);
    setError(null);
    setSummary(null);
    setUsageStats(null);
    setSavedId(null);
    setCurrentVariant(null); // Reset variant context

    try {
      const response = await axios.post(`${API_BASE_URL}/summarize`, {
        metadata: verificationResult.sources,
        api_key: openRouterKey || null,
        model: openRouterModel || null
      });
      setSummary(response.data.summary);
      setUsageStats({
        model: response.data.model,
        provider: response.data.provider,
        tokens: response.data.usage,
        cost_estimate: response.data.cost_estimate,
        duration_seconds: response.data.duration_seconds
      });
      setBackendUp(true);
    } catch (err) {
      if (err.code === "ERR_NETWORK") {
        setBackendUp(false);
        setError("Koneksi ke Backend terputus.");
      } else {
        const detail = err.response?.data?.detail || "Gagal membuat rangkuman.";
        setError(`Error: ${detail}`);
      }
    } finally {
      setSummarizing(false);
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
    setSummary(null);
    setUsageStats(null);
    setSavedId(null);
    setError(null);
    setCurrentBook(null);
    setCurrentVariant(null);
  };

  const handleUpdateMetadata = async () => {
    if (!metadataEditBook) return;
    setIsSavingMetadata(true);

    try {
      const response = await axios.put(`${API_BASE_URL}/books/${metadataEditBook.id}/metadata`, {
        title: metadataTitle,
        author: metadataAuthor,
        isbn: metadataIsbn
      });

      // Update local state
      const updatedBook = response.data;
      setSavedSummaries(prev => prev.map(book => book.id === updatedBook.id ? updatedBook : book));
      showToast("Info buku berhasil diperbarui");
      setIsMetadataModalOpen(false);
    } catch (err) {
      console.error("Failed to update metadata:", err);
      showAlert("Gagal", "Gagal memperbarui info buku.");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const LoadingOverlay = () => {
    const [statusIndex, setStatusIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    const statuses = [
      "Membaca bab demi bab...",
      "Menganalisis konteks...",
      "Menyusun poin-poin penting...",
      "Memoles kalimat...",
      "Finishing touch..."
    ];

    useEffect(() => {
      const statusInterval = setInterval(() => {
        setStatusIndex((prev) => (prev + 1) % statuses.length);
        setIsTyping(true);
        setDisplayedText("");
      }, 3500);

      return () => clearInterval(statusInterval);
    }, []);

    // Character-by-character typing effect
    useEffect(() => {
      if (!isTyping) return;

      const targetText = statuses[statusIndex];
      if (displayedText.length < targetText.length) {
        const timeout = setTimeout(() => {
          setDisplayedText(targetText.slice(0, displayedText.length + 1));
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        setIsTyping(false);
      }
    }, [displayedText, statusIndex, isTyping]);

    if (!summarizing) return null;

    return (
      <div className="modal-overlay animate-fade-in" style={{ zIndex: 2000, background: 'rgba(9, 9, 11, 0.85)' }}>
        <div style={{ textAlign: 'center', color: 'white', width: '100%', maxWidth: '450px', padding: '0 1.5rem' }}>

          {/* Semantic Wave Header */}
          <div className="semantic-wave-container">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="wave-line"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', fontWeight: 500, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.9)' }}>
            SEDANG MERANGKUM
          </h3>

          <div style={{
            color: 'var(--accent-color)',
            marginBottom: '0',
            height: '24px',
            fontSize: '1.1rem',
            fontWeight: 500
          }}>
            {displayedText}<span className="typing-cursor" />
          </div>
        </div>
      </div>
    );
  };

  const SkeletonSummary = () => {
    return (
      <div className="glass-card animate-fade-in" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', width: '100%' }}>
            {/* Skeleton Cover */}
            <div style={{
              width: '80px',
              height: '120px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '4px',
              flexShrink: 0
            }} className="skeleton-block" />

            <div style={{ flex: 1, paddingTop: '0.5rem' }}>
              <div className="skeleton-block" style={{ width: '60%', height: '24px', marginBottom: '1rem' }} />
              <div className="skeleton-block" style={{ width: '40%', height: '16px' }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem 0' }}>
          <div className="skeleton-block" style={{ width: '100%' }} />
          <div className="skeleton-block" style={{ width: '90%' }} />
          <div className="skeleton-block" style={{ width: '95%' }} />
          <div className="skeleton-block" style={{ width: '100%', marginTop: '2rem' }} />
          <div className="skeleton-block" style={{ width: '85%' }} />
          <div className="skeleton-block" style={{ width: '90%' }} />
          <div className="skeleton-block" style={{ width: '40%', marginTop: '2rem' }} />
        </div>
      </div>
    );
  };

  const MetadataEditModal = () => {
    if (!isMetadataModalOpen || !metadataEditBook) return null;

    return (
      <div className="modal-overlay">
        <div className="modal-content glass-card animate-scale-up" style={{ maxWidth: '500px', width: '90%' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit Info Buku</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Judul</label>
            <input
              type="text"
              className="input-field"
              value={metadataTitle}
              onChange={(e) => setMetadataTitle(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Penulis</label>
            <input
              type="text"
              className="input-field"
              value={metadataAuthor}
              onChange={(e) => setMetadataAuthor(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ISBN</label>
            <input
              type="text"
              className="input-field"
              value={metadataIsbn}
              onChange={(e) => setMetadataIsbn(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              className="btn-secondary"
              onClick={() => setIsMetadataModalOpen(false)}
              disabled={isSavingMetadata}
            >
              Batal
            </button>
            <button
              className="btn-primary"
              onClick={handleUpdateMetadata}
              disabled={isSavingMetadata}
            >
              {isSavingMetadata ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
        <header style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* API Status (Now triggers Settings) */}
            <div
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: 'pointer',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                border: showSettings ? '1px solid var(--text-primary)' : '1px solid var(--border-color)',
                background: showSettings ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s',
                position: 'relative'
              }}
              className="hover-card"
              title="Klik untuk Pengaturan AI"
            >
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: openRouterKey ? (keyValid !== false ? 'var(--success)' : 'var(--error)') : 'var(--border-color)',
                boxShadow: openRouterKey && keyValid !== false ? '0 0 8px var(--success)' : 'none'
              }}></div>
              <span style={{ fontSize: '0.75rem', color: showSettings ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}>
                {openRouterKey && keyValid !== false ? openRouterModel.split('/').pop().split(':')[0] : "Konfigurasi API"}
              </span>
              {validatingKey && <RefreshCw size={12} className="spin-animation" style={{ color: 'var(--text-secondary)' }} />}
            </div>
          </div>

          <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setShowHistory(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              title="Riwayat Pencarian"
            >
              <History size={24} />
            </button>
            <button
              onClick={() => setShowLibrary(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              title="Perpustakaan (Tersimpan)"
            >
              <BookOpen size={24} />
            </button>
          </div>

          <h1 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0' }}>
            <span className="title-gradient">Pustaka+</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: '0 0 1.5rem 0' }}>
            Verifikasi & Rangkuman Buku via OpenRouter
          </p>

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                      position: 'absolute',
                      right: '0.5rem',
                      top: '0',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none'
                    }}>
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'auto',
                          transition: 'color 0.2s'
                        }}
                        title={showApiKey ? "Sembunyikan Key" : "Tampilkan Key"}
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
                    style={{
                      padding: '0 1.25rem',
                      height: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      whiteSpace: 'nowrap',
                      minWidth: 'auto'
                    }}
                  >
                    {validatingKey ? (
                      <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                    ) : (
                      <RefreshCw size={14} className={validatingKey ? "spin-animation" : ""} />
                    )}
                  </button>

                  {(keyValid === true || keyValid === false) && !validatingKey && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {keyValid === true ? (
                        <CheckCircle size={20} color="var(--success)" title="Key Valid" />
                      ) : (
                        <AlertCircle size={20} color="var(--error)" title="Key Invalid" />
                      )}
                    </div>
                  )}
                </div>
                {keyError && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '1rem', margin: 0 }}>{keyError}</p>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Default AI Model
                </label>
                <SearchableSelect
                  options={availableModels}
                  value={openRouterModel}
                  onChange={(val) => {
                    setOpenRouterModel(val);
                    axios.post(`${API_BASE_URL}/config`, { openrouter_model: val });
                  }}
                  placeholder="Pilih model..."
                />
              </div>
            </div>

            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                API Key disimpan secara lokal di file `.env` server.
              </p>
            </div>
          </div>
        )}

        {/* Input Form */}
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleVerify}>
            <div style={{ display: 'grid', gridTemplateColumns: showIsbn ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Judul Buku</label>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Penulis</label>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}>
              <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {loading ? <><span className="spinner"></span> Memverifikasi...</> : <><Search size={18} style={{ marginRight: '8px' }} /> Cari & Verifikasi</>}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem' }}
                title="Reset Sesi"
              >
                <RotateCcw size={18} />
                <span style={{ marginLeft: '8px' }}>Reset</span>
              </button>
            </div>
          </form>
        </div>

        {/* Verification Result */}
        {verificationResult && (
          <div className="glass-card animate-fade-in" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              {verificationResult.is_valid ? (
                <CheckCircle size={32} color="var(--success)" style={{ marginRight: '1rem' }} />
              ) : (
                <AlertCircle size={32} color="var(--error)" style={{ marginRight: '1rem' }} />
              )}
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  {verificationResult.is_valid ? "Buku Terverifikasi" : "Verifikasi Gagal"}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{verificationResult.message}</p>
              </div>
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
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>Sinopsis (Dari Sumber)</h4>
                <p style={{
                  fontSize: '0.9rem', lineHeight: '1.5', color: '#e2e8f0',
                  background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '6px',
                  maxHeight: '150px', overflowY: 'auto', fontStyle: verificationResult.sources.some(s => s.description) ? 'normal' : 'italic',
                  opacity: verificationResult.sources.some(s => s.description) ? 1 : 0.7
                }}>
                  {verificationResult.sources.find(s => s.description)?.description || "Tidak ada deskripsi tersedia dari sumber data."}
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
                      style={{ width: '100px', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  {!summary && (
                    <button
                      onClick={handleSummarize}
                      className="btn-primary"
                      disabled={summarizing}
                      style={{
                        backgroundColor: existingSummary ? 'var(--success)' : '',
                        borderColor: existingSummary ? 'var(--success)' : ''
                      }}
                    >
                      {existingSummary ? (
                        <><BookOpen size={18} style={{ marginRight: '8px' }} /> Buka Rangkuman Tersimpan</>
                      ) : (
                        summarizing ? <><span className="spinner"></span> Sedang Merangkum...</> : <><Sparkles size={18} style={{ marginRight: '8px' }} /> Generate Rangkuman AI</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        {/* Summary Result Area */}
        {summarizing && !summary && <SkeletonSummary />}

        {/* Summary Result */}
        {summary && (
          <div className="glass-card animate-fade-in">
            {/* Version Switcher if multiple versions available */}
            {currentBook && currentBook.summaries && currentBook.summaries.length > 1 && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Versi Rangkuman (Pilih Model)
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {currentBook.summaries.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => loadVariant(variant)}
                      className={currentVariant && currentVariant.id === variant.id ? "btn-primary" : "btn-secondary"}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.25rem 0.75rem',
                        opacity: currentVariant && currentVariant.id === variant.id ? 1 : 0.7,
                        minWidth: 'auto'
                      }}
                    >
                      {variant.model ? variant.model.split('/').pop() : 'Unknown'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {/* Book Cover in Header */}
                {currentBook && currentBook.image_url && (
                  <div style={{ flexShrink: 0, marginRight: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <img
                      src={getImageUrl(currentBook.image_url)}
                      alt="Cover"
                      style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
                {!currentBook && verificationResult && verificationResult.sources && verificationResult.sources.some(s => s.image_url) && (
                  <div style={{ flexShrink: 0, marginRight: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    <img
                      src={getImageUrl(verificationResult.sources.find(s => s.image_url).image_url)}
                      alt="Cover"
                      style={{ width: '80px', height: '120px', objectFit: 'cover', borderRadius: '4px' }}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Book size={24} color="var(--accent-color)" />
                    {currentBook ? currentBook.title : verificationResult?.title}
                  </h2>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    {currentBook ? currentBook.title : (verificationResult?.sources[0]?.title || title)}
                  </div>
                </div>
              </div>

              <button
                onClick={savedId ? handleDeleteCurrent : handleSaveSummary}
                className={savedId ? "btn-danger" : "btn-primary"}
                style={{
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: savedId ? 'var(--error)' : '',
                  borderColor: savedId ? 'var(--error)' : '',
                  color: savedId ? 'white' : ''
                }}
              >
                {savedId ? (
                  <><Trash2 size={16} style={{ marginRight: '8px' }} /> Hapus Versi Ini</>
                ) : (
                  <><Save size={16} style={{ marginRight: '8px' }} /> Simpan ke Pustaka</>
                )}
              </button>
            </div>

            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summary}
              </ReactMarkdown>
            </div>

            {usageStats && (
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
                    Provider: {usageStats.provider}
                  </span>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    Model: {usageStats.model.split('/').pop()}
                  </span>
                  {usageStats.cost_estimate && (
                    <span className="badge" style={{
                      background: usageStats.cost_estimate.is_free ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                      color: usageStats.cost_estimate.is_free ? 'var(--success)' : 'inherit',
                      border: usageStats.cost_estimate.is_free ? '1px solid rgba(34, 197, 94, 0.2)' : 'none'
                    }}>
                      Biaya: {usageStats.cost_estimate.is_free ? "GRATIS" :
                        usageStats.cost_estimate.total_idr
                          ? `Rp ${usageStats.cost_estimate.total_idr.toLocaleString('id-ID')} ($${usageStats.cost_estimate.total_usd})`
                          : (usageStats.cost_estimate.total_usd !== null ? `$${usageStats.cost_estimate.total_usd}` : "Estimasi N/A")
                      }
                    </span>
                  )}
                  {usageStats.duration_seconds && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      Waktu: {usageStats.duration_seconds}s
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <span>Prompt: {usageStats.tokens.prompt_tokens}</span>
                  <span>Completion: {usageStats.tokens.completion_tokens}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>
                    Total: {usageStats.tokens.total_tokens} Tokens
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Modal */}
      {
        showHistory && (
          <div className="modal-overlay animate-fade-in">
            <div className="glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <History size={20} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
                  Riwayat Pencarian
                </h3>
                <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
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
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--error)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Bersihkan Semua Riwayat
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {/* Library Modal */}
      {
        showLibrary && (
          <div className="modal-overlay animate-fade-in">
            <div className="glass-card" style={{ width: '100%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center' }}>
                  <BookOpen size={20} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
                  Perpustakaan Tersimpan
                </h3>
                <button onClick={() => setShowLibrary(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={24} />
                </button>
              </div>

              <div
                id="library-content"
                ref={libraryContentRef}
                style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}
              >
                {savedSummaries.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    Belum ada rangkuman tersimpan.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {savedSummaries.map((book) => (
                      <div key={book.id} className="glass-card" style={{ padding: '0', cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={() => loadFromLibrary(book)}>
                        <div style={{
                          width: '100%', height: '140px', backgroundColor: 'var(--bg-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', flexShrink: 0, position: 'relative'
                        }}>
                          {book.image_url ? (
                            <img
                              src={getImageUrl(book.image_url)}
                              alt={book.title}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          ) : (
                            <Book size={32} color="var(--text-secondary)" opacity={0.3} />
                          )}

                          <div
                            className="cover-edit-btn"
                            title="Ganti Cover"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverEditBook(book);
                              setIsCoverModalOpen(true);
                              setCoverSearchQuery(book.title);
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: 'rgba(0,0,0,0.6)',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              cursor: 'pointer',
                              zIndex: 10,
                              backdropFilter: 'blur(4px)'
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
                              setIsMetadataModalOpen(true);
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              background: 'rgba(0,0,0,0.6)',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              cursor: 'pointer',
                              zIndex: 10,
                              backdropFilter: 'blur(4px)'
                            }}
                          >
                            <PenTool size={16} />
                          </div>
                        </div>

                        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.5rem' }} title={book.title}>
                            {book.title}
                          </h4>
                          <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{book.author}</p>

                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{new Date(book.last_updated).toLocaleDateString()}</span>
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>
                              {book.summaries.length} Versi
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                            <button
                              onClick={(e) => handleDeleteBook(book.id, e)}
                              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}
                            >
                              <Trash2 size={14} style={{ marginRight: '4px' }} /> Hapus Buku
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div >
        )
      }

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
        title="Hapus Buku?"
        message={`Apakah Anda yakin ingin menghapus buku "${bookToDelete?.title}" dan semua ringkasannya?`}
        confirmText="Hapus"
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

      <MetadataEditModal />
      <LoadingOverlay />

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

