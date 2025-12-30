import React from 'react';
import { CheckCircle, AlertCircle, RotateCcw, BookOpen, Sparkles } from 'lucide-react';
import SynthesisControls from '../controls/SynthesisControls';

/**
 * VerificationResultCard Component
 * Displays book verification results with sources, synopsis, and synthesis controls
 */
const VerificationResultCard = ({
    verificationResult,
    summary,
    summarizing,
    highQuality,
    setHighQuality,
    iterativeMode,
    setIterativeMode,
    enableSearchEnrichment,
    setEnableSearchEnrichment,
    draftCount,
    setDraftCount,
    criticModel,
    setCriticModel,
    availableModels,
    existingSummary,
    onSummarize,
    onClearVerification,
    saveConfiguration
}) => {
    const getStatusIcon = () => {
        if (verificationResult.status === 'success') {
            return <CheckCircle size={32} color="var(--success)" style={{ marginRight: '1rem' }} />;
        } else if (verificationResult.status === 'warning') {
            return <AlertCircle size={32} color="var(--warning)" style={{ marginRight: '1rem' }} />;
        } else {
            return <AlertCircle size={32} color="var(--error)" style={{ marginRight: '1rem' }} />;
        }
    };

    const getStatusTitle = () => {
        if (verificationResult.status === 'success') return "Source Verified";
        if (verificationResult.status === 'warning') return "Partial Match";
        return "Source Refined Fail";
    };

    return (
        <div className="glass-card animate-slide-up" style={{ marginBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {getStatusIcon()}
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                            {getStatusTitle()}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{verificationResult.message}</p>
                    </div>
                </div>
                <button
                    onClick={onClearVerification}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <RotateCcw size={14} /> Cari Ulang
                </button>
            </div>

            {/* Sources List */}
            {verificationResult.sources.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
                        Sumber Ditemukan
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {verificationResult.sources.map((src, idx) => (
                            <li
                                key={idx}
                                style={{
                                    padding: '0.5rem 0',
                                    borderBottom: idx < verificationResult.sources.length - 1 ? '1px solid var(--border-color)' : 'none'
                                }}
                            >
                                <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{src.source}</span>: {src.title}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Synopsis Display */}
            {verificationResult.sources.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
                        Source Intel (Abstract)
                    </h4>
                    <p
                        className="custom-scrollbar"
                        style={{
                            fontSize: '0.9rem',
                            lineHeight: '1.5',
                            color: '#e2e8f0',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '1rem',
                            borderRadius: '6px',
                            maxHeight: '150px',
                            overflowY: 'auto',
                            fontStyle: verificationResult.sources.some(s => s.description) ? 'normal' : 'italic',
                            opacity: verificationResult.sources.some(s => s.description) ? 1 : 0.7
                        }}
                    >
                        {verificationResult.sources.find(s => s.description)?.description || "No abstract available from intelligence source."}
                    </p>
                </div>
            )}

            {/* Synthesis Controls and Button */}
            {verificationResult.is_valid && (
                <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ textAlign: 'center', alignSelf: 'center' }}>
                        {!summary && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                <SynthesisControls
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
                                    summary={summary}
                                    saveConfiguration={saveConfiguration}
                                />

                                {existingSummary ? (
                                    <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => onSummarize(false)}
                                            className="btn-success"
                                            disabled={summarizing}
                                            style={{
                                                padding: '0.8rem 1.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '1rem'
                                            }}
                                        >
                                            <BookOpen size={18} /> Baca Arsip
                                        </button>
                                        <button
                                            onClick={() => onSummarize(false, true)}
                                            className="btn-primary"
                                            disabled={summarizing}
                                            style={{
                                                padding: '0.8rem 1.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '1rem'
                                            }}
                                        >
                                            <RotateCcw size={18} /> Generate Baru
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => onSummarize(false)}
                                        className="btn-primary"
                                        disabled={summarizing}
                                        style={{
                                            padding: '1rem 2rem',
                                            fontSize: '1.1rem'
                                        }}
                                    >
                                        {summarizing ? <><span className="spinner"></span> Synthesizing...</> : <><Sparkles size={20} style={{ marginRight: '10px' }} /> Synthesize Intelligence Brief</>}
                                    </button>
                                )}

                                {highQuality && !existingSummary && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                                        * Mode ini menggunakan biaya token ~{draftCount}x lebih banyak.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VerificationResultCard;
