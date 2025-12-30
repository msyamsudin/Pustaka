import React from 'react';

const SimpleModal = ({ isOpen, title, message, onClose, onConfirm, confirmText = "OK", cancelText = "Batal", isDanger = false, showCancel = true }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', textAlign: 'center' }}>
                <h3 style={{ marginTop: 0, fontSize: '1.25rem' }}>{title}</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{message}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    {showCancel && (
                        <button onClick={onClose} className="btn-secondary" style={{ minWidth: '80px' }}>
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}
                        className={isDanger ? "btn-danger" : "btn-primary"}
                        style={{ minWidth: '80px', color: isDanger ? 'white' : '' }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SimpleModal;
