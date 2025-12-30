import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, CheckCircle, Search, AlertCircle, Sparkles, Settings, Save, RefreshCw, History, X, Trash2, BookOpen, RotateCcw, Home, PenTool, Eye, EyeOff, Copy, Check, Tag, Edit3, Bold, Italic, List, Quote, Heading, Code, Minus, MessageSquarePlus, Share2, Globe, ExternalLink, Calendar } from 'lucide-react';

// Service Imports
import * as api from './services/api';
import { getImageUrl } from './utils/helpers';

// Component Imports
import SearchableSelect from './components/common/SearchableSelect';
import Toast from './components/common/Toast';
import SkeletonSummary from './components/common/SkeletonSummary';
import IterativeProgress from './components/common/IterativeProgress';
import BackendStatusBanner from './components/common/BackendStatusBanner';
import SimpleModal from './components/modals/SimpleModal';
import CoverSelectionModal from './components/modals/CoverSelectionModal';
import MetadataEditModal from './components/modals/MetadataEditModal';
import SettingsPanel from './components/SettingsPanel';
import LibrarySidebar from './components/LibrarySidebar';
import HistorySidebar from './components/HistorySidebar';
import BookInputForm from './components/forms/BookInputForm';
import VerificationResultCard from './components/cards/VerificationResultCard';

import { applyMarkdownFormat } from './utils/markdownUtils';

// Custom Hooks
import {
  useModalState,
  useSettings,
  useBookVerification,
  useSummaryGeneration,
  useLibraryManagement,
  useHistory,
  useElaboration,
  useNoteManagement,
  useUIState
} from './hooks';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";



