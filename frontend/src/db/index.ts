/**
 * Dexie.js Database Initialization
 * 
 * Creates and exports the IndexedDB database instance
 * using the schema defined in schema.ts.
 */

import Dexie, { type Table } from 'dexie';
import { dbSchema } from './schema';
import { DB_NAME, DB_VERSION } from '../config/syncConfig';
import type { Product, Sale, SyncQueueItem, User, CashSession } from '../types';

/**
 * POSDatabase - Dexie.js instance for offline-first POS
 * 
 * Provides type-safe access to IndexedDB tables:
 * - products: Product catalog
 * - sales: Sale transactions
 * - syncQueue: Pending sync operations
 * - users: User authentication (v2+)
 */
export class POSDatabase extends Dexie {
  products!: Table<Product, number>;
  sales!: Table<Sale, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  users!: Table<User, number>;
  cashSessions!: Table<CashSession, number>;

  constructor() {
    super(DB_NAME);
    
    // Define schema version
    this.version(DB_VERSION).stores(dbSchema);
  }
}

/**
 * Singleton database instance
 * 
 * Use this instance throughout the application
 * instead of creating new instances.
 */
export const db = new POSDatabase();

// ============================================================================
// Database Utility Functions
// ============================================================================

/**
 * Clear all data from the database
 * Useful for testing or logout functionality
 */
export async function clearDatabase(): Promise<void> {
  await db.products.clear();
  await db.sales.clear();
  await db.syncQueue.clear();
  await db.users.clear();
  await db.cashSessions.clear();
}

/**
 * Initialize database with default data
 */
export async function initializeDatabase(): Promise<void> {
  console.log('[DB] Database initialized');
}

/**
 * Get database info (size, record counts)
 */
export async function getDatabaseInfo(): Promise<{
  productCount: number;
  saleCount: number;
  syncQueueCount: number;
}> {
  const [productCount, saleCount, syncQueueCount] = await Promise.all([
    db.products.count(),
    db.sales.count(),
    db.syncQueue.count()
  ]);
  
  return { productCount, saleCount, syncQueueCount };
}

/**
 * Check if database has any pending sync operations
 */
export async function hasPendingSync(): Promise<boolean> {
  const count = await db.syncQueue.where('status').equals('pending').count();
  return count > 0;
}

// ============================================================================
// Export types for convenience
// ============================================================================

export type { Product, Sale, SyncQueueItem, User, CashSession } from '../types';
