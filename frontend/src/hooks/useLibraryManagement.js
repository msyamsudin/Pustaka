import { useState, useCallback } from 'react';
import * as api from '../services/api';

/**
 * Custom hook to manage library and saved summaries state
 * Extracted from App.jsx to reduce complexity
 */
export const useLibraryManagement = () => {
    const [showLibrary, setShowLibrary] = useState(false);
    const [savedSummaries, setSavedSummaries] = useState([]);
    const [currentBook, setCurrentBook] = useState(null);
    const [currentVariant, setCurrentVariant] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const [existingSummary, setExistingSummary] = useState(null);

    // Cover Edit
    const [coverEditBook, setCoverEditBook] = useState(null);
    const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

    // Metadata Edit
    const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
    const [metadataEditBook, setMetadataEditBook] = useState(null);
    const [metadataTitle, setMetadataTitle] = useState("");
    const [metadataAuthor, setMetadataAuthor] = useState("");
    const [metadataIsbn, setMetadataIsbn] = useState("");
    const [metadataGenre, setMetadataGenre] = useState("");
    const [isSavingMetadata, setIsSavingMetadata] = useState(false);

    // Delete Confirmation
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [bookToDelete, setBookToDelete] = useState(null);

    // Notion Sharing
    const [isNotionSharing, setIsNotionSharing] = useState(false);

    const resetLibrary = useCallback(() => {
        setCurrentBook(null);
        setCurrentVariant(null);
        setSavedId(null);
        setExistingSummary(null);
    }, []);

    const loadLibrary = useCallback(async () => {
        try {
            const res = await api.loadSavedSummaries();
            // Sort by last_updated descending (newest first)
            const sorted = res.data.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
            setSavedSummaries(sorted);
            return sorted;
        } catch (err) {
            console.error("Failed to load saved summaries", err);
            throw err;
        }
    }, []);

    const saveSummary = useCallback(async (summaryData) => {
        try {
            const response = await api.saveSummary(summaryData);
            const newVariant = response.data;
            setSavedId(newVariant.id);
            setCurrentVariant(newVariant);
            await loadLibrary();
            return newVariant;
        } catch (err) {
            console.error("Failed to save summary", err);
            throw err;
        }
    }, [loadLibrary]);

    const deleteSavedSummary = useCallback(async (id) => {
        try {
            await api.deleteSavedSummary(id);
            const sorted = await loadLibrary();

            // Check current book status after delete
            if (currentBook) {
                const updatedBook = sorted.find(b => b.id === currentBook.id);
                if (updatedBook && updatedBook.summaries && updatedBook.summaries.length > 0) {
                    setCurrentBook(updatedBook);
                    // Return the updated book so the caller can decide what variant to load
                    return { status: 'updated', book: updatedBook };
                } else {
                    // No more summaries for this book
                    return { status: 'empty' };
                }
            } else {
                setSavedId(null);
                return { status: 'deleted' };
            }
        } catch (err) {
            console.error("Delete failed:", err);
            throw err;
        }
    }, [currentBook, loadLibrary]);

    const deleteBook = useCallback(async (bookId) => {
        try {
            await api.deleteBook(bookId);
            await loadLibrary();
            return true;
        } catch (err) {
            console.error("Failed to delete book", err);
            throw err;
        } finally {
            setDeleteConfirmOpen(false);
            setBookToDelete(null);
        }
    }, [loadLibrary]);

    const updateCover = useCallback(async (bookId, newUrl) => {
        try {
            await api.updateCover(bookId, newUrl);
            await loadLibrary();
            setIsCoverModalOpen(false);
            return true;
        } catch (err) {
            console.error("Cover update failed", err);
            throw err;
        }
    }, [loadLibrary]);

    return {
        // Library UI
        showLibrary,
        setShowLibrary,
        savedSummaries,
        setSavedSummaries,

        // Current Book
        currentBook,
        setCurrentBook,
        currentVariant,
        setCurrentVariant,
        savedId,
        setSavedId,
        existingSummary,
        setExistingSummary,

        // Cover Edit
        coverEditBook,
        setCoverEditBook,
        isCoverModalOpen,
        setIsCoverModalOpen,

        // Metadata Edit
        isMetadataModalOpen,
        setIsMetadataModalOpen,
        metadataEditBook,
        setMetadataEditBook,
        metadataTitle,
        setMetadataTitle,
        metadataAuthor,
        setMetadataAuthor,
        metadataIsbn,
        setMetadataIsbn,
        metadataGenre,
        setMetadataGenre,
        isSavingMetadata,
        setIsSavingMetadata,

        // Delete
        deleteConfirmOpen,
        setDeleteConfirmOpen,
        bookToDelete,
        setBookToDelete,

        // Notion
        isNotionSharing,
        setIsNotionSharing,

        // Functions
        resetLibrary,
        loadLibrary,
        saveSummary,
        deleteSavedSummary, // Renamed from performDeleteCurrent to be more generic
        deleteBook,
        updateCover
    };
};
