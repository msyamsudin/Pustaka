import React from 'react';

const DiffView = ({ diff }) => {
    if (!diff || diff.length === 0) return null;

    return (
        <div style={{
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            background: '#0a0a0a',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #222',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
        }}>
            {diff.map((line, idx) => {
                let backgroundColor = 'transparent';
                let color = '#ccc';
                let prefix = '  ';

                if (line.type === 'added') {
                    backgroundColor = 'rgba(34, 197, 94, 0.15)';
                    color = '#4ade80';
                    prefix = '+ ';
                } else if (line.type === 'removed') {
                    backgroundColor = 'rgba(239, 68, 68, 0.15)';
                    color = '#f87171';
                    prefix = '- ';
                }

                return (
                    <div
                        key={idx}
                        style={{
                            backgroundColor,
                            color,
                            padding: '1px 4px',
                            borderLeft: line.type !== 'unchanged' ? `3px solid ${line.type === 'added' ? '#4ade80' : '#f87171'}` : 'none'
                        }}
                    >
                        <span style={{ opacity: 0.5, userSelect: 'none', marginRight: '8px' }}>{prefix}</span>
                        {line.text || ' '}
                    </div>
                );
            })}
        </div>
    );
};

export default DiffView;
