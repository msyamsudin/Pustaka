import React from 'react';
import { BookOpen, X, Book, Settings, PenTool, Trash2 } from 'lucide-react';
import { getImageUrl } from '../utils/helpers';

const LibrarySidebar = ({
    showLibrary,
    onClose,
    savedSummaries,
    libraryContentRef,
    onLoadBook,
    onDeleteBook,
    onEditCover,
    onEditMetadata,
    API_BASE_URL
}) => {
    if (!showLibrary) return null;

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
                    <BookOpen size={20} style={{ marginRight: '10px', color: 'var(--accent-color)' }} />
                    Archived
                </h3>
                <button
                    onClick={onClose}
                    className="btn-secondary"
                    style={{ padding: '0.25rem', minWidth: 'auto', border: 'none', background: 'none' }}
                >
                    <X size={20} />
                </button>
            </div>

            <div
                id="library-content"
                ref={libraryContentRef}
                className="custom-scrollbar"
                style={{ maxHeight: 'none', padding: '1.5rem' }}
            >
                {savedSummaries.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                        Belum ada brief tersimpan.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem' }}>
                        {savedSummaries.map((book) => (
                            <div
                                key={book.id}
                                className="glass-card"
                                style={{
                                    padding: '0',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: '1px solid var(--border-color)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                                onClick={() => onLoadBook(book)}
                            >
                                <div style={{
                                    width: '100%',
                                    height: '260px',
                                    backgroundColor: 'var(--bg-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    position: 'relative'
                                }}>
                                    {book.image_url ? (
                                        <img
                                            src={getImageUrl(book.image_url, book.last_updated, API_BASE_URL)}
                                            alt={book.title}
                                            className="sharp-image"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => e.target.style.display = 'none'}
                                        />
                                    ) : (
                                        <Book size={48} color="var(--text-secondary)" opacity={0.3} />
                                    )}

                                    <div className="card-overlay" style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, rgba(0,0,0,0.6) 100%)',
                                        opacity: 1,
                                        transition: 'opacity 0.2s',
                                    }}>
                                        <div
                                            className="cover-edit-btn"
                                            title="Ganti Cover"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditCover(book);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                background: 'rgba(0,0,0,0.6)',
                                                borderRadius: '50%',
                                                width: '32px',
                                                height: '32px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                zIndex: 10,
                                                backdropFilter: 'blur(4px)'
                                            }}
                                        >
                                            <Settings size={16} />
                                        </div>

                                        <div
                                            className="metadata-edit-btn"
                                            title="Edit Info Buku"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditMetadata(book);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                left: '8px',
                                                background: 'rgba(0,0,0,0.6)',
                                                borderRadius: '50%',
                                                width: '32px',
                                                height: '32px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                zIndex: 10,
                                                backdropFilter: 'blur(4px)'
                                            }}
                                        >
                                            <PenTool size={16} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: '0.85rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{
                                        margin: '0 0 0.35rem 0',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        minHeight: '2.5rem'
                                    }} title={book.title}>
                                        {book.title}
                                    </h4>
                                    <p style={{
                                        margin: '0 0 0.75rem 0',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.8rem',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {book.author}
                                    </p>

                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: '#64748b',
                                        marginTop: 'auto',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}>
                                            {book.summaries.length} Artifacts
                                        </span>
                                        <button
                                            onClick={(e) => onDeleteBook(book.id, e)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--error)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                fontSize: '0.75rem',
                                                opacity: 0.7
                                            }}
                                        >
                                            <Trash2 size={12} style={{ marginRight: '4px' }} /> Hapus
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LibrarySidebar;
