import React from 'react';

const MetadataEditModal = ({ isOpen, book, title, author, isbn, genre, publishedDate, setTitle, setAuthor, setIsbn, setGenre, setPublishedDate, onSave, onClose, isSaving }) => {
    if (!isOpen || !book) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-card animate-scale-up" style={{ maxWidth: '500px', width: '90%' }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit Info Buku</h2>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Judul</label>
                    <input
                        type="text"
                        className="input-field"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Penulis</label>
                    <input
                        type="text"
                        className="input-field"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                    />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ISBN</label>
                    <input
                        type="text"
                        className="input-field"
                        value={isbn}
                        onChange={(e) => setIsbn(e.target.value)}
                    />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Genre</label>
                    <input
                        type="text"
                        className="input-field"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder="Contoh: Computer Science, Fiction"
                    />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tahun Rilis</label>
                    <input
                        type="text"
                        className="input-field"
                        value={publishedDate || ""}
                        onChange={(e) => setPublishedDate(e.target.value)}
                        placeholder="Contoh: 2008"
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button className="btn-secondary" onClick={onClose} disabled={isSaving}>Batal</button>
                    <button className="btn-primary" onClick={onSave} disabled={isSaving}>
                        {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MetadataEditModal;
