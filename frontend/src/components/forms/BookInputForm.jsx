import React from 'react';
import { Search, RotateCcw } from 'lucide-react';

/**
 * BookInputForm Component
 * Form for entering book information (ISBN, Title, Author)
 */
const BookInputForm = ({
    isbn,
    setIsbn,
    title,
    setTitle,
    author,
    setAuthor,
    showIsbn,
    setShowIsbn,
    loading,
    onSubmit,
    onReset
}) => {
    return (
        <div className="glass-card animate-slide-up" style={{ marginBottom: '2rem' }}>
            <form onSubmit={onSubmit}>
                <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: showIsbn ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
                    {showIsbn && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ISBN</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Contoh: 978-0132350884"
                                value={isbn}
                                onChange={(e) => setIsbn(e.target.value)}
                            />
                        </div>
                    )}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Source Title</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Contoh: Clean Code"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Primary Author / Entity</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Contoh: Robert C. Martin"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                    />
                </div>
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={() => setShowIsbn(!showIsbn)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-color)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {showIsbn ? "Sembunyikan ISBN" : "Tampilkan Opsi ISBN"}
                    </button>
                </div>
                <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {loading ? <><span className="spinner"></span> Validating Source...</> : <><Search size={18} style={{ marginRight: '8px' }} /> Analyze Book Source</>}
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem' }}
                        title="Reset Sesi"
                    >
                        <RotateCcw size={18} />
                        <span style={{ marginLeft: '8px' }}>Reset Environment</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BookInputForm;
