import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9002';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Scraping can take a while — 3 min timeout matches the server-side limit
  timeout: 3 * 60 * 1000,
});

// ─── Normalise errors into readable messages ──────────────────────────────────
const normaliseError = (error) => {
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
    throw new Error('Request timed out — the scrape is taking too long. Try fewer results.');
  }
  if (error.code === 'ERR_NETWORK') {
    throw new Error('Cannot connect to backend. Make sure the server is running on port 9000.');
  }
  if (error.response?.status === 429) {
    throw new Error('Rate limit reached — please wait a moment before searching again.');
  }
  if (error.response) {
    throw new Error(
      error.response.data?.message || error.response.statusText || 'Server error'
    );
  }
  throw new Error(error.message || 'An unexpected error occurred');
};

// ─── Generic scraper call ─────────────────────────────────────────────────────
export const scrapeData = async (endpoint, data) => {
  try {
    const response = await api.post(endpoint, data);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

// ─── Radius search ────────────────────────────────────────────────────────────
export const searchByRadius = async (data) => {
  try {
    const response = await api.post('/search-radius', data);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

// ─── IDBF.in ─────────────────────────────────────────────────────────────────
export const fetchIdbfStates = async () => {
  try {
    const response = await api.get('/idbf-states');
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const fetchIdbfCategories = async (city) => {
  try {
    const response = await api.get('/idbf-categories', { params: { city } });
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const searchIdbf = async (data) => {
  try {
    const response = await api.post('/search-idbf', data);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

// ─── JSON to CSV Converter ────────────────────────────────────────────────────
export const fetchServerJsonFiles = async () => {
  try {
    const response = await api.get('/json-to-csv/server-files');
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const parseJsonForCsv = async (data) => {
  try {
    const response = await api.post('/json-to-csv/parse', data);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const convertJsonToCsv = async (data) => {
  try {
    const response = await api.post('/json-to-csv/convert', data, { responseType: 'blob' });
    return response;
  } catch (error) {
    normaliseError(error);
  }
};

// ─── Advanced Google Scraper API Calls ────────────────────────────────────────
export const createAdvancedGoogleJob = async (data) => {
  try {
    const response = await api.post('/advanced-google/jobs', data);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const fetchAdvancedGoogleJobs = async () => {
  try {
    const response = await api.get('/advanced-google/jobs');
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const fetchAdvancedGoogleJobStatus = async (jobId) => {
  try {
    const response = await api.get(`/advanced-google/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const fetchAdvancedGoogleJobResults = async (jobId) => {
  try {
    const response = await api.get(`/advanced-google/jobs/${jobId}/results`);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export const deleteAdvancedGoogleJob = async (jobId) => {
  try {
    const response = await api.delete(`/advanced-google/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    normaliseError(error);
  }
};

export default api;
