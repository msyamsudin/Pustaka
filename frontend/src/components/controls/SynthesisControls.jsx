import React from 'react';
import { Sparkles, RotateCcw, Search } from 'lucide-react';
import ToggleSwitch from '../common/ToggleSwitch';

/**
 * SynthesisControls Component
 * Controls for synthesis options (Analytical Refining, Iterative Mode, Search Enrichment)
 */
const SynthesisControls = ({
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
    summary,
    saveConfiguration
}) => {
    const handleHighQualityToggle = () => {
        const newVal = !highQuality;
        setHighQuality(newVal);
        if (newVal) setIterativeMode(false); // Mutually exclusive
    };

    const handleIterativeToggle = () => {
        const newVal = !iterativeMode;
        setIterativeMode(newVal);
        if (newVal) setHighQuality(false); // Mutually exclusive
    };

    const handleSearchToggle = () => {
        const newValue = !enableSearchEnrichment;
        setEnableSearchEnrichment(newValue);
        saveConfiguration({ enable_search_enrichment: newValue });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {/* Toggle Switches */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <ToggleSwitch
                    label="Analytical Refining Mode"
                    icon={Sparkles}
                    checked={highQuality}
                    onChange={handleHighQualityToggle}
                />

                <ToggleSwitch
                    label="Iterative Self-Correction"
                    icon={RotateCcw}
                    checked={iterativeMode}
                    onChange={handleIterativeToggle}
                />

                <ToggleSwitch
                    label="Search Enrichment"
                    icon={Search}
                    checked={enableSearchEnrichment}
                    onChange={handleSearchToggle}
                />
            </div>

            {/* Configuration Panels */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', width: '100%' }}>
                {/* Draft Depth Panel */}
                {highQuality && !summary && (
                    <div className="animate-fade-in" style={{
                        width: '100%',
                        maxWidth: '240px',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                DRAFT DEPTH: {draftCount}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={draftCount}
                            onChange={(e) => setDraftCount(parseInt(e.target.value))}
                            className="custom-range"
                            style={{
                                width: '100%',
                                marginTop: '0.5rem'
                            }}
                        />
                    </div>
                )}

                {/* Critic Model Panel */}
                {iterativeMode && !summary && (
                    <div className="animate-fade-in" style={{
                        width: '100%',
                        maxWidth: '240px',
                        background: 'rgba(255,255,255,0.02)',
                        padding: '0.75rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                                Critic Model
                            </span>
                            <div style={{
                                width: '14px', height: '14px', borderRadius: '50%', background: 'var(--bg-secondary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem',
                                color: 'var(--text-secondary)', cursor: 'help'
                            }} title="Model used to critique and refine drafts">?</div>
                        </div>
                        <select
                            className="input-field"
                            value={criticModel}
                            onChange={(e) => setCriticModel(e.target.value)}
                            style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem',
                                marginBottom: 0,
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <option value="same">Same as Generator</option>
                            {availableModels.map(m => (
                                <option key={m} value={m}>{m.split('/').pop()}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SynthesisControls;
