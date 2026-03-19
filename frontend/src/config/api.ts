/**
 * API Configuration
 * 
 * Centralized API settings for connecting to the backend server.
 * Uses relative URLs when on same origin as backend (production mode),
 * or explicit URL in development.
 */

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }
  return '';
}

const API_BASE_URL = getApiBaseUrl();
const API_PREFIX = '/api';

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
