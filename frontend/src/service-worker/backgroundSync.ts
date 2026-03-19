/**
 * Background Sync Handler
 * 
 * Handles synchronization of offline operations when connectivity
 * is restored. Uses a FIFO queue with exponential backoff retry.
 */

import { db } from '../db';
import {
  SYNC_FREQUENCY,
  MAX_QUEUE_SIZE,
  MAX_RETRY_COUNT,
  RETRY_DELAYS,
  CLOCK_SKEW_TOLERANCE,
  API_BASE_URL,
  SYNC_STATUS,
  OPERATION_TYPE
} from '../config/syncConfig';
import type { SyncQueueItem, Product, Sale } from '../types';

// ============================================================================
// Sync State Management
// ============================================================================

interface SyncState {
  isSyncing: boolean;
  lastSyncAt?: number;
  pendingCount: number;
  error?: string;
}

let syncState: SyncState = {
  isSyncing: false,
  pendingCount: 0
};

let syncIntervalId: number | null = null;

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Process the sync queue - sends pending operations to server
 * Uses FIFO order and exponential backoff for retries
 */
export async function processSyncQueue(): Promise<SyncResult> {
  if (syncState.isSyncing) {
    console.log('[BackgroundSync] Sync already in progress, skipping...');
    return { success: false, reason: 'already_syncing' };
  }

  syncState.isSyncing = true;
  const result: SyncResult = {
    success: true,
    processed: 0,
    succeeded: 0,
    failed: 0,
    conflicts: 0
  };

  try {
    // Get all pending items ordered by timestamp (FIFO)
    const pendingItems = await db.syncQueue
      .where('status')
      .equals(SYNC_STATUS.PENDING)
      .or('status')
      .equals(SYNC_STATUS.FAILED)
      .filter(item => item.retryCount < MAX_RETRY_COUNT)
      .sortBy('timestamp');

    console.log(`[BackgroundSync] Processing ${pendingItems.length} items...`);

    for (const item of pendingItems) {
      // Mark as processing
      await db.syncQueue.update(item.id!, { 
        status: SYNC_STATUS.PROCESSING 
      });

      const syncResult = await syncItem(item);
      
      if (syncResult.success) {
        // Remove from queue on success
        await db.syncQueue.delete(item.id!);
        result.succeeded++;
        
        // Update local record with server data if present
        if (syncResult.serverData && item.table) {
          await updateLocalRecord(item.table, item.recordId, syncResult.serverData);
        }
      } else if (syncResult.conflict) {
        // Handle conflict (409) - Last Write Wins
        result.conflicts++;
        await handleConflict(item, syncResult.serverData);
      } else {
        // Retry with exponential backoff
        result.failed++;
        await handleRetry(item, syncResult.error);
      }
      
      result.processed++;
    }

    syncState.lastSyncAt = Date.now();
    
  } catch (error) {
    console.error('[BackgroundSync] Error processing queue:', error);
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    syncState.isSyncing = false;
    syncState.pendingCount = await db.syncQueue.count();
  }

  return result;
}

/**
 * Sync a single queue item to the server
 */
