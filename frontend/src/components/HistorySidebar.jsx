import React from 'react';
import { History, X, Trash2 } from 'lucide-react';

const HistorySidebar = ({
    showHistory,
    onClose,
    history,
    onLoadHistory,
    onDeleteHistoryItem,
    onClearHistory
}) => {
    if (!showHistory) return null;

    return (
        <div className="glass-card animate-fade-in" style={{
            marginBottom: '2rem',
            border: '1px solid var(--border-color)',
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '1.25rem' }}>
                    <History size={20} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
                    Research History
                </h3>
                <button
                    onClick={onClose}
                    className="btn-secondary"
                    style={{ padding: '0.25rem', minWidth: 'auto', border: 'none', background: 'none' }}
                >
                    <X size={20} />
                </button>
            </div>

            <div className="custom-scrollbar" style={{ maxHeight: 'none', padding: '1.5rem' }}>
                {history.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                        Belum ada riwayat pencarian.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {history.map((item, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '8px',
                                padding: '1rem',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'start'
                            }}>
                                <div onClick={() => onLoadHistory(item)} style={{ cursor: 'pointer', flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                        {item.title || item.isbn}
                                    </div>
                                    {item.author && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.author}</div>}
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                                        {new Date(item.timestamp).toLocaleString()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => onDeleteHistoryItem(idx)}
                                    style={{ background: 'none', border: 'none', color: 'var(--error)', opacity: 0.6, cursor: 'pointer', padding: '0.25rem' }}
                                    title="Hapus item"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {history.length > 0 && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', textAlign: 'right' }}>
                    <button
                        onClick={onClearHistory}
                        className="btn-danger"
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.9rem'
                        }}
                    >
                        Clear Research Log
                    </button>
                </div>
            )}
        </div>
    );
};

export default HistorySidebar;
