import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const scrapeData = async (endpoint, data) => {
    try {
        const response = await api.post(endpoint, data);
        return response.data;
    } catch (error) {
        if (error.code === 'ERR_NETWORK') {
            throw new Error('Cannot connect to backend. Make sure server is running on port 9000.');
        }
        if (error.response) {
            throw new Error(error.response.data?.message || error.response.statusText || 'Server error');
        }
        throw new Error(error.message || 'An unexpected error occurred');
    }
};

export default api;
