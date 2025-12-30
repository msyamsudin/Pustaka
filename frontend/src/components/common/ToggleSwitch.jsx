import React from 'react';

/**
 * ToggleSwitch Component
 * Reusable toggle switch with label and icon
 */
const ToggleSwitch = ({ label, icon: Icon, checked, onChange }) => {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                cursor: 'pointer'
            }}
            onClick={onChange}
        >
            <div
                className={`toggle-switch ${checked ? 'active' : ''}`}
                style={{
                    width: '36px',
                    height: '18px',
                    background: checked ? 'var(--success)' : '#333',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'all 0.3s'
                }}
            >
                <div style={{
                    width: '14px',
                    height: '14px',
                    background: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: checked ? '20px' : '2px',
                    transition: 'all 0.3s'
                }}></div>
            </div>
            <span style={{
                fontSize: '0.85rem',
                fontWeight: '500',
                color: checked ? 'var(--accent-color)' : 'var(--text-secondary)'
            }}>
                {label}
            </span>
            {Icon && (
                <Icon
                    size={14}
                    color={checked ? 'var(--accent-color)' : 'var(--text-secondary)'}
                    opacity={checked ? 1 : 0.5}
                />
            )}
        </div>
    );
};

export default ToggleSwitch;
