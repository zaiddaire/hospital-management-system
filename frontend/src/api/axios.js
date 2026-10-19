import axios from 'axios';

// Base URL resolution:
// 1. If VITE_API_URL is set, use it (allows pointing directly to Render/Railway or custom API URL).
// 2. In production, default to '/api' (leverages Vercel rewrites for a unified single public domain).
// 3. In local development, default to 'http://localhost:8080/api'.
const rawApiUrl = import.meta.env.VITE_API_URL;
const defaultApiUrl = import.meta.env.DEV ? 'http://localhost:8080/api' : '/api';
const API_URL = (rawApiUrl && rawApiUrl.trim().length > 0) ? rawApiUrl.trim() : defaultApiUrl;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor – attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor – handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
