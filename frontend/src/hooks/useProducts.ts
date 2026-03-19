/**
 * useProducts Hook
 * 
 * React hook for product management with offline sync support.
 * Combines ProductRepository with offline sync logic.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Product } from '../types';
import { productRepository } from '../db/repositories/productRepository';
import { syncQueueService } from '../services/syncQueueService';
import { networkStatusService } from '../services/networkStatusService';
import { useOfflineSync } from './useOfflineSync';
import { OPERATION_TYPE, TABLE_NAMES } from '../config/syncConfig';

export interface UseProductsOptions {
  /** Enable automatic sync (default: true) */
  autoSync?: boolean;
}

export interface UseProductsReturn {
  // State
  products: Product[];
  loading: boolean;
  error: string | null;
  
  // Sync state
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  
  // CRUD operations
  createProduct: (product: Omit<Product, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'synced' | 'serverUpdatedAt' | 'pendingSync' | 'deleted'>) => Promise<number>;
  updateProduct: (id: number, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: number, hardDelete?: boolean) => Promise<void>;
  
  // Query methods
  getProduct: (id: number) => Promise<Product | undefined>;
  getByCategory: (category: string) => Promise<Product[]>;
  getByName: (name: string) => Promise<Product[]>;
  getCategories: () => Promise<string[]>;
  getLowStock: (threshold?: number) => Promise<Product[]>;
  
  // Refresh
  refresh: () => Promise<void>;
  
  // Manual sync
  triggerSync: () => Promise<void>;
}

/**
 * Custom sync function for products
 */
async function syncProductFunction(item: any): Promise<{
  success: boolean;
  error?: string;
  serverTime?: number;
}> {
  const { table, operation, recordId, localId, payload } = item;
  
  if (table !== TABLE_NAMES.PRODUCTS) {
    return { success: true };
  }

  try {
    const baseUrl = '/api/products';
    let url = baseUrl;
    let method = 'POST';
    let body = payload;

    switch (operation) {
      case OPERATION_TYPE.CREATE:
        // POST /api/products
        method = 'POST';
        body = { ...payload, localId };
        break;
      case OPERATION_TYPE.UPDATE:
        // PUT /api/products/:id
        url = `${baseUrl}/${recordId}`;
        method = 'PUT';
        body = payload;
        break;
      case OPERATION_TYPE.DELETE:
        // DELETE /api/products/:id
        url = `${baseUrl}/${recordId}`;
        method = 'DELETE';
        body = null;
        break;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 409) {
      // Conflict - server wins
      const conflictData = await response.json();
      
      // Update local with server data
      if (conflictData.serverData) {
        await productRepository.update(recordId, {
          ...conflictData.serverData,
          synced: true,
          serverUpdatedAt: conflictData.serverTime
        }, false);
      }
      
      return {
        success: false,
        error: 'Conflict resolved: server data applied',
        serverTime: conflictData.serverTime
      };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`
      };
    }

    const data = await response.json();
    
    // Mark product as synced
    await productRepository.markSynced(recordId, data.serverTime || Date.now());
    
    return {
      success: true,
      serverTime: data.serverTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

/**
 * Hook for product management with offline support
 */
export function useProducts(options: UseProductsOptions = {}): UseProductsReturn {
  const { autoSync = true } = options;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Use offline sync hook
  const {
    pendingCount,
    isSyncing,
    triggerSync,
    status: syncStatus
  } = useOfflineSync({
    syncFunction: syncProductFunction,
    autoSync
  });

  // Check network status
  const isOnline = networkStatusService.isOnline();

  // Load products from IndexedDB
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await productRepository.getAll();
      setProducts(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load products';
      setError(message);
      console.error('[useProducts] Error loading products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create product
  const createProduct = useCallback(async (
    productData: Omit<Product, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'synced' | 'serverUpdatedAt' | 'pendingSync' | 'deleted'>
  ): Promise<number> => {
    try {
      const id = await productRepository.create(productData, false);
      
      // Add to sync queue
      const product = await productRepository.getById(id);
      if (product) {
        await syncQueueService.enqueue(
          TABLE_NAMES.PRODUCTS,
          OPERATION_TYPE.CREATE,
          id,
          product,
          product.localId
        );
      }
      
      // Refresh local state
      await loadProducts();
      
      return id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product';
      setError(message);
      throw err;
    }
  }, [loadProducts]);

  // Update product
  const updateProduct = useCallback(async (
    id: number,
    updates: Partial<Product>
  ): Promise<void> => {
    try {
      await productRepository.update(id, updates, false);
      
      // Add UPDATE to sync queue
      const product = await productRepository.getById(id);
      if (product) {
        await syncQueueService.enqueue(
          TABLE_NAMES.PRODUCTS,
          OPERATION_TYPE.UPDATE,
          id,
          { ...product, ...updates }
        );
      }
      
      // Refresh local state
      await loadProducts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product';
      setError(message);
      throw err;
    }
  }, [loadProducts]);

  // Delete product (soft delete by default)
  const deleteProduct = useCallback(async (
    id: number,
    hardDelete = false
  ): Promise<void> => {
    try {
      const product = await productRepository.getById(id);
      
      await productRepository.delete(id, hardDelete, false);
      
      // Add DELETE to sync queue
      if (product) {
        await syncQueueService.enqueue(
          TABLE_NAMES.PRODUCTS,
          OPERATION_TYPE.DELETE,
          id,
          { id, localId: product.localId }
        );
      }
      
      // Refresh local state
      await loadProducts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product';
      setError(message);
      throw err;
    }
  }, [loadProducts]);

  // Get single product
  const getProduct = useCallback(async (id: number): Promise<Product | undefined> => {
    return productRepository.getById(id);
  }, []);

  // Get products by category
  const getByCategory = useCallback(async (category: string): Promise<Product[]> => {
    return productRepository.queryByCategory(category);
  }, []);

  // Search products by name
  const getByName = useCallback(async (name: string): Promise<Product[]> => {
    return productRepository.queryByName(name);
  }, []);

  // Get all categories
  const getCategories = useCallback(async (): Promise<string[]> => {
    return productRepository.getCategories();
  }, []);

  // Get low stock products
  const getLowStock = useCallback(async (threshold = 10): Promise<Product[]> => {
    return productRepository.getLowStock(threshold);
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    await loadProducts();
  }, [loadProducts]);

  // Manual sync trigger
  const triggerSyncManual = useCallback(async () => {
    await triggerSync();
  }, [triggerSync]);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    // State
    products,
    loading,
    error,
    
    // Sync state
    isOnline,
    pendingCount,
    isSyncing,
    
    // CRUD operations
    createProduct,
    updateProduct,
    deleteProduct,
    
    // Query methods
    getProduct,
    getByCategory,
    getByName,
    getCategories,
    getLowStock,
    
    // Actions
    refresh,
    triggerSync: triggerSyncManual
  };
}

export default useProducts;
