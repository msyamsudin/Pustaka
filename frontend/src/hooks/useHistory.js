import { useState } from 'react';

/**
 * Custom hook to manage search history state
 * Extracted from App.jsx to reduce complexity
 */
export const useHistory = () => {
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [copied, setCopied] = useState(false);

    return {
        history,
        setHistory,
        showHistory,
        setShowHistory,
        copied,
        setCopied,
    };
};
