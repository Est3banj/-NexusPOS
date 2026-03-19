/**
 * useOfflineSync Hook
 * 
 * React hook for managing offline synchronization.
 * Monitors sync queue and triggers auto-sync when online.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SyncStatusState, SyncState, SyncQueueItem } from '../types';
import { syncQueueService } from '../services/syncQueueService';
import { networkStatusService } from '../services/networkStatusService';
import { SYNC_FREQUENCY, MAX_QUEUE_SIZE } from '../config/syncConfig';

/**
 * Sync function type for processing queue items
 */
type SyncFunction = (item: SyncQueueItem) => Promise<{
  success: boolean;
  error?: string;
  serverTime?: number;
}>;

export interface UseOfflineSyncOptions {
  /** Custom sync function to process queue items */
  syncFunction?: SyncFunction;
  /** Whether to auto-sync when online (default: true) */
  autoSync?: boolean;
  /** Sync frequency in ms (default: from config, 10s) */
  syncFrequency?: number;
  /** Callback when sync completes */
  onSyncComplete?: (result: { processed: number; successful: number; failed: number }) => void;
  /** Callback when sync error occurs */
  onSyncError?: (error: string) => void;
}

/**
 * Hook to manage offline sync state and queue processing
 * 
 * @param options - Configuration options
 * @returns Object containing:
 *   - status: 'idle' | 'syncing' | 'error' | 'warning'
 *   - pendingCount: number of pending sync items
 *   - lastSyncAt: timestamp of last sync
 *   - error: current error message if any
 *   - triggerSync: function to manually trigger sync
 *   - clearFailed: function to clear failed items
 */
export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const {
    syncFunction,
    autoSync = true,
    syncFrequency = SYNC_FREQUENCY,
    onSyncComplete,
    onSyncError
  } = options;

  const [status, setStatus] = useState<SyncStatusState>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  
  const syncTimerRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await syncQueueService.getPendingCount();
      setPendingCount(count);
      
      // Warning if queue is getting large
      if (count > MAX_QUEUE_SIZE * 0.8) {
        setStatus('warning');
      } else if (status === 'warning' && count <= MAX_QUEUE_SIZE * 0.8) {
        setStatus('idle');
      }
    } catch (err) {
      console.error('[useOfflineSync] Error updating pending count:', err);
    }
  }, [status]);

  // Process the sync queue
  const processQueue = useCallback(async () => {
    if (!syncFunction) {
      console.warn('[useOfflineSync] No sync function provided');
      return;
    }

    if (isProcessingRef.current) {
      console.log('[useOfflineSync] Sync already in progress, skipping');
      return;
    }

    if (!networkStatusService.isOnline()) {
      console.log('[useOfflineSync] Offline, skipping sync');
      return;
    }

    isProcessingRef.current = true;
    setStatus('syncing');
    setError(undefined);

    try {
      const result = await syncQueueService.processQueue(syncFunction);
      
      setLastSyncAt(Date.now());
      
      if (result.failed > 0) {
        setError(`${result.failed} items failed to sync`);
        setStatus('error');
        onSyncError?.(`${result.failed} items failed to sync`);
      } else {
        setStatus('idle');
      }

      onSyncComplete?.(result);
      
      // Update pending count after processing
      await updatePendingCount();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown sync error';
      console.error('[useOfflineSync] Sync error:', errorMessage);
      setError(errorMessage);
      setStatus('error');
      onSyncError?.(errorMessage);
    } finally {
      isProcessingRef.current = false;
    }
  }, [syncFunction, onSyncComplete, onSyncError, updatePendingCount]);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    await processQueue();
  }, [processQueue]);

  // Clear failed items
  const clearFailed = useCallback(async () => {
    const count = await syncQueueService.clearFailed();
    await updatePendingCount();
    return count;
  }, [updatePendingCount]);

  // Retry failed items
  const retryFailed = useCallback(async () => {
    const count = await syncQueueService.retryAllFailed();
    await updatePendingCount();
    await processQueue();
    return count;
  }, [updatePendingCount, processQueue]);

  // Setup auto-sync
  useEffect(() => {
    if (!autoSync) return;

    // Initial count update
    updatePendingCount();

    // Setup sync timer
    const setupTimer = () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      
      syncTimerRef.current = window.setInterval(() => {
        if (networkStatusService.isOnline()) {
          processQueue();
        }
      }, syncFrequency);
    };

    setupTimer();

    // Listen for online event to trigger sync
    const handleOnline = () => {
      console.log('[useOfflineSync] Network online, triggering sync');
      processQueue();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      window.removeEventListener('online', handleOnline);
    };
  }, [autoSync, syncFrequency, processQueue, updatePendingCount]);

  return {
    status,
    pendingCount,
    lastSyncAt,
    error,
    isSyncing: status === 'syncing',
    hasError: status === 'error',
    hasWarning: status === 'warning',
    triggerSync,
    clearFailed,
    retryFailed,
    refreshPendingCount: updatePendingCount
  };
}

/**
 * Hook to get sync statistics
 */
export function useSyncStats() {
  const [stats, setStats] = useState<{
    pending: number;
    processing: number;
    failed: number;
    total: number;
  }>({ pending: 0, processing: 0, failed: 0, total: 0 });

  const updateStats = useCallback(async () => {
    try {
      const newStats = await syncQueueService.getStats();
      setStats(newStats);
    } catch (err) {
      console.error('[useSyncStats] Error getting stats:', err);
    }
  }, []);

  useEffect(() => {
    updateStats();
    
    const interval = setInterval(updateStats, 5000);
    
    return () => clearInterval(interval);
  }, [updateStats]);

  return stats;
}

export default useOfflineSync;
