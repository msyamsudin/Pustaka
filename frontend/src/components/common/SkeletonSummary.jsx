import React from 'react';
import { X } from 'lucide-react';

const SkeletonSummary = ({ status, progress, onStop }) => (
    <div className="glass-card animate-slide-up" style={{ marginBottom: '2rem', border: '1px dashed var(--border-color)', position: 'relative', overflow: 'hidden' }}>
        {/* Progress Bar Background */}
        {progress > 0 && (
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '4px',
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                zIndex: 10
            }}>
                <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, var(--accent-color), #60a5fa)',
                    boxShadow: '0 0 10px var(--accent-color)',
                    transition: 'width 0.4s ease-out'
                }}></div>
            </div>
        )}

        <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: progress > 0 ? '1rem 0 0 0' : '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <div className="spinner" style={{ width: '20px', height: '20px', flexShrink: 0 }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {status || "Initializing intelligence synthesis engine..."}
                    </span>
                    {progress > 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            PHASE PROGRESS: {progress}%
                        </span>
                    )}
                </div>
            </div>
            <button
                onClick={onStop}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
            >
                <X size={14} /> Batal
            </button>
        </div>
        <div className="skeleton-block" style={{ width: '90%' }}></div>
        <div className="skeleton-block" style={{ width: '95%' }}></div>
        <div className="skeleton-block" style={{ width: '85%' }}></div>
        <div className="skeleton-block" style={{ width: '40%', marginTop: '1.5rem' }}></div>
        <div className="skeleton-block" style={{ width: '92%' }}></div>
        <div className="skeleton-block" style={{ width: '88%' }}></div>
    </div>
);

export default SkeletonSummary;
