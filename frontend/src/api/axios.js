import axios from 'axios';

// Base URL resolution:
// 1. In production, default to '/api' (leverages Vercel rewrites for unified single domain).
//    Only use VITE_API_URL if it is an external URL and not localhost.
// 2. In local development, fallback to 'http://localhost:8080/api'.
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const isProd = import.meta.env.PROD;

let API_URL = '/api';
if (isProd) {
  if (rawApiUrl && !rawApiUrl.includes('localhost') && !rawApiUrl.includes('127.0.0.1')) {
    API_URL = rawApiUrl;
  } else {
    API_URL = '/api';
  }
} else {
  API_URL = rawApiUrl || 'http://localhost:8080/api';
}

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
