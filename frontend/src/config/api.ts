/**
 * API Configuration
 * 
 * Centralized API settings for connecting to the backend server.
 * 
 * Development: localhost -> localhost:3001 (relative)
 * Production (Vercel): Vercel -> Render backend
 * Production (Render): Render serves both (relative)
 */

function getApiBaseUrl(): string {
  // Explicit override from env (for custom deployments)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Check if running in development (Vite dev server)
  // Use import.meta.env.DEV which is true only in dev
  if (import.meta.env.DEV) {
    return ''; // Use relative URLs (localhost:3001)
  }
  
  // Production: Vercel frontend -> Render backend
  return 'https://nexus-pos-m0rz.onrender.com';
}
const API_PREFIX = '/api';
const API_BASE_URL = getApiBaseUrl();

function buildUrl(path: string): string {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${API_PREFIX}${path}`;
  }
  return `${API_PREFIX}${path}`;
}

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: buildUrl('/auth/login'),
    REGISTER: buildUrl('/auth/register'),
    VALIDATE: buildUrl('/auth/validate')
  },
  PRODUCTS: {
    LIST: buildUrl('/products'),
    CREATE: buildUrl('/products'),
    UPDATE: (id: number) => buildUrl(`/products/${id}`),
    DELETE: (id: number) => buildUrl(`/products/${id}`)
  },
  SALES: {
    LIST: buildUrl('/sales'),
    CREATE: buildUrl('/sales'),
    UPDATE: (id: number) => buildUrl(`/sales/${id}`)
  },
  SYNC: {
    STATUS: buildUrl('/sync/status'),
    BATCH: buildUrl('/sync/batch')
  },
  HEALTH: buildUrl('/health')
};

export const api = {
  baseUrl: API_BASE_URL,
  prefix: API_PREFIX,
  endpoints: API_ENDPOINTS,
  isRelative: !API_BASE_URL
};

export default api;
