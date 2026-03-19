/**
 * Product Repository - IndexedDB Operations
 * 
 * Provides CRUD operations for products using Dexie.js.
 * Supports offline-first operations with sync queue integration.
 */

import { db } from '../index';
import type { Product } from '../../types';
import { TABLE_NAMES } from '../../config/syncConfig';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID for offline identification
 */
function generateLocalId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the current timestamp
 */
function getTimestamp(): number {
  return Date.now();
}

/**
 * Product Repository
 * 
 * Handles all product CRUD operations against IndexedDB.
 * Each operation can optionally queue for sync when online.
 */
export const productRepository = {
  /**
   * Create a new product
   * @param product - Product data (without id, localId, timestamps)
   * @param queueForSync - Whether to add to sync queue (default: true)
   */
  async create(product: Omit<Product, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'synced' | 'serverUpdatedAt' | 'pendingSync' | 'deleted'>, queueForSync = true): Promise<number> {
    const now = getTimestamp();
    const localId = generateLocalId();
    
    const newProduct: Product = {
      ...product,
      localId,
      createdAt: now,
      updatedAt: now,
      synced: false,
      pendingSync: true,
      deleted: false
    };
    
    const id = await db.products.add(newProduct);
    
    // TODO: Add to sync queue if queueForSync is true
    // This will be handled by the sync queue service
    
    return id;
  },
  
  /**
   * Get all products
   * @param includeDeleted - Whether to include soft-deleted products (default: false)
   */
  async getAll(includeDeleted = false): Promise<Product[]> {
    if (includeDeleted) {
      return db.products.toArray();
    }
    return db.products.filter(p => !p.deleted).toArray();
  },
  
  /**
   * Get a product by ID
   */
  async getById(id: number): Promise<Product | undefined> {
    return db.products.get(id);
  },
  
  /**
   * Get a product by local ID (for offline references)
   */
  async getByLocalId(localId: string): Promise<Product | undefined> {
    return db.products.where('localId').equals(localId).first();
  },
  
  /**
   * Update an existing product
   * @param id - Product ID
   * @param updates - Partial product data to update
   * @param queueForSync - Whether to add to sync queue (default: true)
   */
  async update(id: number, updates: Partial<Omit<Product, 'id' | 'localId' | 'createdAt'>>, queueForSync = true): Promise<number> {
    const now = getTimestamp();
    
    await db.products.update(id, {
      ...updates,
      updatedAt: now,
      synced: false,
      pendingSync: true
    });
    
    // TODO: Add UPDATE operation to sync queue
    
    return id;
  },
  
  /**
   * Delete a product (soft delete)
   * @param id - Product ID
   * @param hardDelete - If true, actually delete from DB (default: false = soft delete)
   * @param queueForSync - Whether to add to sync queue (default: true)
   */
  async delete(id: number, hardDelete = false, queueForSync = true): Promise<void> {
    if (hardDelete) {
      await db.products.delete(id);
      // TODO: Add DELETE operation to sync queue
    } else {
      const now = getTimestamp();
      await db.products.update(id, {
        deleted: true,
        updatedAt: now,
        synced: false,
        pendingSync: true
      });
      // TODO: Add DELETE operation to sync queue
    }
  },
  
  /**
   * Query products by category
   */
  async queryByCategory(category: string): Promise<Product[]> {
    return db.products
      .where('category')
      .equals(category)
      .and(product => !product.deleted)
      .toArray();
  },
  
  /**
   * Query products by name (case-insensitive search)
   */
  async queryByName(name: string): Promise<Product[]> {
    const lowerName = name.toLowerCase();
    return db.products
      .filter(product => 
        !product.deleted && 
        product.name.toLowerCase().includes(lowerName)
      )
      .toArray();
  },
  
  /**
   * Get a product by barcode
   */
  async getByBarcode(barcode: string): Promise<Product | undefined> {
    return db.products
      .where('barcode')
      .equals(barcode)
      .filter(product => !product.deleted)
      .first();
  },
  
  /**
   * Search products by name OR barcode
   */
  async search(query: string): Promise<Product[]> {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      return this.getAll();
    }
    return db.products
      .filter(product => {
        if (product.deleted) return false;
        const nameMatch = product.name.toLowerCase().includes(lowerQuery);
        const barcodeMatch = product.barcode?.toLowerCase().includes(lowerQuery);
        const categoryMatch = product.category.toLowerCase().includes(lowerQuery);
        return nameMatch || barcodeMatch || categoryMatch;
      })
      .toArray();
  },
  
  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    const products = await db.products.toArray();
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
  },
  
  /**
   * Get products with low stock
   * @param threshold - Stock threshold (default: 10)
   */
  async getLowStock(threshold = 10): Promise<Product[]> {
    return db.products
      .filter(product => !product.deleted && product.stock <= threshold)
      .toArray();
  },
  
  /**
   * Get products pending sync
   */
  async getPendingSync(): Promise<Product[]> {
    return db.products
      .filter(p => !p.synced)
      .toArray();
  },
  
  /**
   * Mark product as synced
   */
  async markSynced(id: number, serverUpdatedAt: number): Promise<void> {
    await db.products.update(id, {
      synced: true,
      pendingSync: false,
      serverUpdatedAt
    });
  },
  
  /**
   * Bulk create products (for initial sync from server)
   */
  async bulkCreate(products: Product[]): Promise<number[]> {
    return db.products.bulkAdd(products, { allKeys: true });
  },
  
  /**
   * Bulk update products (for conflict resolution)
   */
  async bulkPut(products: Product[]): Promise<void> {
    await db.products.bulkPut(products);
  }
};

export default productRepository;
