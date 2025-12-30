import React from 'react';
import { Sparkles } from 'lucide-react';

const IterativeProgress = ({ stats }) => {
    if (!stats) return null;
    const steps = stats.steps || [];

    return (
        <div className="glass-card animate-slide-up" style={{ marginBottom: '2rem', border: '1px solid var(--accent-color)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ background: 'rgba(var(--accent-rgb), 0.1)', padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} /> Iterative Self-Correction
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                    Iteration {stats.iteration || 1}/3
                </span>
            </div>

            <div style={{ padding: '1.5rem' }}>
                {steps.map((step, idx) => (
                    <div key={idx} style={{ marginBottom: '1rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: idx === steps.length - 1 ? 'var(--accent-color)' : 'var(--text-secondary)' }}></div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '4px' }}>
                            {step.type === 'draft' && `Draft ${step.iteration}`}
                            {step.type === 'critic' && `Critic Analysis (Score: ${step.score})`}
                            {step.type === 'refine' && `Refining Draft...`}
                        </div>

                        {step.type === 'critic' && step.issues && step.issues.length > 0 && (
                            <div style={{ background: 'rgba(255,0,0,0.1)', padding: '0.5rem', borderRadius: '4px', marginTop: '4px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 'bold' }}>Issues Identified:</div>
                                <ul style={{ margin: '4px 0 0 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {step.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}

                {stats.status && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                        {stats.status}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IterativeProgress;
