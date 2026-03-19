/**
 * Sale Repository - IndexedDB Operations
 * 
 * Provides CRUD operations for sales using Dexie.js.
 * Supports offline-first operations with sync queue integration.
 */

import { db } from '../index';
import type { Sale, SaleItem } from '../../types';
import { TABLE_NAMES } from '../../config/syncConfig';

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
 * Sale Repository
 * 
 * Handles all sale CRUD operations against IndexedDB.
 * Each operation can optionally queue for sync when online.
 */
export const saleRepository = {
  /**
   * Create a new sale
   * @param saleData - Sale data (items, totals, payment method)
   * @param queueForSync - Whether to add to sync queue (default: true)
   */
  async create(
    saleData: {
      items: SaleItem[];
      subtotal: number;
      tax: number;
      total: number;
      paymentMethod: Sale['paymentMethod'];
    },
    queueForSync = true
  ): Promise<number> {
    const now = getTimestamp();
    const localId = generateLocalId();
    
    const newSale: Sale = {
      localId,
      items: saleData.items,
      subtotal: saleData.subtotal,
      tax: saleData.tax,
      total: saleData.total,
      paymentMethod: saleData.paymentMethod,
      createdAt: now,
      updatedAt: now,
      synced: false,
      pendingSync: true,
      deleted: false
    };
    
    const id = await db.sales.add(newSale);
    
    // Update product stock for each item
    await this.updateProductStock(saleData.items);
    
    // TODO: Add to sync queue if queueForSync is true
    
    return id;
  },
  
  /**
   * Update product stock after a sale
   */
  async updateProductStock(items: SaleItem[]): Promise<void> {
    for (const item of items) {
      const product = await db.products.get(item.productId);
      if (product) {
        const newStock = Math.max(0, product.stock - item.quantity);
        await db.products.update(item.productId, { stock: newStock });
      }
    }
  },
  
  /**
   * Get all sales
   * @param includeDeleted - Whether to include soft-deleted sales (default: false)
   */
  async getAll(includeDeleted = false): Promise<Sale[]> {
    if (includeDeleted) {
      return db.sales.orderBy('createdAt').reverse().toArray();
    }
    return db.sales
      .filter(s => !s.deleted)
      .reverse()
      .sortBy('createdAt');
  },
  
  /**
   * Get a sale by ID
   */
  async getById(id: number): Promise<Sale | undefined> {
    return db.sales.get(id);
  },
  
  /**
   * Get a sale by local ID (for offline references)
   */
  async getByLocalId(localId: string): Promise<Sale | undefined> {
    return db.sales.where('localId').equals(localId).first();
  },
  
  /**
   * Update an existing sale
   * @param id - Sale ID
   * @param updates - Partial sale data to update
   * @param queueForSync - Whether to add to sync queue (default: true)
   */
  async update(id: number, updates: Partial<Omit<Sale, 'id' | 'localId' | 'createdAt'>>, queueForSync = true): Promise<number> {
    const now = getTimestamp();
    
    await db.sales.update(id, {
      ...updates,
      updatedAt: now,
      synced: false,
      pendingSync: true
    });
    
    // TODO: Add UPDATE operation to sync queue
    
    return id;
  },
  
  /**
   * Delete a sale (soft delete)
   * @param id - Sale ID
   * @param hardDelete - If true, actually delete from DB (default: false = soft delete)
   * @param queueForSync - Whether to add to sync queue (default: true)
   */
  async delete(id: number, hardDelete = false, queueForSync = true): Promise<void> {
    if (hardDelete) {
      await db.sales.delete(id);
      // TODO: Add DELETE operation to sync queue
    } else {
      const now = getTimestamp();
      await db.sales.update(id, {
        deleted: true,
        updatedAt: now,
        synced: false,
        pendingSync: true
      });
      // TODO: Add DELETE operation to sync queue
    }
  },
  
  /**
   * Query sales by date range
   */
  async queryByDateRange(startDate: number, endDate: number): Promise<Sale[]> {
    return db.sales
      .where('createdAt')
      .between(startDate, endDate)
      .and(sale => !sale.deleted)
      .toArray();
  },
  
  /**
   * Query sales by payment method
   */
  async queryByPaymentMethod(paymentMethod: Sale['paymentMethod']): Promise<Sale[]> {
    return db.sales
      .where('paymentMethod')
      .equals(paymentMethod)
      .and(sale => !sale.deleted)
      .toArray();
  },
  
  /**
   * Get today's sales
   */
  async getTodaySales(): Promise<Sale[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfDay = tomorrow.getTime();
    
    return this.queryByDateRange(startOfDay, endOfDay);
  },
  
  /**
   * Get sales pending sync
   */
  async getPendingSync(): Promise<Sale[]> {
    return db.sales
      .filter(s => !s.synced)
      .toArray();
  },
  
  /**
   * Mark sale as synced
   */
  async markSynced(id: number, serverUpdatedAt: number): Promise<void> {
    await db.sales.update(id, {
      synced: true,
      pendingSync: false,
      serverUpdatedAt
    });
  },
  
  /**
   * Get total sales amount for a date range
   */
  async getTotalSales(startDate: number, endDate: number): Promise<number> {
    const sales = await this.queryByDateRange(startDate, endDate);
    return sales.reduce((sum, sale) => sum + sale.total, 0);
  },
  
  /**
   * Get sales count for a date range
   */
  async getSalesCount(startDate: number, endDate: number): Promise<number> {
    const sales = await this.queryByDateRange(startDate, endDate);
    return sales.length;
  },
  
  /**
   * Get sales grouped by payment method
   */
  async getSalesByPaymentMethod(startDate: number, endDate: number): Promise<Record<Sale['paymentMethod'], number>> {
    const sales = await this.queryByDateRange(startDate, endDate);
    
    const result: Record<Sale['paymentMethod'], number> = {
      cash: 0,
      card: 0,
      transfer: 0
    };
    
    for (const sale of sales) {
      result[sale.paymentMethod] += sale.total;
    }
    
    return result;
  },
  
  /**
   * Bulk create sales (for initial sync from server)
   */
  async bulkCreate(sales: Sale[]): Promise<number[]> {
    return db.sales.bulkAdd(sales, { allKeys: true });
  },
  
  /**
   * Bulk update sales (for conflict resolution)
   */
  async bulkPut(sales: Sale[]): Promise<void> {
    await db.sales.bulkPut(sales);
  }
};

export default saleRepository;
