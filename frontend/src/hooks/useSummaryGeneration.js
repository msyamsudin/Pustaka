import { useState, useRef } from 'react';

/**
 * Custom hook to manage summary generation state
 * Extracted from App.jsx to reduce complexity
 */
export const useSummaryGeneration = () => {
    const [summary, setSummary] = useState(null);
    const [usageStats, setUsageStats] = useState(null);
    const [diversityAnalysis, setDiversityAnalysis] = useState(null);
    const [synthesisMetadata, setSynthesisMetadata] = useState(null);
    const [summarizing, setSummarizing] = useState(false);

    // Streaming & Progress
    const [streamingStatus, setStreamingStatus] = useState('');
    const [tokensReceived, setTokensReceived] = useState(0);
    const [progress, setProgress] = useState(0);
    const abortControllerRef = useRef(null);

    // Iterative Mode & Versioning
    const [iterativeStats, setIterativeStats] = useState(null);
    const [versions, setVersions] = useState([]);
    const [activeVersionIndex, setActiveVersionIndex] = useState(-1);
    const [showDiff, setShowDiff] = useState(false);

    // Search Sources
    const [searchSources, setSearchSources] = useState(null);
    const [showSearchSources, setShowSearchSources] = useState(false);


    // Visual Feedback
    const [isUpdated, setIsUpdated] = useState(false);

    // Selection Mode for Variants
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedVariantIds, setSelectedVariantIds] = useState([]);

    const resetSummary = () => {
        setSummary(null);
        setUsageStats(null);
        setDiversityAnalysis(null);
        setSynthesisMetadata(null);
        setSummarizing(false);
        setStreamingStatus('');
        setTokensReceived(0);
        setProgress(0);
        setIterativeStats(null);
        setVersions([]);
        setActiveVersionIndex(-1);
        setSearchSources(null);
        setIsUpdated(false);
        setIsSelectionMode(false);
        setSelectedVariantIds([]);
    };

    return {
        // Summary States
        summary,
        setSummary,
        usageStats,
        setUsageStats,
        diversityAnalysis,
        setDiversityAnalysis,
        synthesisMetadata,
        setSynthesisMetadata,
        summarizing,
        setSummarizing,

        // Streaming & Progress
        streamingStatus,
        setStreamingStatus,
        tokensReceived,
        setTokensReceived,
        progress,
        setProgress,
        abortControllerRef,

        // Iterative
        iterativeStats,
        setIterativeStats,
        versions,
        setVersions,
        activeVersionIndex,
        setActiveVersionIndex,
        showDiff,
        setShowDiff,

        // Search
        searchSources,
        setSearchSources,
        showSearchSources,
        setShowSearchSources,


        // Visual
        isUpdated,
        setIsUpdated,

        // Selection
        isSelectionMode,
        setIsSelectionMode,
        selectedVariantIds,
        setSelectedVariantIds,

        // Functions
        resetSummary,
    };
};
