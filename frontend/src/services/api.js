import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const checkBackendStatus = () => api.get('/status');

export const loadConfig = () => api.get('/config');

export const saveConfig = (config) => api.post('/config', config);

export const searchCovers = (query) => api.get('/covers/search', { params: { query } });

export const verifyISBN = (isbn) => api.post('/verify', { isbn });

export const verifyBook = (data) => api.post('/verify', data);

export const saveSummary = (data) => api.post('/save', data);

export const loadSavedSummaries = () => api.get('/saved');

export const deleteSavedSummary = (id) => api.delete(`/saved/${id}`);

export const deleteBook = (id) => api.delete(`/books/${id}`);

export const updateCover = (id, imageUrl) => api.put(`/books/${id}/cover`, { image_url: imageUrl });

export const updateMetadata = (id, metadata) => api.put(`/books/${id}/metadata`, metadata);

export const shareToNotion = (data) => api.post('/share/notion', data);

export const elaborate = (data) => api.post('/elaborate', data);

export const testSearch = (data) => api.post('/search/test', data);

export const validateApiKey = (provider, key, baseUrl, model) =>
    api.post('/models', { provider, api_key: key, base_url: baseUrl, model });

export const fetchModels = (provider, key, baseUrl) =>
    api.post('/models', { provider, api_key: key, base_url: baseUrl });

export const createNote = (summaryId, noteData) =>
    api.post(`/saved/${summaryId}/notes`, noteData);

export const updateNote = (summaryId, noteId, noteData) =>
    api.put(`/saved/${summaryId}/notes/${noteId}`, noteData);

export const deleteNote = (summaryId, noteId) =>
    api.delete(`/saved/${summaryId}/notes/${noteId}`);

// Streaming endpoints - returning raw fetch response for stream readers
export const streamSummarize = (data, signal) =>
    fetch(`${API_BASE_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal
    });

export const streamSynthesize = (data, signal) =>
    fetch(`${API_BASE_URL}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal
    });

export default api;
