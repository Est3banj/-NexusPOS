/**
 * Dexie.js Schema Definition
 * 
 * Defines the IndexedDB schema for offline-first POS.
 * Each table includes indices for efficient querying.
 */

import { TABLE_NAMES } from '../config/syncConfig';

/**
 * Store definitions for Dexie.js
 * 
 * Version 1 Schema:
 * - products: Store for product catalog
 * - sales: Store for sale transactions  
 * - syncQueue: Store for pending sync operations
 * 
 * Version 2 Schema (Auth + RBAC):
 * - users: Store for user authentication
 */
export const dbSchema = {
  // Products table
  // Primary key: ++id (auto-increment)
  // Indices:
  //   - name: for search/filtering
  //   - category: for category filtering
  //   - price: for price range queries
  //   - cost: for profit calculations
  //   - updatedAt: for sync conflict detection
  //   - synced: for filtering pending items
  //   - localId: for offline identification
  products: '++id, name, category, price, cost, updatedAt, synced, localId, deleted, barcode',
  
  // Sales table
  // Primary key: ++id (auto-increment)
  // Indices:
  //   - createdAt: for date range queries
  //   - synced: for filtering pending items
  //   - localId: for offline identification
  //   - total: for sales reports
  //   - paymentMethod: for payment filtering
  sales: '++id, createdAt, synced, localId, total, paymentMethod, deleted',
  
  // Sync Queue table
  // Primary key: ++id (auto-increment)
  // Indices:
  //   - timestamp: for FIFO processing order
  //   - status: for filtering by status (pending/processing/failed)
  //   - table: for filtering by entity type
  //   - recordId: for finding operations for specific records
  //   - nextRetryAt: for scheduling retry attempts
  syncQueue: '++id, timestamp, status, table, recordId, nextRetryAt',

  // Users table (v2 - Auth + RBAC)
  // Primary key: ++id (auto-increment)
  // Indices:
  //   - username: for login lookup (unique)
  //   - role: for role-based filtering
  users: '++id, username, role',

  // Cash Sessions table (v2 - Cash Closing)
  // Primary key: ++id (auto-increment)
  // Indices:
  //   - openedBy: for filtering by user
  //   - status: for finding open/closed sessions
  //   - openedAt: for date range queries
  cashSessions: '++id, openedBy, status, openedAt'
} as const;

/**
 * Type-safe table name union
 */
export type DbTableName = keyof typeof dbSchema;

/**
 * Dexie store configuration for version(1).stores()
 */
export type DexieStores = typeof dbSchema;
