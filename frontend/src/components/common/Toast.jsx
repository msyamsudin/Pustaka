import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="animate-fade-in" style={{
            position: 'fixed', bottom: '24px', right: '24px',
            backgroundColor: type === 'error' ? 'var(--error)' : 'var(--success)',
            color: 'white', padding: '1rem 1.5rem', borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 2000,
            display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '500'
        }}>
            {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {message}
        </div>
    );
};

export default Toast;
