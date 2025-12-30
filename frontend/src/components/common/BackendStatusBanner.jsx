import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * BackendStatusBanner Component
 * Displays a warning banner when backend is not connected
 */
const BackendStatusBanner = ({ backendUp }) => {
    if (backendUp) return null;

    return (
        <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <AlertCircle size={20} style={{ marginRight: '10px' }} />
            <div>
                <strong>Backend Tidak Terdeteksi!</strong>
                <div style={{ fontSize: '0.9rem', marginTop: '4px', opacity: 0.8 }}>
                    Silakan jalankan file <code>run_app.bat</code>.
                </div>
            </div>
        </div>
    );
};

export default BackendStatusBanner;
