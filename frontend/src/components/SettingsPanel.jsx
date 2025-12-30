import React, { useEffect } from 'react';
import { Settings, X, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink, Share2, Search } from 'lucide-react';
import SearchableSelect from './common/SearchableSelect';
import * as api from '../services/api';

const SettingsPanel = ({
    // Display control
    showSettings,
    onClose,

    // Provider state
    provider,
    setProvider,

    // OpenRouter state
    openRouterKey,
    setOpenRouterKey,
    openRouterModel,
    setOpenRouterModel,

    // Groq state
    groqKey,
    setGroqKey,
    groqModel,
    setGroqModel,

    // Ollama state
    ollamaBaseUrl,
    setOllamaBaseUrl,
    ollamaModel,
    setOllamaModel,

    // Notion state
    notionApiKey,
    setNotionApiKey,
    notionDatabaseId,
    setNotionDatabaseId,

    // Brave Search state
    braveApiKey,
    setBraveApiKey,
    braveKeyValid,
    setBraveKeyValid,
    validatingBraveKey,
    setValidatingBraveKey,
    showBraveKey,
    setShowBraveKey,

    // Validation state
    keyValid,
    keyError,
    validatingKey,
    showApiKey,
    setShowApiKey,
    availableModels,

    // Callbacks
    validateApiKey,
    saveConfiguration,
    showToast,
    showAlert
}) => {
    useEffect(() => {
        if (showSettings) {
            if (provider === 'OpenRouter') validateApiKey(openRouterKey, false, 'OpenRouter');
            else if (provider === 'Groq') validateApiKey(groqKey, false, 'Groq');
            else if (provider === 'Ollama') validateApiKey(null, false, 'Ollama', ollamaBaseUrl);
        }
    }, [showSettings]);

    if (!showSettings) return null;



    return (
        <div className="glass-card animate-fade-in" style={{
            marginBottom: '2rem',
            width: '100%',
            maxWidth: '800px',
            minHeight: '600px',
            padding: '1.5rem',
            marginLeft: 'auto',
            marginRight: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings size={18} /> Konfigurasi AI
                </h3>
                <button onClick={onClose} className="icon-btn"><X size={18} /></button>
            </div>

            <div style={{ marginTop: '1rem' }}>
                {/* Segmented Control for Providers */}
                <div className="segmented-control">
                    {['OpenRouter', 'Groq', 'Ollama'].map((p) => (
                        <button
                            key={p}
                            onClick={() => {
                                setProvider(p);
                                if (p === 'OpenRouter') validateApiKey(openRouterKey, true, 'OpenRouter');
                                if (p === 'Groq') validateApiKey(groqKey, true, 'Groq');
                                if (p === 'Ollama') validateApiKey(null, true, 'Ollama', ollamaBaseUrl);
                            }}
                            className={`segmented-btn ${provider === p ? 'active' : ''}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>



                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {provider === 'OpenRouter' ? (
                        <>
                            <div className="settings-section">
                                <div className="section-label">Autentikasi</div>
                                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    OpenRouter API Key
                                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="help-link">
                                        Dapatkan Key <ExternalLink size={10} />
                                    </a>
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
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
                                            position: 'absolute', right: '0.5rem', top: '0', height: '100%',
                                            display: 'flex', alignItems: 'center', pointerEvents: 'none'
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                style={{
                                                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                                                    cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', pointerEvents: 'auto'
                                                }}
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
                                        style={{ height: '42px', minWidth: '42px' }}
                                    >
                                        {validatingKey ? <span className="spinner"></span> : <RefreshCw size={14} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : provider === 'Groq' ? (
                        <>
                            <div className="settings-section">
                                <div className="section-label">Autentikasi</div>
                                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Groq API Key
                                    <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="help-link">
                                        Dapatkan Key <ExternalLink size={10} />
                                    </a>
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <input
                                            type={showApiKey ? "text" : "password"}
                                            value={groqKey}
                                            onChange={(e) => setGroqKey(e.target.value)}
                                            className="input-field"
                                            placeholder="gsk_..."
                                            style={{
                                                paddingRight: '3rem',
                                                marginBottom: 0,
                                                borderColor: keyValid === true ? 'var(--success)' : (keyValid === false ? 'var(--error)' : 'var(--border-color)')
                                            }}
                                        />
                                        <div style={{
                                            position: 'absolute', right: '0.5rem', top: '0', height: '100%',
                                            display: 'flex', alignItems: 'center', pointerEvents: 'none'
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                style={{
                                                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                                                    cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', pointerEvents: 'auto'
                                                }}
                                            >
                                                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => validateApiKey(groqKey, true, 'Groq')}
                                        disabled={validatingKey || !groqKey}
                                        className="btn-secondary"
                                        style={{ height: '42px', minWidth: '42px' }}
                                    >
                                        {validatingKey ? <span className="spinner"></span> : <RefreshCw size={14} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="settings-section">
                                <div className="section-label">Koneksi Lokal</div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    Ollama Base URL
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input
                                        type="text"
                                        value={ollamaBaseUrl}
                                        onChange={(e) => setOllamaBaseUrl(e.target.value)}
                                        className="input-field"
                                        placeholder="http://localhost:11434"
                                        style={{ marginBottom: 0, flex: 1, borderColor: keyValid === true ? 'var(--success)' : (keyValid === false ? 'var(--error)' : 'var(--border-color)') }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => validateApiKey(null, true, 'Ollama', ollamaBaseUrl)}
                                        disabled={validatingKey}
                                        className="btn-secondary"
                                        style={{ height: '42px', minWidth: '42px' }}
                                    >
                                        {validatingKey ? <span className="spinner"></span> : <RefreshCw size={14} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="settings-section">
                        <div className="section-label">Preferensi Model</div>
                        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Model Utama ({provider})
                            <div
                                className={`connection-status ${keyValid === true ? 'connected' : (keyValid === false ? 'disconnected' : '')}`}
                                style={{ marginLeft: '12px' }}
                            >
                                {keyValid === true ? <CheckCircle size={14} /> : (keyValid === false ? <AlertCircle size={14} /> : <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1px', marginRight: 0 }}></div>)}
                                <span>{keyValid === true ? 'Terhubung' : (keyValid === false ? 'Gagal Terhubung' : 'Memeriksa...')}</span>
                            </div>
                        </label>
                        <SearchableSelect
                            options={availableModels}
                            value={provider === 'OpenRouter' ? openRouterModel : (provider === 'Groq' ? groqModel : ollamaModel)}
                            onChange={(val) => {
                                if (provider === 'OpenRouter') {
                                    setOpenRouterModel(val);
                                    saveConfiguration({ openrouter_model: val });
                                } else if (provider === 'Groq') {
                                    setGroqModel(val);
                                    saveConfiguration({ groq_model: val });
                                } else {
                                    setOllamaModel(val);
                                    saveConfiguration({ ollama_model: val });
                                }
                            }}
                            placeholder="Pilih model..."
                        />
                    </div>

                    <div style={{ marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Share2 size={18} color="var(--accent-color)" />
                            Konfigurasi Notion
                        </h4>
                        <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Notion API Key
                                </label>
                                <input
                                    type="password"
                                    value={notionApiKey}
                                    onChange={(e) => {
                                        setNotionApiKey(e.target.value);
                                        saveConfiguration({ notion_api_key: e.target.value });
                                    }}
                                    className="input-field"
                                    placeholder="secret_..."
                                    style={{ marginBottom: 0 }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Database ID
                                </label>
                                <input
                                    type="text"
                                    value={notionDatabaseId}
                                    onChange={(e) => {
                                        setNotionDatabaseId(e.target.value);
                                        saveConfiguration({ notion_database_id: e.target.value });
                                    }}
                                    className="input-field"
                                    placeholder="32 chars ID"
                                    style={{ marginBottom: 0 }}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Search size={18} color="var(--accent-color)" />
                            Search Configuration
                        </h4>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Brave Search API Key
                            </label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type={showBraveKey ? "text" : "password"}
                                        value={braveApiKey}
                                        onChange={(e) => {
                                            setBraveApiKey(e.target.value);
                                            saveConfiguration({ brave_api_key: e.target.value });
                                        }}
                                        className="input-field"
                                        placeholder="BSA..."
                                        style={{
                                            paddingRight: '3rem',
                                            marginBottom: 0,
                                            borderColor: braveKeyValid === true ? 'var(--success)' : (braveKeyValid === false ? 'var(--error)' : 'var(--border-color)')
                                        }}
                                    />
                                    <div style={{
                                        position: 'absolute', right: '0.5rem', top: '0', height: '100%',
                                        display: 'flex', alignItems: 'center', pointerEvents: 'none'
                                    }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowBraveKey(!showBraveKey)}
                                            style={{
                                                background: 'none', border: 'none', color: 'var(--text-secondary)',
                                                cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', pointerEvents: 'auto'
                                            }}
                                        >
                                            {showBraveKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!braveApiKey) return;
                                        setValidatingBraveKey(true);
                                        try {
                                            const res = await api.testSearch({ brave_api_key: braveApiKey });
                                            if (res.data.valid) {
                                                setBraveKeyValid(true);
                                                showToast('Brave API key valid!', 'success');
                                            }
                                        } catch (err) {
                                            setBraveKeyValid(false);
                                            showAlert('Invalid Key', err.response?.data?.detail || 'Brave API key tidak valid');
                                        } finally {
                                            setValidatingBraveKey(false);
                                        }
                                    }}
                                    disabled={validatingBraveKey || !braveApiKey}
                                    className="btn-secondary"
                                    style={{ height: '42px', minWidth: '42px' }}
                                    title="Test Brave API Key"
                                >
                                    {validatingBraveKey ? <span className="spinner"></span> : <RefreshCw size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex', justifyContent: 'flex-end'
                    }}>
                        {keyError && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginRight: 'auto' }}>{keyError}</p>}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                            Pengaturan disimpan secara otomatis.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