async function syncItem(item: SyncQueueItem): Promise<SyncItemResult> {
  const endpoint = `${API_BASE_URL}/${item.table}`;
  
  let method: string;
  let url: string;
  
  switch (item.operation) {
    case OPERATION_TYPE.CREATE:
      method = 'POST';
      url = endpoint;
      break;
    case OPERATION_TYPE.UPDATE:
      method = 'PUT';
      url = `${endpoint}/${item.recordId}`;
      break;
    case OPERATION_TYPE.DELETE:
      method = 'DELETE';
      url = `${endpoint}/${item.recordId}`;
      break;
    default:
      return { success: false, error: 'Unknown operation' };
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: item.operation !== OPERATION_TYPE.DELETE 
        ? JSON.stringify(item.payload) 
        : undefined
    });

    // Handle conflict (409)
    if (response.status === 409) {
      const serverData = await response.json();
      return { 
        success: false, 
        conflict: true, 
        serverData: serverData.serverData 
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}` 
      };
    }

    const responseData = await response.json();
    
    return {
      success: true,
      serverData: responseData,
      serverTime: responseData.serverTime
    };

  } catch (error) {
    // Network error - will retry
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Handle retry with exponential backoff
 */
async function handleRetry(item: SyncQueueItem, error?: string): Promise<void> {
  const retryCount = item.retryCount + 1;
  const delay = RETRY_DELAYS[Math.min(retryCount - 1, RETRY_DELAYS.length - 1)];
  
  if (retryCount >= MAX_RETRY_COUNT) {
    // Max retries exceeded - mark as permanently failed
    await db.syncQueue.update(item.id!, {
      status: SYNC_STATUS.FAILED,
      retryCount,
      lastError: error || 'Max retries exceeded'
    });
    
    console.error(`[BackgroundSync] Item ${item.id} permanently failed after ${MAX_RETRY_COUNT} retries`);
  } else {
    // Schedule retry
    const nextRetryAt = Date.now() + delay;
    
    await db.syncQueue.update(item.id!, {
      status: SYNC_STATUS.PENDING,
      retryCount,
      lastError: error,
      nextRetryAt
    });
    
    console.log(`[BackgroundSync] Item ${item.id} scheduled for retry ${retryCount + 1} in ${delay}ms`);
  }
}

// ============================================================================
// Conflict Resolution (Last Write Wins)
// ============================================================================

/**
 * Handle sync conflict using Last Write Wins strategy
 */
async function handleConflict(item: SyncQueueItem, serverData?: any): Promise<void> {
  if (!serverData) {
    // No server data - just remove from queue
    await db.syncQueue.delete(item.id!);
    return;
  }

  // Update local record with server data (server wins)
  await updateLocalRecord(item.table, item.recordId, serverData);
  
  // Remove from sync queue (conflict resolved)
  await db.syncQueue.delete(item.id!);
  
  console.log(`[BackgroundSync] Conflict resolved: ${item.table}:${item.recordId} updated with server data`);
}

/**
 * Update local IndexedDB record with server data
 */
async function updateLocalRecord(
  table: 'products' | 'sales', 
  recordId: number, 
  serverData: any
): Promise<void> {
  const update = {
    ...serverData,
    synced: true,
    pendingSync: false,
    serverUpdatedAt: serverData.updatedAt
  };
  
  if (table === 'products') {
    await db.products.update(recordId, update as Product);
  } else if (table === 'sales') {
    await db.sales.update(recordId, update as Sale);
  }
}

// ============================================================================
// Clock Skew Detection
// ============================================================================

/**
 * Check for clock skew between client and server
 */
export async function checkClockSkew(serverTime: number): Promise<boolean> {
  const clientTime = Date.now();
  const skew = Math.abs(clientTime - serverTime);
  
  if (skew > CLOCK_SKEW_TOLERANCE) {
    console.warn(`[BackgroundSync] Clock skew detected: ${skew}ms (tolerance: ${CLOCK_SKEW_TOLERANCE}ms)`);
    return true;
  }
  
  return false;
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Add an item to the sync queue
 */
export async function addToSyncQueue(
  table: 'products' | 'sales',
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  recordId: number,
  payload: object,
  localId?: string
): Promise<number> {
  // Check queue size
  const queueSize = await db.syncQueue.count();
  
  if (queueSize >= MAX_QUEUE_SIZE) {
    throw new Error(`Sync queue full (max ${MAX_QUEUE_SIZE} items)`);
  }
  
  const item: SyncQueueItem = {
    table,
    operation,
    recordId,
    localId,
    payload,
    timestamp: Date.now(),
    status: SYNC_STATUS.PENDING,
    retryCount: 0
  };
  
  const id = await db.syncQueue.add(item);
  syncState.pendingCount = queueSize + 1;
  
  return id;
}

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  return { ...syncState };
}

// ============================================================================
// Sync Lifecycle
// ============================================================================

/**
 * Start automatic sync when online
 */
export function startAutoSync(): void {
  if (syncIntervalId !== null) {
    console.log('[BackgroundSync] Auto-sync already running');
    return;
  }
  
  // Initial sync
  processSyncQueue();
  
  // Set up interval
  syncIntervalId = window.setInterval(() => {
    if (navigator.onLine) {
      processSyncQueue();
    }
  }, SYNC_FREQUENCY);
  
  console.log(`[BackgroundSync] Auto-sync started (interval: ${SYNC_FREQUENCY}ms)`);
}

/**
 * Stop automatic sync
 */
export function stopAutoSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[BackgroundSync] Auto-sync stopped');
  }
}

// ============================================================================
// Types
// ============================================================================

interface SyncResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  reason?: string;
  error?: string;
}

interface SyncItemResult {
  success: boolean;
  conflict?: boolean;
  serverData?: any;
  serverTime?: number;
  error?: string;
}
