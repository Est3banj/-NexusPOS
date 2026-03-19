/**
 * useSales Hook
 * 
 * React hook for sales management with offline sync support.
 * Combines SaleRepository with offline sync logic.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Sale } from '../types';
import { saleRepository } from '../db/repositories/saleRepository';
import { cashSessionRepository } from '../db/repositories/cashSessionRepository';
import { syncQueueService } from '../services/syncQueueService';
import { networkStatusService } from '../services/networkStatusService';
import { useOfflineSync } from './useOfflineSync';
import { OPERATION_TYPE, TABLE_NAMES } from '../config/syncConfig';

export interface UseSalesOptions {
  /** Enable automatic sync (default: true) */
  autoSync?: boolean;
}

export interface UseSalesReturn {
  // State
  sales: Sale[];
  loading: boolean;
  error: string | null;
  
  // Sync state
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  
  // CRUD operations
  createSale: (sale: Omit<Sale, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'synced' | 'serverUpdatedAt' | 'pendingSync' | 'deleted'>) => Promise<number>;
  updateSale: (id: number, updates: Partial<Sale>) => Promise<void>;
  deleteSale: (id: number, hardDelete?: boolean) => Promise<void>;
  
  // Query methods
  getSale: (id: number) => Promise<Sale | undefined>;
  getByDateRange: (startDate: number, endDate: number) => Promise<Sale[]>;
  
  // Refresh
  refresh: () => Promise<void>;
  
  // Manual sync
  triggerSync: () => Promise<void>;
}

/**
 * Custom sync function for sales
 */
async function syncSaleFunction(item: any): Promise<{
  success: boolean;
  error?: string;
  serverTime?: number;
}> {
  const { table, operation, recordId, localId, payload } = item;
  
  if (table !== TABLE_NAMES.SALES) {
    return { success: true };
  }

  try {
    const baseUrl = '/api/sales';
    let url = baseUrl;
    let method = 'POST';
    let body = payload;

    switch (operation) {
      case OPERATION_TYPE.CREATE:
        // POST /api/sales
        method = 'POST';
        body = { ...payload, localId };
        break;
      case OPERATION_TYPE.UPDATE:
        // PUT /api/sales/:id
        url = `${baseUrl}/${recordId}`;
        method = 'PUT';
        body = payload;
        break;
      case OPERATION_TYPE.DELETE:
        // DELETE /api/sales/:id
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
        await saleRepository.update(recordId, {
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
    
    // Mark sale as synced
    await saleRepository.markSynced(recordId, data.serverTime || Date.now());
    
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
 * Hook for sales management with offline support
 */
export function useSales(options: UseSalesOptions = {}): UseSalesReturn {
  const { autoSync = true } = options;

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Use offline sync hook
  const {
    pendingCount,
    isSyncing,
    triggerSync,
    status: syncStatus
  } = useOfflineSync({
    syncFunction: syncSaleFunction,
    autoSync
  });

  // Check network status
  const isOnline = networkStatusService.isOnline();

  // Load sales from IndexedDB
  const loadSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await saleRepository.getAll();
      setSales(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load sales';
      setError(message);
      console.error('[useSales] Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create sale
  const createSale = useCallback(async (
    saleData: Omit<Sale, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'synced' | 'serverUpdatedAt' | 'pendingSync' | 'deleted' | 'sessionId'>
  ): Promise<number> => {
    try {
      const id = await saleRepository.create(saleData, false);
      
      // Add to sync queue
      const sale = await saleRepository.getById(id);
      if (sale) {
        await syncQueueService.enqueue(
          TABLE_NAMES.SALES,
          OPERATION_TYPE.CREATE,
          id,
          sale,
          sale.localId
        );
        
        // Link to open cash session if payment is cash and session is open
        if (saleData.paymentMethod === 'cash') {
          const openSession = await cashSessionRepository.getOpenSession();
          if (openSession?.id) {
            // Update session totals
            await cashSessionRepository.addSaleToSession(openSession.id, 'cash', saleData.total);
            // Link sale to session
            await saleRepository.update(id, { sessionId: openSession.id }, false);
          }
        } else {
          // Also track non-cash sales in session if open (for reporting)
          const openSession = await cashSessionRepository.getOpenSession();
          if (openSession?.id) {
            await cashSessionRepository.addSaleToSession(openSession.id, saleData.paymentMethod, saleData.total);
            await saleRepository.update(id, { sessionId: openSession.id }, false);
          }
        }
      }
      
      // Refresh local state
      await loadSales();
      
      return id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create sale';
      setError(message);
      throw err;
    }
  }, [loadSales]);

  // Update sale
  const updateSale = useCallback(async (
    id: number,
    updates: Partial<Sale>
  ): Promise<void> => {
    try {
      await saleRepository.update(id, updates, false);
      
      // Add UPDATE to sync queue
      const sale = await saleRepository.getById(id);
      if (sale) {
        await syncQueueService.enqueue(
          TABLE_NAMES.SALES,
          OPERATION_TYPE.UPDATE,
          id,
          { ...sale, ...updates }
        );
      }
      
      // Refresh local state
      await loadSales();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update sale';
      setError(message);
      throw err;
    }
  }, [loadSales]);

  // Delete sale (soft delete by default)
  const deleteSale = useCallback(async (
    id: number,
    hardDelete = false
  ): Promise<void> => {
    try {
      const sale = await saleRepository.getById(id);
      
      await saleRepository.delete(id, hardDelete, false);
      
      // Add DELETE to sync queue
      if (sale) {
        await syncQueueService.enqueue(
          TABLE_NAMES.SALES,
          OPERATION_TYPE.DELETE,
          id,
          { id, localId: sale.localId }
        );
      }
      
      // Refresh local state
      await loadSales();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete sale';
      setError(message);
      throw err;
    }
  }, [loadSales]);

  // Get single sale
  const getSale = useCallback(async (id: number): Promise<Sale | undefined> => {
    return saleRepository.getById(id);
  }, []);

  // Get sales by date range
  const getByDateRange = useCallback(async (
    startDate: number,
    endDate: number
  ): Promise<Sale[]> => {
    return saleRepository.queryByDateRange(startDate, endDate);
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    await loadSales();
  }, [loadSales]);

  // Manual sync trigger
  const triggerSyncManual = useCallback(async () => {
    await triggerSync();
  }, [triggerSync]);

  // Load sales on mount
  useEffect(() => {
    loadSales();
  }, [loadSales]);

  return {
    // State
    sales,
    loading,
    error,
    
    // Sync state
    isOnline,
    pendingCount,
    isSyncing,
    
    // CRUD operations
    createSale,
    updateSale,
    deleteSale,
    
    // Query methods
    getSale,
    getByDateRange,
    
    // Actions
    refresh,
    triggerSync: triggerSyncManual
  };
}

export default useSales;
