/**
 * Sync Queue Service
 * 
 * Manages the synchronization queue for offline-first operations.
 * Handles FIFO processing, exponential backoff, and retry logic.
 */

import { db } from '../db/index';
import type { SyncQueueItem, SyncOperation, SyncTable, SyncStatus } from '../types';
import { 
  MAX_RETRY_COUNT, 
  RETRY_DELAYS, 
  CLOCK_SKEW_TOLERANCE,
  SYNC_STATUS 
} from '../config/syncConfig';

/**
 * Sync Queue Service
 * 
 * Provides queue management with:
 * - FIFO processing
 * - Exponential backoff (1s, 2s, 4s, 8s, max 30s)
 * - Max 5 retries before marking as failed
 * - Clock skew detection
 */
export const syncQueueService = {
  /**
   * Add an operation to the sync queue
   */
  async enqueue(
    table: SyncTable,
    operation: SyncOperation,
    recordId: number,
    payload: object,
    localId?: string
  ): Promise<number> {
    const now = Date.now();
    
    const queueItem: SyncQueueItem = {
      table,
      operation,
      recordId,
      localId,
      payload,
      timestamp: now,
      status: SYNC_STATUS.PENDING,
      retryCount: 0,
      nextRetryAt: now
    };
    
    const id = await db.syncQueue.add(queueItem);
    console.log(`[SyncQueue] Enqueued ${operation} on ${table}#${recordId}, queue size: ${await this.getPendingCount()}`);
    
    return id;
  },
  
  /**
   * Get all pending items (FIFO order)
   */
  async getPending(): Promise<SyncQueueItem[]> {
    const now = Date.now();
    
    return db.syncQueue
      .where('status')
      .equals(SYNC_STATUS.PENDING)
      .and(item => !item.nextRetryAt || item.nextRetryAt <= now)
      .sortBy('timestamp');
  },
  
  /**
   * Get pending count
   */
  async getPendingCount(): Promise<number> {
    return db.syncQueue.where('status').equals(SYNC_STATUS.PENDING).count();
  },
  
  /**
   * Get failed count
   */
  async getFailedCount(): Promise<number> {
    return db.syncQueue.where('status').equals(SYNC_STATUS.FAILED).count();
  },
  
  /**
   * Mark an item as processing
   */
  async markProcessing(id: number): Promise<void> {
    await db.syncQueue.update(id, {
      status: SYNC_STATUS.PROCESSING
    });
  },
  
  /**
   * Mark an item as failed with retry scheduling
   */
  async markFailed(id: number, error: string): Promise<void> {
    const item = await db.syncQueue.get(id);
    if (!item) return;
    
    const newRetryCount = item.retryCount + 1;
    const nextRetryDelay = this.getRetryDelay(newRetryCount);
    const nextRetryAt = Date.now() + nextRetryDelay;
    
    if (newRetryCount >= MAX_RETRY_COUNT) {
      // Max retries reached, mark as permanently failed
      await db.syncQueue.update(id, {
        status: SYNC_STATUS.FAILED,
        retryCount: newRetryCount,
        lastError: error,
        nextRetryAt: undefined
      });
      console.error(`[SyncQueue] Item ${id} permanently failed after ${newRetryCount} retries`);
    } else {
      // Schedule retry with exponential backoff
      await db.syncQueue.update(id, {
        status: SYNC_STATUS.PENDING,
        retryCount: newRetryCount,
        lastError: error,
        nextRetryAt
      });
      console.warn(`[SyncQueue] Item ${id} failed, retry ${newRetryCount}/${MAX_RETRY_COUNT} in ${nextRetryDelay}ms`);
    }
  },
  
  /**
   * Mark an item as completed and remove from queue
   */
  async dequeue(id: number): Promise<void> {
    await db.syncQueue.delete(id);
    console.log(`[SyncQueue] Dequeued item ${id}, remaining: ${await this.getPendingCount()}`);
  },
  
  /**
   * Remove all completed items from queue
   */
  async clearCompleted(): Promise<number> {
    const count = await db.syncQueue.where('status').equals(SYNC_STATUS.COMPLETED).count();
    await db.syncQueue.where('status').equals(SYNC_STATUS.COMPLETED).delete();
    return count;
  },
  
  /**
   * Remove all failed items from queue (after user acknowledgment)
   */
  async clearFailed(): Promise<number> {
    const count = await db.syncQueue.where('status').equals(SYNC_STATUS.FAILED).count();
    await db.syncQueue.where('status').equals(SYNC_STATUS.FAILED).delete();
    return count;
  },
  
  /**
   * Get retry delay for a given retry count
   * Exponential backoff: 1s, 2s, 4s, 8s, max 30s
   */
  getRetryDelay(retryCount: number): number {
    if (retryCount <= 0) return RETRY_DELAYS[0];
    if (retryCount > RETRY_DELAYS.length) return RETRY_DELAYS[RETRY_DELAYS.length - 1];
    return RETRY_DELAYS[retryCount - 1];
  },
  
  /**
   * Check for clock skew between client and server
   * @param serverTime - Server timestamp from API response
   * @returns true if clock skew is within tolerance
   */
  checkClockSkew(serverTime: number): { isValid: boolean; skew: number; warning?: string } {
    const clientTime = Date.now();
    const skew = Math.abs(clientTime - serverTime);
    
    if (skew > CLOCK_SKEW_TOLERANCE) {
      console.warn(`[SyncQueue] Clock skew detected: ${skew}ms (tolerance: ${CLOCK_SKEW_TOLERANCE}ms)`);
      return {
        isValid: false,
        skew,
        warning: `Device clock is off by ${Math.round(skew / 1000)} seconds. Please sync your device time.`
      };
    }
    
    return { isValid: true, skew };
  },
  
  /**
   * Process a single queue item
   * @param item - The queue item to process
   * @param syncFunction - Function to call to sync with server
   */
  async processItem(
    item: SyncQueueItem,
    syncFunction: (item: SyncQueueItem) => Promise<{ success: boolean; error?: string; serverTime?: number }>
  ): Promise<{ success: boolean; error?: string }> {
    await this.markProcessing(item.id!);
    
    try {
      const result = await syncFunction(item);
      
      if (result.success) {
        await this.dequeue(item.id!);
        
        // Check clock skew if server time provided
        if (result.serverTime) {
          const clockCheck = this.checkClockSkew(result.serverTime);
          if (!clockCheck.isValid) {
            return { 
              success: true, 
              error: clockCheck.warning 
            };
          }
        }
        
        return { success: true };
      } else {
        await this.markFailed(item.id!, result.error || 'Unknown error');
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markFailed(item.id!, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
  
  /**
   * Process all pending items in FIFO order
   * @param syncFunction - Function to sync each item with server
   * @param onItemProcessed - Optional callback after each item
   */
  async processQueue(
    syncFunction: (item: SyncQueueItem) => Promise<{ success: boolean; error?: string; serverTime?: number }>,
    onItemProcessed?: (item: SyncQueueItem, result: { success: boolean; error?: string }) => void
  ): Promise<{ processed: number; successful: number; failed: number }> {
    const pending = await this.getPending();
    
    let processed = 0;
    let successful = 0;
    let failed = 0;
    
    for (const item of pending) {
      const result = await this.processItem(item, syncFunction);
      processed++;
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
      
      if (onItemProcessed) {
        onItemProcessed(item, result);
      }
    }
    
    return { processed, successful, failed };
  },
  
  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    total: number;
  }> {
    const [pending, processing, failed, total] = await Promise.all([
      db.syncQueue.where('status').equals(SYNC_STATUS.PENDING).count(),
      db.syncQueue.where('status').equals(SYNC_STATUS.PROCESSING).count(),
      db.syncQueue.where('status').equals(SYNC_STATUS.FAILED).count(),
      db.syncQueue.count()
    ]);
    
    return { pending, processing, failed, total };
  },
  
  /**
   * Retry a failed item
   */
  async retryFailed(id: number): Promise<void> {
    const item = await db.syncQueue.get(id);
    if (!item || item.status !== SYNC_STATUS.FAILED) return;
    
    await db.syncQueue.update(id, {
      status: SYNC_STATUS.PENDING,
      retryCount: 0,
      lastError: undefined,
      nextRetryAt: Date.now()
    });
  },
  
  /**
   * Retry all failed items
   */
  async retryAllFailed(): Promise<number> {
    const failedItems = await db.syncQueue
      .where('status')
      .equals(SYNC_STATUS.FAILED)
      .toArray();
    
    for (const item of failedItems) {
      await this.retryFailed(item.id!);
    }
    
    return failedItems.length;
  }
};

export default syncQueueService;
