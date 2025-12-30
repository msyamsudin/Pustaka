import { useState, useRef, useCallback } from 'react';
import * as api from '../services/api';

/**
 * Custom hook to manage notes state
 * Extracted from App.jsx to reduce complexity
 */
export const useNoteManagement = () => {
    const [isNoteReviewOpen, setIsNoteReviewOpen] = useState(false);
    const [noteReviewContent, setNoteReviewContent] = useState("");
    const [notes, setNotes] = useState([]);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const noteReviewTextareaRef = useRef(null);

    // Refinement State
    const [isRefineModalOpen, setIsRefineModalOpen] = useState(false);
    const [refineInstruction, setRefineInstruction] = useState("");
    const [isRefining, setIsRefining] = useState(false);
    const [refinedPreview, setRefinedPreview] = useState(null);
    const [isRefinementPreviewOpen, setIsRefinementPreviewOpen] = useState(false);

    const resetNotes = useCallback(() => {
        setIsNoteReviewOpen(false);
        setNoteReviewContent("");
        setEditingNoteId(null);
    }, []);

    const saveNote = useCallback(async (savedId, content, refText = "Manual Note") => {
        try {
            let newNote;
            if (editingNoteId) {
                // Update existing note
                const res = await api.updateNote(savedId, editingNoteId, {
                    content_markdown: content
                });
                newNote = res.data;
                setNotes(prev => prev.map(n => n.id === editingNoteId ? newNote : n));
            } else {
                // Create new note
                const res = await api.createNote(savedId, {
                    ref_text: refText,
                    content_markdown: content
                });
                newNote = res.data;
                setNotes(prev => [...prev, newNote]);
            }

            // Close editor
            setIsNoteReviewOpen(false);
            setNoteReviewContent("");
            setEditingNoteId(null);

            return newNote;
        } catch (err) {
            console.error("Failed to save note", err);
            throw err;
        }
    }, [editingNoteId]);

    const deleteNote = useCallback(async (savedId, noteId) => {
        try {
            await api.deleteNote(savedId, noteId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            return true;
        } catch (err) {
            console.error("Failed to delete note", err);
            throw err;
        }
    }, []);

    return {
        // Note Review
        isNoteReviewOpen,
        setIsNoteReviewOpen,
        noteReviewContent,
        setNoteReviewContent,
        notes,
        setNotes,
        editingNoteId,
        setEditingNoteId,
        noteReviewTextareaRef,

        // Refinement
        isRefineModalOpen,
        setIsRefineModalOpen,
        refineInstruction,
        setRefineInstruction,
        isRefining,
        setIsRefining,
        refinedPreview,
        setRefinedPreview,
        isRefinementPreviewOpen,
        setIsRefinementPreviewOpen,

        // Functions
        resetNotes,
        saveNote,
        deleteNote
    };
};
