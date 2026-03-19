/**
 * Sync Configuration Constants
 * 
 * These values control offline behavior, synchronization timing,
 * and conflict resolution settings.
 */

// Clock skew tolerance: ±5 minutes (300000ms)
// If device clock differs from server by more than this, warn the user
export const CLOCK_SKEW_TOLERANCE = 5 * 60 * 1000; // 300000ms

// Sync frequency: How often to check for connectivity and process queue when online
export const SYNC_FREQUENCY = 10000; // 10 seconds

// Max queue size: Maximum number of pending operations before warning
export const MAX_QUEUE_SIZE = 500;

// Retry configuration
export const MAX_RETRY_COUNT = 5;
export const RETRY_DELAYS = [1000, 2000, 4000, 8000, 30000]; // Exponential backoff: 1s, 2s, 4s, 8s, max 30s

// IndexedDB database name and version
export const DB_NAME = 'POSDatabase';
export const DB_VERSION = 2;

// Cache configuration
export const CACHE_NAME = 'pos-precache-v1';
export const RUNTIME_CACHE_NAME = 'pos-runtime-v1';

// API configuration
export const API_BASE_URL = '/api';

// Sync queue statuses
export const SYNC_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  FAILED: 'failed',
  COMPLETED: 'completed'
} as const;

// Operation types for sync queue
export const OPERATION_TYPE = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE'
} as const;

// Table names
export const TABLE_NAMES = {
  PRODUCTS: 'products',
  SALES: 'sales',
  SYNC_QUEUE: 'syncQueue',
  USERS: 'users'
} as const;
