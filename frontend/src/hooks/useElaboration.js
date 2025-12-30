import { useState, useRef } from 'react';

/**
 * Custom hook to manage elaboration panel state
 * Extracted from App.jsx to reduce complexity
 */
export const useElaboration = () => {
    const [selectionContext, setSelectionContext] = useState(null);
    const [elaborationChat, setElaborationChat] = useState([]);
    const [isElaborating, setIsElaborating] = useState(false);
    const [elaborationQuery, setElaborationQuery] = useState("");
    const [showElaborationPanel, setShowElaborationPanel] = useState(false);

    const resetElaboration = () => {
        setSelectionContext(null);
        setElaborationChat([]);
        setIsElaborating(false);
        setElaborationQuery("");
        setShowElaborationPanel(false);
    };

    return {
        selectionContext,
        setSelectionContext,
        elaborationChat,
        setElaborationChat,
        isElaborating,
        setIsElaborating,
        elaborationQuery,
        setElaborationQuery,
        showElaborationPanel,
        setShowElaborationPanel,
        resetElaboration,
    };
};
