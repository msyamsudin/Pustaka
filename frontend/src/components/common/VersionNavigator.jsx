import React from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';

const VersionNavigator = ({ versions, activeIndex, onChange, summarizing, showDiff, onToggleDiff }) => {
    if (!versions || versions.length <= 1) return null;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.85rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <History size={14} />
                    <span style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                        Version History
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        onClick={() => onChange(activeIndex - 1)}
                        disabled={activeIndex <= 0 || summarizing}
                        className="icon-btn"
                        style={{ padding: '2px', opacity: activeIndex <= 0 ? 0.3 : 1 }}
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '2px 0' }} className="custom-scrollbar">
                        {versions.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => onChange(idx)}
                                disabled={summarizing}
                                style={{
                                    minWidth: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    border: '1px solid',
                                    borderColor: idx === activeIndex ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                                    background: idx === activeIndex ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                                    color: idx === activeIndex ? 'var(--accent-color)' : 'var(--text-secondary)',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    cursor: summarizing ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {idx + 1}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => onChange(activeIndex + 1)}
                        disabled={activeIndex >= versions.length - 1 || summarizing}
                        className="icon-btn"
                        style={{ padding: '2px', opacity: activeIndex >= versions.length - 1 ? 0.3 : 1 }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                {summarizing && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontStyle: 'italic' }}>
                        Next iteration in progress...
                    </span>
                )}
            </div>

            <button
                onClick={onToggleDiff}
                disabled={summarizing || activeIndex === 0}
                style={{
                    fontSize: '0.7rem',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: showDiff ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                    background: showDiff ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    color: showDiff ? 'var(--accent-color)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: '600',
                    cursor: (summarizing || activeIndex === 0) ? 'not-allowed' : 'pointer',
                    opacity: (summarizing || activeIndex === 0) ? 0.5 : 1
                }}
            >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: showDiff ? 'var(--accent-color)' : '#444' }}></div>
                Compare with Previous
            </button>
        </div>
    );
};

export default VersionNavigator;
