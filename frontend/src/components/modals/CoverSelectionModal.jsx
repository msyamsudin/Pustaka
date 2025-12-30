import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Search, CheckCircle } from 'lucide-react';
import { getImageUrl } from '../../utils/helpers';
import * as api from '../../services/api';

const CoverSelectionModal = ({ isOpen, book, onClose, onSave, apiBaseUrl }) => {
    const [candidates, setCandidates] = useState([]);
    const [customUrl, setCustomUrl] = useState('');
    const [selectedUrl, setSelectedUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen && book) {
            setSearchQuery(`${book.title} ${book.author}`);
            setCandidates([]);
            setSelectedUrl(book.image_url || '');
            setCustomUrl('');

            const existing = book.summaries?.[0]?.metadata?.sources
                .filter(s => s.image_url)
                .map(s => ({ url: s.image_url, source: s.source })) || [];

            if (book.image_url && !existing.find(e => e.url === book.image_url)) {
                existing.unshift({ url: book.image_url, source: 'Current' });
            }
            setCandidates(existing);

            if (existing.length === 0) {
                handleSearch(`${book.title} ${book.author}`);
            }
        }
    }, [isOpen, book]);

    const handleSearch = async (query) => {
        if (!query) return;
        setLoading(true);
        try {
            const res = await api.searchCovers(query);
            setCandidates(prev => {
                const newOnes = res.data.filter(n => !prev.find(p => p.url === n.url));
                return [...prev, ...newOnes];
            });
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        const finalUrl = selectedUrl === 'custom' ? customUrl : selectedUrl;
        onSave(finalUrl);
    };

    if (!isOpen || !book) return null;

    return (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 1200 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '700px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0 }}>Ganti Sampul: "{book.title}"</h3>
                    <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                </div>

                <div className="input-group">
                    <label>Cari Kandidat Sampul</label>
                    <div className="mobile-stack" style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            className="input-field"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                        />
                        <button className="btn-secondary" onClick={() => handleSearch(searchQuery)} disabled={loading} style={{ minWidth: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Pilih Sampul:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
                        {candidates.map((cand, index) => (
                            <div
                                key={index}
                                className={`cover-option ${selectedUrl === cand.url ? 'selected' : ''}`}
                                onClick={() => { setSelectedUrl(cand.url); setCustomUrl(''); }}
                                style={{
                                    aspectRatio: '2/3', border: `2px solid ${selectedUrl === cand.url ? 'var(--accent-color)' : 'transparent'}`,
                                    borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)', backgroundColor: '#000'
                                }}
                            >
                                <img src={getImageUrl(cand.url, null, apiBaseUrl)} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />

                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.65rem', padding: '2px 4px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {cand.source}
                                </div>

                                {selectedUrl === cand.url && (
                                    <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--accent-color)', borderRadius: '50%', padding: '2px', display: 'flex' }}>
                                        <CheckCircle size={14} color="white" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {candidates.length === 0 && !loading && (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                Tidak ada kandidat. Coba cari manual.
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Atau URL Gambar Manual:</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="https://example.com/cover.jpg"
                        value={customUrl}
                        onChange={(e) => { setCustomUrl(e.target.value); setSelectedUrl('custom'); }}
                    />
                    {customUrl && selectedUrl === 'custom' && (
                        <div style={{ width: '80px', height: '120px', border: '2px solid var(--accent-color)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.5rem' }}>
                            <img src={customUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display = 'none'} />
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button onClick={handleSave} className="btn-primary" disabled={(!selectedUrl || (selectedUrl === 'custom' && !customUrl))}>Simpan Sampul</button>
                </div>
            </div>
        </div>
    );
};

export default CoverSelectionModal;
