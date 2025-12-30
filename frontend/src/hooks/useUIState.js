import { useState, useRef } from 'react';

/**
 * Custom hook to manage UI-specific state
 * Extracted from App.jsx to reduce complexity
 */
export const useUIState = () => {
    const [isStuck, setIsStuck] = useState(false);
    const headerRef = useRef(null);
    const stickySentinelRef = useRef(null);
    const libraryContentRef = useRef(null);

    return {
        isStuck,
        setIsStuck,
        headerRef,
        stickySentinelRef,
        libraryContentRef,
    };
};
