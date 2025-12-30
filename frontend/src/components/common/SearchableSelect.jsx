import React, { useState, useEffect, useRef } from 'react';

const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setSearch(value);
        }
    }, [value, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (opt) => {
        onChange(opt);
        setSearch(opt);
        setIsOpen(false);
    };

    return (
        <div className="searchable-select-container" ref={containerRef}>
            <input
                type="text"
                className="input-field"
                value={search}
                onChange={(e) => {
                    setSearch(e.target.value);
                    if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => {
                    setIsOpen(true);
                    setSearch("");
                }}
                placeholder={placeholder}
                style={{ marginBottom: 0 }}
            />
            {isOpen && (
                <div className="searchable-select-menu custom-scrollbar animate-fade-in">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => (
                            <div
                                key={opt}
                                className={`searchable-select-item ${opt === value ? "selected" : ""}`}
                                onClick={() => handleSelect(opt)}
                            >
                                {opt}
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            Tidak ditemukan
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