function App() {
  // ========== Custom Hooks ==========
  // Modal Management
  const {
    confirmModal, alertModal, toast,
    showAlert, closeAlert, showConfirm, closeConfirm, showToast, setToast
  } = useModalState();

  // Settings Management
  const {
    provider, setProvider,
    openRouterKey, setOpenRouterKey, openRouterModel, setOpenRouterModel,
    ollamaBaseUrl, setOllamaBaseUrl, ollamaModel, setOllamaModel,
    groqKey, setGroqKey, groqModel, setGroqModel,
    notionApiKey, setNotionApiKey, notionDatabaseId, setNotionDatabaseId,
    braveApiKey, setBraveApiKey, enableSearchEnrichment, setEnableSearchEnrichment,
    searchMaxResults, setSearchMaxResults, showBraveKey, setShowBraveKey,
    braveKeyValid, setBraveKeyValid, validatingBraveKey, setValidatingBraveKey,
    showSettings, setShowSettings, showApiKey, setShowApiKey,
    keyValid, setKeyValid, keyError, setKeyError, validatingKey, setValidatingKey,
    availableModels, setAvailableModels,
    backendUp, setBackendUp, configLoaded, setConfigLoaded,
    iterativeMode, setIterativeMode, criticModel, setCriticModel,
    highQuality, setHighQuality, draftCount, setDraftCount,
    loadConfiguration
  } = useSettings();

  // Book Verification
  const {
    isbn, setIsbn, title, setTitle, author, setAuthor,
    loading, setLoading, verificationResult, setVerificationResult,
    error, setError, showIsbn, setShowIsbn
  } = useBookVerification();

  // Summary Generation
  const {
    summary, setSummary, usageStats, setUsageStats,
    diversityAnalysis, setDiversityAnalysis, synthesisMetadata, setSynthesisMetadata,
    summarizing, setSummarizing, streamingStatus, setStreamingStatus,
    tokensReceived, setTokensReceived, progress, setProgress,
    abortControllerRef, iterativeStats, setIterativeStats,
    searchSources, setSearchSources, showSearchSources, setShowSearchSources,
    sonarCitations, setSonarCitations,
    isUpdated, setIsUpdated,
    isSelectionMode, setIsSelectionMode, selectedVariantIds, setSelectedVariantIds
  } = useSummaryGeneration();

  // Library Management
  const {
    showLibrary, setShowLibrary, savedSummaries, setSavedSummaries,
    currentBook, setCurrentBook, currentVariant, setCurrentVariant,
    savedId, setSavedId, existingSummary, setExistingSummary,
    coverEditBook, setCoverEditBook, isCoverModalOpen, setIsCoverModalOpen,
    isMetadataModalOpen, setIsMetadataModalOpen, metadataEditBook, setMetadataEditBook,
    metadataTitle, setMetadataTitle, metadataAuthor, setMetadataAuthor,
    metadataIsbn, setMetadataIsbn, metadataGenre, setMetadataGenre,
    metadataPublishedDate, setMetadataPublishedDate,
    isSavingMetadata, setIsSavingMetadata,
    deleteConfirmOpen, setDeleteConfirmOpen, bookToDelete, setBookToDelete,
    isNotionSharing, setIsNotionSharing,
    loadLibrary, saveSummary, deleteSavedSummary, deleteBook, updateCover
  } = useLibraryManagement();

  // History Management
  const { history, setHistory, showHistory, setShowHistory, copied, setCopied } = useHistory();

  // Elaboration
  const {
    selectionContext, setSelectionContext, elaborationChat, setElaborationChat,
    isElaborating, setIsElaborating, elaborationQuery, setElaborationQuery,
    showElaborationPanel, setShowElaborationPanel
  } = useElaboration();

  // Note Management
  const {
    isNoteReviewOpen, setIsNoteReviewOpen, noteReviewContent, setNoteReviewContent,
    notes, setNotes, editingNoteId, setEditingNoteId, noteReviewTextareaRef,
    isRefineModalOpen, setIsRefineModalOpen, refineInstruction, setRefineInstruction,
    isRefining, setIsRefining, refinedPreview, setRefinedPreview,
    isRefinementPreviewOpen, setIsRefinementPreviewOpen,
    saveNote, deleteNote
  } = useNoteManagement();

  // UI State
  const { isStuck, setIsStuck, headerRef, stickySentinelRef, libraryContentRef } = useUIState();

  // ========== End Custom Hooks ==========

  // Editor Toolbar Handler
  const handleFormat = (command) => {
    applyMarkdownFormat(command, noteReviewTextareaRef.current, noteReviewContent, setNoteReviewContent);
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
      const res = await api.elaborate({
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
          await deleteNote(savedId, noteId);
          showToast("Catatan dihapus", "success");
        } catch (err) {
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
        await saveNote(savedId, markdownContent, selectionContext?.text);
        showToast(editingNoteId ? "Catatan diperbarui" : "Diskusi berhasil diarsipkan ke Lampiran", "success");
      } catch (err) {
        showToast("Gagal menyimpan catatan ke backend", "error");
      }
    } else {
      // Fallback: If not saved, we can still append to local summary for now 
      // or show a warning. Let's append to local summary as a fallback.
      const newSummary = (summary || "").trim() + "\n\n---\n\n" + markdownContent;
      setSummary(newSummary);
      showToast("Diskusi ditambahkan ke ringkasan (Belum diarsipkan)", "info");

      // Close editor since saveNote hook would usually do it, but we are in fallback
      setIsNoteReviewOpen(false);
      setNoteReviewContent("");
      setEditingNoteId(null);
    }

    // Cleanup Elaboration
    setShowElaborationPanel(false);
    setElaborationChat([]);
    setElaborationQuery("");
    setSelectionContext(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleUpdateCover = async (bookId, newUrl) => {
    try {
      await updateCover(bookId, newUrl);
      showToast("Sampul diperbarui", "success");
    } catch (err) {
      showAlert("Error", "Gagal memperbarui sampul.");
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

    loadConfiguration();

    // IntersectionObserver for sticky header detection
    const hasSummary = !!summary;
    const sentinel = stickySentinelRef.current;

    if (!hasSummary || !sentinel) {
      setIsStuck(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When entry.isIntersecting is false, it means the sentinel has scrolled out of view
        // top <= 0 means it went above the viewport
        setIsStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: [0, 1] }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [!!summary]); // Only re-run when summary appears or disappears

  // Load saved summaries when opening library
  useEffect(() => {
    if (showLibrary && libraryContentRef.current) {
      libraryContentRef.current.scrollTop = 0;
    }
  }, [savedSummaries, showLibrary]);

  useEffect(() => {
    loadLibrary();
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
      await saveSummary({
        title: title || currentBook?.title || verificationResult.sources[0]?.title || "Unknown Title",
        author: author || currentBook?.author || verificationResult.sources[0]?.author || "Unknown Author",
        summary_content: summary,
        usage_stats: usageStats || {},
        metadata: {
          isbn: isbn,
          genre: currentBook?.genre || (verificationResult.sources.find(s => s.genre)?.genre || ""),
          publishedDate: currentBook?.publishedDate || (verificationResult.sources.find(s => s.publishedDate)?.publishedDate || ""),
          sources: verificationResult.sources,
          image_url: imageUrl
        }
      });
      showToast("Intelligence Brief berhasil disimpan");
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
      const result = await deleteSavedSummary(id);

      if (result.status === 'updated') {
        loadVariant(result.book.summaries[0]);
      } else if (result.status === 'empty' || result.status === 'deleted') {
        handleReset();
      }

      showToast("Intelligence Brief dihapus dari arsip.", "success");
    } catch (err) {
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
      await deleteBook(bookToDelete.id);
      if (currentBook && currentBook.id === bookToDelete.id) {
        handleReset();
      }
      showAlert("Terhapus", `Buku "${bookToDelete.title}" dihapus dari arsip.`);
    } catch (err) {
      showAlert("Error", "Gagal menghapus buku.");
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
      publishedDate: book.publishedDate || "",
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

    try {
      setValidatingKey(true);
      const res = await api.validateApiKey(targetProvider, key, baseUrl);
      if (res.data.valid) {
        setKeyValid(true);
        setKeyError('');
        setAvailableModels(res.data.models); // Update available models
        if (shouldSave) {
          saveConfiguration({ // Use saveConfiguration
            provider: targetProvider,
            openrouter_key: targetProvider === 'OpenRouter' ? key : openRouterKey,
            groq_key: targetProvider === 'Groq' ? key : groqKey,
            ollama_base_url: targetProvider === 'Ollama' ? baseUrl : ollamaBaseUrl,
            notion_api_key: notionApiKey,
            notion_database_id: notionDatabaseId
          });
        }
      } else {
        setKeyValid(false);
        setKeyError(res.data.error || 'API Key tidak valid.');
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

  const saveConfiguration = async (updates) => {
    try {
      await api.saveConfig(updates);
      showToast("Konfigurasi disimpan", "success");
      // setShowSettings(false); // This might be handled elsewhere
    } catch (err) {
      console.error("Failed to save config", err);
      showAlert("Error", "Gagal menyimpan konfigurasi.");
    }
  };

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    if (provider === 'OpenRouter') {
      setOpenRouterModel(newModel);
      saveConfiguration({ openrouter_model: newModel });
    } else if (provider === 'Groq') {
      setGroqModel(newModel);
      saveConfiguration({ groq_model: newModel });
    } else {
      setOllamaModel(newModel);
      saveConfiguration({ ollama_model: newModel });
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setVerificationResult(null);
    setSummary(null);
    setError(null);
    setCurrentBook(null); // Reset current book context on new search
    setIterativeStats(null); // Clear iterative progress on new search

    // Add to history
    if (isbn || title || author) {
      addToHistory({ isbn, title, author });
    }

    try {
      const response = await api.verifyBook({
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
      setSearchSources(null);
      setSonarCitations(null);
      setShowSearchSources(false);
      setIterativeStats(null); // Reset stats
    }
    setStreamingStatus(isResume ? "Re-establishing knowledge gateway..." : (iterativeMode ? "Initializing Iterative Mode..." : "Initializing synthesis engine..."));

    abortControllerRef.current = new AbortController();

    try {
      const response = await api.streamSummarize({
        metadata: verificationResult.sources,
        provider: overrideConfig ? overrideConfig.provider : provider,
        api_key: overrideConfig
          ? (overrideConfig.provider === 'OpenRouter' ? openRouterKey : overrideConfig.provider === 'Groq' ? groqKey : null)
          : (provider === 'OpenRouter' ? openRouterKey : (provider === 'Groq' ? groqKey : null)),
        model: overrideConfig ? overrideConfig.model : (provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)),
        base_url: overrideConfig ? overrideConfig.base_url : (provider === 'Ollama' ? ollamaBaseUrl : null),
        partial_content: isResume ? summary : null,
        enhance_quality: highQuality,
        draft_count: highQuality ? draftCount : 1,
        iterative_mode: iterativeMode,
        critic_model: criticModel === 'same' ? null : criticModel
      }, abortControllerRef.current.signal);

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

              if (data.content && !data.event) {
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
                  draft_count: data.draft_count,
                  format: data.format
                });

                // Mark Iterative Progress as Complete
                if (data.is_enhanced && iterativeMode) {
                  setIterativeStats(prev => ({
                    ...prev,
                    status: 'Optimization Complete',
                    isComplete: true,
                    totalIterations: data.draft_count // Pass total iterations to detect early stop
                  }));
                }
                if (data.is_enhanced) {
                  const modeName = data.format === 'iterative_refined' ? 'Iterative Self-Correction' : 'Analytical Refining';
                  showToast(`Kualitas ditingkatkan via ${modeName}`, "success");
                }
                if (data.search_sources) {
                  setSearchSources(data.search_sources);
                }
                // Parse Perplexity Sonar citations if available
                if (data.sonar_citations) {
                  setSonarCitations(data.sonar_citations);
                }
              }

              // Iterative Mode Events
              if (data.event) {
                // If event brings full content (Draft/Refine Complete), REPLACE the summary
                if (data.content && (data.event === 'draft_complete' || data.event === 'refine_complete')) {
                  accumulatedSummary = data.content; // REPLACE, don't append
                  setSummary(accumulatedSummary);

                  // Trigger Visual Feedback
                  setIsUpdated(true);
                  setTimeout(() => setIsUpdated(false), 1500);
                }

                setIterativeStats(prev => {
                  const current = prev || { steps: [], iteration: 1 };
                  const newSteps = [...current.steps];

                  if (data.event === 'draft_complete') {
                    newSteps.push({ type: 'draft', iteration: current.iteration });
                  } else if (data.event === 'score') {
                    newSteps.push({ type: 'critic', score: data.score, issues: data.issues, iteration: data.iteration });
                    return { ...current, steps: newSteps, iteration: data.iteration };
                  } else if (data.event === 'refine_start') {
                    newSteps.push({ type: 'refine', iteration: current.iteration });
                  }

                  return { ...current, steps: newSteps, status: data.status };
                });
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
    setIterativeStats(null); // Clear iterative progress on new synthesis
    setNotes([]); // Reset notes for synthesis
    setCurrentVariant(null);
    setTokensReceived(0);

    abortControllerRef.current = new AbortController();

    try {
      const response = await api.streamSynthesize({
        summary_ids: selectedVariantIds,
        provider: provider,
        model: provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)
      }, abortControllerRef.current.signal);

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
    setIterativeStats(null); // Clear iterative progress on full reset
    setHighQuality(false);
    setIsSelectionMode(false);
    setSelectedVariantIds([]);
    setIsStuck(false);
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
      await api.updateMetadata(metadataEditBook.id, {
        title: metadataTitle,
        author: metadataAuthor,
        isbn: metadataIsbn,
        genre: metadataGenre,
        publishedDate: metadataPublishedDate
      });

      // Reload library to reflect changes
      const updatedLibrary = await loadLibrary();

      // Update current book if it's the one we just edited
      if (currentBook && currentBook.id === metadataEditBook.id) {
        const updatedBook = updatedLibrary.find(b => b.id === currentBook.id);
        if (updatedBook) {
          setCurrentBook(updatedBook);
          // Also update existing verification result if present
          if (verificationResult) {
            setVerificationResult(prev => ({
              ...prev,
              sources: prev.sources.map(s => ({
                ...s,
                title: metadataTitle,
                author: metadataAuthor,
                genre: metadataGenre,
                publishedDate: metadataPublishedDate
              }))
            }));
          }
        }
      }

      setIsMetadataModalOpen(false);
      showToast("Info buku diperbarui", "success");
    } catch (err) {
      console.error("Failed to update metadata", err);
      showAlert("Error", "Gagal memperbarui info buku.");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleShareToNotion = async () => {
    if (!summary) return;

    setIsNotionSharing(true);
    try {
      const res = await api.shareToNotion({
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
        <BackendStatusBanner backendUp={backendUp} />

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
                title="Archived (Saved)"
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
          </div>
        </header>

        {/* Settings Panel */}
        <SettingsPanel
          showSettings={showSettings}
          onClose={() => setShowSettings(false)}
          provider={provider}
          setProvider={setProvider}
          openRouterKey={openRouterKey}
          setOpenRouterKey={setOpenRouterKey}
          openRouterModel={openRouterModel}
          setOpenRouterModel={setOpenRouterModel}
          groqKey={groqKey}
          setGroqKey={setGroqKey}
          groqModel={groqModel}
          setGroqModel={setGroqModel}
          ollamaBaseUrl={ollamaBaseUrl}
          setOllamaBaseUrl={setOllamaBaseUrl}
          ollamaModel={ollamaModel}
          setOllamaModel={setOllamaModel}
          notionApiKey={notionApiKey}
          setNotionApiKey={setNotionApiKey}
          notionDatabaseId={notionDatabaseId}
          setNotionDatabaseId={setNotionDatabaseId}
          braveApiKey={braveApiKey}
          setBraveApiKey={setBraveApiKey}
          braveKeyValid={braveKeyValid}
          setBraveKeyValid={setBraveKeyValid}
          validatingBraveKey={validatingBraveKey}
          setValidatingBraveKey={setValidatingBraveKey}
          showBraveKey={showBraveKey}
          setShowBraveKey={setShowBraveKey}
          keyValid={keyValid}
          keyError={keyError}
          validatingKey={validatingKey}
          showApiKey={showApiKey}
          setShowApiKey={setShowApiKey}
          availableModels={availableModels}
          validateApiKey={validateApiKey}
          saveConfiguration={saveConfiguration}
          showToast={showToast}
          showAlert={showAlert}
        />

        {/* Library Sidebar */}
        <LibrarySidebar
          showLibrary={showLibrary}
          onClose={() => setShowLibrary(false)}
          savedSummaries={savedSummaries}
          libraryContentRef={libraryContentRef}
          onLoadBook={loadFromLibrary}
          onDeleteBook={handleDeleteBook}
          onEditCover={(book) => {
            setCoverEditBook(book);
            setIsCoverModalOpen(true);
          }}
          onEditMetadata={(book) => {
            setMetadataEditBook(book);
            setMetadataTitle(book.title);
            setMetadataAuthor(book.author);
            setMetadataIsbn(book.isbn || "");
            setMetadataGenre(book.genre || "");
            setMetadataPublishedDate(book.publishedDate || "");
            setIsMetadataModalOpen(true);
          }}
          API_BASE_URL={API_BASE_URL}
        />


        {/* History Sidebar */}
        <HistorySidebar
          showHistory={showHistory}
          onClose={() => setShowHistory(false)}
          history={history}
          onLoadHistory={loadFromHistory}
          onDeleteHistoryItem={deleteHistoryItem}
          onClearHistory={clearHistory}
        />

        {/* Phase A: Input Form - Only show if no verification result, no current book, settings hidden, library hidden, and history hidden */}
        {!verificationResult && !currentBook && !showSettings && !showLibrary && !showHistory && (
          <BookInputForm
            isbn={isbn}
            setIsbn={setIsbn}
            title={title}
            setTitle={setTitle}
            author={author}
            setAuthor={setAuthor}
            showIsbn={showIsbn}
            setShowIsbn={setShowIsbn}
            loading={loading}
            onSubmit={handleVerify}
            onReset={handleReset}
          />
        )}

        {/* Phase B: Verification Result - Only show if verification exists, not yet summarizing/summary, and settings hidden */}
        {verificationResult && !summarizing && !summary && !showSettings && (
          <VerificationResultCard
            verificationResult={verificationResult}
            summary={summary}
            summarizing={summarizing}
            highQuality={highQuality}
            setHighQuality={setHighQuality}
            iterativeMode={iterativeMode}
            setIterativeMode={setIterativeMode}
            enableSearchEnrichment={enableSearchEnrichment}
            setEnableSearchEnrichment={setEnableSearchEnrichment}
            draftCount={draftCount}
            setDraftCount={setDraftCount}
            criticModel={criticModel}
            setCriticModel={setCriticModel}
            availableModels={availableModels}
            existingSummary={existingSummary}
            onSummarize={handleSummarize}
            onClearVerification={() => setVerificationResult(null)}
            saveConfiguration={saveConfiguration}
          />
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

        {/* Iterative Mode Progress */}
        {iterativeStats && !showSettings && <IterativeProgress stats={iterativeStats} />}

        {/* Summary Result Area */}
        {summarizing && !summary && !showSettings && !iterativeStats && <SkeletonSummary status={streamingStatus} progress={progress} onStop={() => abortControllerRef.current?.abort()} />}

        {/* Sentinel for sticky header detection - placed outside the animating card */}
        {summary && !showSettings && (
          <div ref={stickySentinelRef} style={{ height: '1px', marginBottom: '-1px', width: '100%', pointerEvents: 'none' }}></div>
        )}

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
                              {(() => {
                                const modelName = variant.model ? variant.model.split('/').pop() : 'Unknown';
                                // Determine version number (older is lower number)
                                // variants array is Newest -> Oldest.
                                // So count how many same-model variants are AFTER this one (older than this one)
                                const olderCount = variants.slice(variants.indexOf(variant) + 1).filter(v => v.model === variant.model).length;
                                const version = olderCount + 1;
                                return `${modelName} v${version}`;
                              })()}
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

            {/* Sentinel removed from here */}
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
                        src={getImageUrl(currentBook.image_url, currentBook.last_updated, API_BASE_URL)}
                        alt="Cover"
                        className="sharp-image"
                        style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    ) : (
                      verificationResult?.sources?.find(s => s.image_url) && (
                        <img
                          src={getImageUrl(verificationResult.sources.find(s => s.image_url).image_url, verificationResult.timestamp, API_BASE_URL)}
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
                      {((currentBook && currentBook.publishedDate) || (verificationResult?.sources?.find(s => s.publishedDate)?.publishedDate)) && !isStuck && (
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
                          <Calendar size={10} />
                          {String(currentBook ? currentBook.publishedDate : (verificationResult?.sources?.find(s => s.publishedDate)?.publishedDate || "")).substring(0, 4)}
                        </div>
                      )}
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

            <div className={`markdown-content ${isUpdated ? 'content-updated' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const content = String(children);

                    if (!inline && className === 'language-ref-section') {
                      const inner = content;
                      const items = [];
                      const regex = /(\d+)\.\s+\*\*(.*?)\*\*:\s+\[(.*?)\]\((.*?)\)/g;
                      let match;
                      while ((match = regex.exec(inner)) !== null) {
                        items.push({ id: match[1], label: match[2], title: match[3], url: match[4] });
                      }

                      if (items.length === 0) return null;

                      return (
                        <div className="premium-ref-container animate-slide-up" style={{ margin: '2rem 0', width: '100%', clear: 'both' }}>

                          <div className="premium-ref-grid">
                            {items.map((item, idx) => {
                              const isWiki = item.label.toLowerCase().includes('wikipedia');
                              return (
                                <a
                                  key={idx}
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ref-card-premium stagger-item"
                                  style={{ '--stagger-idx': idx }}
                                >
                                  <div className="ref-card-main-title">{item.title}</div>
                                  <div className="ref-card-footer-url">
                                    {new URL(item.url ? item.url : 'http://localhost').hostname}
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return <code className={className} {...props}>{children}</code>;
                  }
                }}
              >
                {summary ? summary
                  .replace(/\[REF_SECTION\]([\s\S]*?)\[\/REF_SECTION\]/g, '\n\n```ref-section\n$1\n```\n\n')
                  : ""}
              </ReactMarkdown>

              {/* Perplexity Sonar Citations Display */}
              {sonarCitations && sonarCitations.citations && sonarCitations.citations.length > 0 && (
                <div className="premium-ref-container animate-slide-up" style={{ margin: '2rem 0', width: '100%', clear: 'both' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid var(--border-color)'
                  }}>
                    <Sparkles size={16} style={{ color: 'var(--accent-color)' }} />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                      Sonar Citations
                    </h3>
                    <span className="badge" style={{
                      background: 'rgba(147, 51, 234, 0.1)',
                      color: '#9333ea',
                      border: '1px solid rgba(147, 51, 234, 0.2)',
                      fontSize: '0.7rem'
                    }}>
                      {sonarCitations.total_count} sources
                    </span>
                  </div>
                  <div className="premium-ref-grid">
                    {sonarCitations.citations.map((citation, idx) => (
                      <a
                        key={idx}
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ref-card-premium stagger-item"
                        style={{ '--stagger-idx': idx }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            color: 'var(--accent-color)',
                            background: 'rgba(147, 51, 234, 0.1)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px'
                          }}>
                            [{citation.index}]
                          </span>
                          <div className="ref-card-main-title" style={{ flex: 1 }}>
                            {citation.title}
                          </div>
                        </div>
                        {citation.published_date && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                            📅 {citation.published_date}
                          </div>
                        )}
                        <div className="ref-card-footer-url">
                          {new URL(citation.url).hostname}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

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
                  {usageStats?.duration_seconds > 0 && (
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
                      <Sparkles size={12} style={{ marginRight: '4px' }} />
                      {usageStats.format === 'iterative_refined'
                        ? `Iterative Mode (${usageStats.draft_count} Iterations)`
                        : `Refining Mode (${usageStats.draft_count} Drafts)`
                      }
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
                  {usageStats?.search_enriched && (
                    <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      <Search size={12} style={{ marginRight: '4px' }} /> Search Enriched
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
          </div >
        )
        }
      </div >

      {/* Custom Modals */}
      < SimpleModal
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
        onSave={(url) => handleUpdateCover(coverEditBook.id, url)}
        apiBaseUrl={API_BASE_URL}
      />{/* MISSING FUNCTION DEFINITION HERE */}

      <MetadataEditModal
        isOpen={isMetadataModalOpen}
        book={metadataEditBook}
        title={metadataTitle}
        author={metadataAuthor}
        isbn={metadataIsbn}
        genre={metadataGenre}
        publishedDate={metadataPublishedDate}
        setTitle={setMetadataTitle}
        setAuthor={setMetadataAuthor}
        setIsbn={setMetadataIsbn}
        setGenre={setMetadataGenre}
        setPublishedDate={setMetadataPublishedDate}
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