import { useState, useCallback } from 'react';
import * as api from '../services/api';

/**
 * Custom hook to manage all settings state (Provider, API Keys, Models)
 * Extracted from App.jsx to reduce complexity
 */
export const useSettings = () => {
    // Provider Settings
    const [provider, setProvider] = useState('OpenRouter');

    // OpenRouter Settings
    const [openRouterKey, setOpenRouterKey] = useState('');
    const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.0-flash-exp:free');

    // Ollama Settings
    const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState('llama3');

    // Groq Settings
    const [groqKey, setGroqKey] = useState('');
    const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');

    // Notion Settings
    const [notionApiKey, setNotionApiKey] = useState('');
    const [notionDatabaseId, setNotionDatabaseId] = useState('');

    // Search Enrichment Settings
    const [braveApiKey, setBraveApiKey] = useState('');
    const [enableSearchEnrichment, setEnableSearchEnrichment] = useState(false);
    const [searchMaxResults, setSearchMaxResults] = useState(5);
    const [showBraveKey, setShowBraveKey] = useState(false);
    const [braveKeyValid, setBraveKeyValid] = useState(null);
    const [validatingBraveKey, setValidatingBraveKey] = useState(false);

    // UI Settings
    const [showSettings, setShowSettings] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    // Validation States
    const [keyValid, setKeyValid] = useState(null); // null, true, false
    const [keyError, setKeyError] = useState('');
    const [validatingKey, setValidatingKey] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);

    // Backend Status
    const [backendUp, setBackendUp] = useState(true);
    const [configLoaded, setConfigLoaded] = useState(false);

    // Advanced Settings
    const [iterativeMode, setIterativeMode] = useState(false);
    const [criticModel, setCriticModel] = useState('same');
    const [highQuality, setHighQuality] = useState(false);
    const [draftCount, setDraftCount] = useState(3);

    const loadConfiguration = useCallback(async () => {
        try {
            const statusRes = await api.checkBackendStatus();
            if (statusRes.status === 200) {
                setBackendUp(true);

                // Load actual configuration
                const configRes = await api.loadConfig();
                const config = configRes.data;

                if (config) {
                    if (config.provider) setProvider(config.provider);
                    if (config.openrouter_key) setOpenRouterKey(config.openrouter_key);
                    if (config.openrouter_model) setOpenRouterModel(config.openrouter_model);
                    if (config.groq_key) setGroqKey(config.groq_key);
                    if (config.groq_model) setGroqModel(config.groq_model);
                    if (config.ollama_base_url) setOllamaBaseUrl(config.ollama_base_url);
                    if (config.ollama_model) setOllamaModel(config.ollama_model);
                    if (config.notion_api_key) setNotionApiKey(config.notion_api_key);
                    if (config.notion_database_id) setNotionDatabaseId(config.notion_database_id);
                    if (config.brave_api_key) setBraveApiKey(config.brave_api_key);
                    if (config.enable_search_enrichment !== undefined) setEnableSearchEnrichment(config.enable_search_enrichment);
                    if (config.search_max_results) setSearchMaxResults(config.search_max_results);

                    setConfigLoaded(true);
                    return true;
                }
            }
        } catch (err) {
            console.error("Failed to load config:", err);
            setBackendUp(false);
            return false;
        }
    }, []);

    return {
        // Provider
        provider,
        setProvider,

        // OpenRouter
        openRouterKey,
        setOpenRouterKey,
        openRouterModel,
        setOpenRouterModel,

        // Ollama
        ollamaBaseUrl,
        setOllamaBaseUrl,
        ollamaModel,
        setOllamaModel,

        // Groq
        groqKey,
        setGroqKey,
        groqModel,
        setGroqModel,

        // Notion
        notionApiKey,
        setNotionApiKey,
        notionDatabaseId,
        setNotionDatabaseId,

        // Search Enrichment
        braveApiKey,
        setBraveApiKey,
        enableSearchEnrichment,
        setEnableSearchEnrichment,
        searchMaxResults,
        setSearchMaxResults,
        showBraveKey,
        setShowBraveKey,
        braveKeyValid,
        setBraveKeyValid,
        validatingBraveKey,
        setValidatingBraveKey,

        // UI
        showSettings,
        setShowSettings,
        showApiKey,
        setShowApiKey,

        // Validation
        keyValid,
        setKeyValid,
        keyError,
        setKeyError,
        validatingKey,
        setValidatingKey,
        availableModels,
        setAvailableModels,

        // Backend
        backendUp,
        setBackendUp,
        configLoaded,
        setConfigLoaded,

        // Advanced
        iterativeMode,
        setIterativeMode,
        criticModel,
        setCriticModel,
        highQuality,
        setHighQuality,
        draftCount,
        setDraftCount,

        // Functions
        loadConfiguration
    };
};
