export const getImageUrl = (url, timestamp, apiBaseUrl) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('blob:')) return url;

    // Handle relative paths (with or without leading slash)
    const baseUrl = (apiBaseUrl || '').replace('/api', '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;

    // Cache busting: append timestamp if provided
    const fullUrl = `${baseUrl}${cleanUrl}`;
    return timestamp ? `${fullUrl}?t=${new Date(timestamp).getTime()}` : fullUrl;
};
