import { useState } from 'react';

/**
 * Custom hook to manage book verification state
 * Extracted from App.jsx to reduce complexity
 */
export const useBookVerification = () => {
    const [isbn, setIsbn] = useState('');
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [loading, setLoading] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);
    const [error, setError] = useState(null);
    const [showIsbn, setShowIsbn] = useState(false);

    const resetVerification = () => {
        setIsbn('');
        setTitle('');
        setAuthor('');
        setVerificationResult(null);
        setError(null);
    };

    return {
        // States
        isbn,
        setIsbn,
        title,
        setTitle,
        author,
        setAuthor,
        loading,
        setLoading,
        verificationResult,
        setVerificationResult,
        error,
        setError,
        showIsbn,
        setShowIsbn,

        // Functions
        resetVerification,
    };
};
