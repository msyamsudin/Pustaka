import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCw, Grid3X3 } from 'lucide-react';

const IterativeProgress = ({ stats }) => {
    if (!stats) return null;
    const { steps = [], iteration = 1, isComplete = false } = stats;

    const scores = useMemo(() => {
        return steps
            .filter(s => s.type === 'critic' && s.score !== undefined)
            .map(s => s.score);
    }, [steps]);

    const chartWidth = 300;
    const chartHeight = 80;
    const maxSlots = 3;

    const points = useMemo(() => {
        if (scores.length === 0) return [];
        return scores.map((score, idx) => {
            const stepWidth = chartWidth / (maxSlots - 0.5);
            const x = idx * stepWidth + 20;
            const y = chartHeight - (score / 100) * chartHeight;
            return { x, y, score, id: idx };
        });
    }, [scores]);

    const steppedPath = useMemo(() => {
        if (points.length < 2) return "";
        return points.reduce((acc, p, i, a) => {
            if (i === 0) return `M ${p.x},${p.y}`;
            const pp = a[i - 1];
            return `${acc} L ${p.x},${pp.y} L ${p.x},${p.y}`;
        }, "");
    }, [points]);

    const areaPath = useMemo(() => {
        if (points.length < 2) return "";
        const last = points[points.length - 1];
        const first = points[0];
        return `${steppedPath} L ${last.x},${chartHeight} L ${first.x},${chartHeight} Z`;
    }, [steppedPath, points]);

    const currentPhase = useMemo(() => {
        if (isComplete) return 'complete';
        const lastStep = steps[steps.length - 1];
        if (!lastStep) return 'draft';
        if (lastStep.type === 'draft') return 'analyze';
        if (lastStep.type === 'critic') return 'refine';
        if (lastStep.type === 'refine') return 'draft';
        return 'draft';
    }, [steps, isComplete]);

    const currentScore = scores.length > 0 ? scores[scores.length - 1] : 0;
    const isEarlySuccess = isComplete && iteration < 3;

    const DotMatrix = ({ phase }) => {
        const rows = 7; // Expanded to 7x7
        const cols = 7;
        const dots = Array.from({ length: rows * cols });

        return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px', width: '90px' }}>
                {dots.map((_, i) => {
                    const r = Math.floor(i / cols);
                    const c = i % cols;

                    let animate = {};
                    if (isComplete) {
                        animate = { backgroundColor: '#4bffc3ff', boxShadow: '0 0 8px #4bffc3ff', opacity: 1 };
                    } else if (phase === 'draft') {
                        animate = { backgroundColor: ['#222', '#fff', '#222'], opacity: [0.2, 1, 0.2] };
                    } else if (phase === 'analyze') {
                        animate = { backgroundColor: ['#fff', '#222', '#fff'], opacity: [0.1, 1, 0.1] };
                    } else {
                        animate = { scale: [0.7, 1.3, 0.7], backgroundColor: ['#111', '#fff', '#111'] };
                    }

                    return (
                        <motion.div key={i} animate={animate}
                            transition={{
                                duration: isComplete ? 0.5 : (phase === 'analyze' ? Math.random() + 0.5 : 1.5),
                                repeat: isComplete ? 0 : Infinity,
                                delay: isComplete ? 0 : (r * 0.1 + c * 0.1)
                            }}
                            style={{ width: '8px', height: '8px', borderRadius: '1.5px', backgroundColor: '#111' }}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="glass-card" style={{
            marginBottom: '1rem', border: isEarlySuccess ? '1px solid #4bffc3ff' : '1px solid #333',
            position: 'relative', overflow: 'hidden', background: '#050505',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)', color: '#eee', borderRadius: '12px'
        }}>
            <div style={{
                padding: '0.75rem 1.25rem', borderBottom: '1px dashed #333',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)'
            }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px' }}>
                    <Grid3X3 size={14} style={{ color: isComplete ? '#4bffc3ff' : 'var(--accent-color)' }} />
                    <span>Self Correction Mode</span>
                </h3>
                <div style={{
                    fontSize: '0.7rem', fontWeight: 'bold', fontFamily: 'monospace',
                    background: '#111', padding: '3px 10px', borderRadius: '4px', border: '1px solid #222',
                    color: isComplete ? '#4bffc3ff' : '#666'
                }}>
                    {isComplete ? "DONE" : `Cycle ${iteration}/3`}
                </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <DotMatrix phase={currentPhase} />
                    <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: isComplete ? '#4bffc3ff' : '#444', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'monospace' }}>
                        {isComplete ? "::Complete" : `::${currentPhase}`}
                    </div>
                </div>

                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0px' }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.3)', borderRadius: '4px', border: '1px solid #111', padding: '1rem', position: 'relative', minHeight: '110px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center'
                    }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)', pointerEvents: 'none' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'baseline', position: 'relative' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>QUALITY_INDEX</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: isComplete ? '#4bffc3ff' : '#fff', fontFamily: 'monospace', lineHeight: 1 }}>{currentScore}</span>
                                <span style={{ fontSize: '0.8rem', color: '#333' }}>%</span>
                            </div>
                        </div>

                        <div style={{ height: '55px', width: '100%', position: 'relative' }}>
                            <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                                <defs>
                                    <pattern id="dotPatternLarge" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                                        <circle cx="2" cy="2" r="0.8" fill="#1a1a1a" />
                                    </pattern>
                                    <linearGradient id="chartGradientMatrix" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={isComplete ? '#4bffc3ff' : '#fff'} stopOpacity="0.15" />
                                        <stop offset="100%" stopColor={isComplete ? '#4bffc3ff' : '#fff'} stopOpacity="0" />
                                    </linearGradient>
                                </defs>

                                <rect width="100%" height="100%" fill="url(#dotPatternLarge)" />
                                <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#222" strokeWidth="1" />

                                {areaPath && <motion.path d={areaPath} fill="url(#chartGradientMatrix)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
                                {steppedPath && (
                                    <motion.path
                                        d={steppedPath} fill="none" stroke={isComplete ? "#4bffc3ff" : "#fff"}
                                        strokeWidth="2.5" strokeLinecap="square" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                                    />
                                )}

                                {points.map((p, i) => (
                                    <motion.rect
                                        key={i} x={p.x - 2.5} y={p.y - 2.5} width="5" height="5" fill="#fff"
                                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.2 }}
                                        style={{ filter: isComplete ? 'none' : 'drop-shadow(0 0 5px rgba(255,255,255,0.3))' }}
                                    />
                                ))}
                            </svg>

                            {points.map((p, i) => {
                                const leftPercent = (p.x / chartWidth) * 100;
                                const topPercent = (p.y / chartHeight) * 100;
                                return (
                                    <motion.div
                                        key={`label-${i}`}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.2 }}
                                        style={{
                                            position: 'absolute',
                                            left: `${leftPercent}%`,
                                            top: `${topPercent}%`,
                                            transform: 'translate(-50%, -240%)',
                                            background: (i === points.length - 1 && isComplete) ? '#4bffc3ff' : '#fff',
                                            color: '#000',
                                            padding: '1px 3px',
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            fontFamily: 'monospace',
                                            pointerEvents: 'none',
                                            zIndex: 10,
                                            boxShadow: '2px 2px 0px rgba(0,0,0,0.5)'
                                        }}
                                    >
                                        {p.score}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IterativeProgress;
