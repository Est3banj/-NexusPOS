/**
 * SyncQueueService Unit Tests
 * 
 * Tests for FIFO queue processing, exponential backoff, and retry logic.
 */

import { db, clearDatabase } from '../../db/index';
import { syncQueueService } from '../../services/syncQueueService';
import { SYNC_STATUS, MAX_RETRY_COUNT, RETRY_DELAYS } from '../../config/syncConfig';
import type { SyncQueueItem } from '../../types';

describe('SyncQueueService', () => {
  beforeEach(async () => {
    await clearDatabase();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('enqueue', () => {
    it('should add an item to the sync queue', async () => {
      const id = await syncQueueService.enqueue(
        'products',
        'CREATE',
        1,
        { name: 'Test Product' },
        'local-123'
      );

      expect(id).toBeDefined();

      const item = await db.syncQueue.get(id);
      expect(item).toBeDefined();
      expect(item?.table).toBe('products');
      expect(item?.operation).toBe('CREATE');
      expect(item?.recordId).toBe(1);
      expect(item?.payload).toEqual({ name: 'Test Product' });
      expect(item?.localId).toBe('local-123');
      expect(item?.status).toBe(SYNC_STATUS.PENDING);
      expect(item?.retryCount).toBe(0);
    });

    it('should generate sequential IDs', async () => {
      const id1 = await syncQueueService.enqueue('products', 'CREATE', 1, {});
      const id2 = await syncQueueService.enqueue('sales', 'CREATE', 2, {});

      expect(id2).toBe(id1 + 1);
    });
  });

  describe('getPending', () => {
    it('should return pending items in FIFO order (by timestamp)', async () => {
      const now = Date.now();
      
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: now + 1000, status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: now, status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'products', operation: 'UPDATE', recordId: 3, payload: {}, timestamp: now + 500, status: SYNC_STATUS.PENDING, retryCount: 0 }
      ]);

      const pending = await syncQueueService.getPending();

      expect(pending).toHaveLength(3);
      expect(pending[0]?.recordId).toBe(2); // Earliest timestamp
      expect(pending[1]?.recordId).toBe(3);
      expect(pending[2]?.recordId).toBe(1);
    });

    it('should not return items scheduled for future retry', async () => {
      const now = Date.now();
      
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: now, status: SYNC_STATUS.PENDING, retryCount: 0, nextRetryAt: undefined },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: now, status: SYNC_STATUS.PENDING, retryCount: 1, nextRetryAt: now + 60000 } // Retry in 1 minute
      ]);

      const pending = await syncQueueService.getPending();

      expect(pending).toHaveLength(1);
      expect(pending[0]?.recordId).toBe(1);
    });

    it('should not return failed items', async () => {
      const now = Date.now();
      
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: now, status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: now, status: SYNC_STATUS.FAILED, retryCount: MAX_RETRY_COUNT }
      ]);

      const pending = await syncQueueService.getPending();

      expect(pending).toHaveLength(1);
    });
  });

  describe('getPendingCount', () => {
    it('should return count of pending items', async () => {
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'products', operation: 'CREATE', recordId: 3, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.FAILED, retryCount: MAX_RETRY_COUNT }
      ]);

      const count = await syncQueueService.getPendingCount();

      expect(count).toBe(2);
    });
  });

  describe('getFailedCount', () => {
    it('should return count of failed items', async () => {
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.FAILED, retryCount: MAX_RETRY_COUNT },
        { table: 'products', operation: 'UPDATE', recordId: 3, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.FAILED, retryCount: MAX_RETRY_COUNT }
      ]);

      const count = await syncQueueService.getFailedCount();

      expect(count).toBe(2);
    });
  });

  describe('markProcessing', () => {
    it('should update item status to processing', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: {},
        timestamp: Date.now(),
        status: SYNC_STATUS.PENDING,
        retryCount: 0
      });

      await syncQueueService.markProcessing(id);

      const item = await db.syncQueue.get(id);
      expect(item?.status).toBe(SYNC_STATUS.PROCESSING);
    });
  });

  describe('markFailed', () => {
    it('should schedule retry with exponential backoff', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: {},
        timestamp: Date.now(),
        status: SYNC_STATUS.PROCESSING,
        retryCount: 0
      });

      await syncQueueService.markFailed(id, 'Network error');

      const item = await db.syncQueue.get(id);
      expect(item?.status).toBe(SYNC_STATUS.PENDING);
      expect(item?.retryCount).toBe(1);
      expect(item?.lastError).toBe('Network error');
      expect(item?.nextRetryAt).toBeDefined();
    });

    it('should permanently mark as failed after max retries', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: {},
        timestamp: Date.now(),
        status: SYNC_STATUS.PROCESSING,
        retryCount: MAX_RETRY_COUNT - 1
      });

      await syncQueueService.markFailed(id, 'Persistent error');

      const item = await db.syncQueue.get(id);
      expect(item?.status).toBe(SYNC_STATUS.FAILED);
      expect(item?.retryCount).toBe(MAX_RETRY_COUNT);
      expect(item?.lastError).toBe('Persistent error');
      expect(item?.nextRetryAt).toBeUndefined();
    });
  });

  describe('dequeue', () => {
    it('should remove item from queue', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: {},
        timestamp: Date.now(),
        status: SYNC_STATUS.PROCESSING,
        retryCount: 0
      });

      await syncQueueService.dequeue(id);

      const item = await db.syncQueue.get(id);
      expect(item).toBeUndefined();
    });
  });

  describe('getRetryDelay', () => {
    it('should return correct delays for exponential backoff', () => {
      expect(syncQueueService.getRetryDelay(0)).toBe(RETRY_DELAYS[0]); // 1000ms
      expect(syncQueueService.getRetryDelay(1)).toBe(RETRY_DELAYS[0]); // 1000ms
      expect(syncQueueService.getRetryDelay(2)).toBe(RETRY_DELAYS[1]); // 2000ms
      expect(syncQueueService.getRetryDelay(3)).toBe(RETRY_DELAYS[2]); // 4000ms
      expect(syncQueueService.getRetryDelay(4)).toBe(RETRY_DELAYS[3]); // 8000ms
      expect(syncQueueService.getRetryDelay(5)).toBe(RETRY_DELAYS[4]); // 30000ms (max)
      expect(syncQueueService.getRetryDelay(10)).toBe(RETRY_DELAYS[4]); // 30000ms (max)
    });
  });

  describe('checkClockSkew', () => {
    const CLOCK_SKEW_TOLERANCE = 5 * 60 * 1000; // 5 minutes

    it('should return valid when clock skew is within tolerance', () => {
      const serverTime = Date.now();
      
      const result = syncQueueService.checkClockSkew(serverTime);

      expect(result.isValid).toBe(true);
      expect(result.skew).toBeLessThan(CLOCK_SKEW_TOLERANCE);
    });

    it('should return invalid when clock skew exceeds tolerance', () => {
      const serverTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
      
      const result = syncQueueService.checkClockSkew(serverTime);

      expect(result.isValid).toBe(false);
      expect(result.skew).toBeGreaterThan(CLOCK_SKEW_TOLERANCE);
      expect(result.warning).toBeDefined();
    });
  });

  describe('processItem', () => {
    it('should process item and call sync function', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: { name: 'Test' },
        timestamp: Date.now(),
        status: SYNC_STATUS.PENDING,
        retryCount: 0
      });

      const item = await db.syncQueue.get(id)!;
      const syncFn = jest.fn().mockResolvedValue({ success: true, serverTime: Date.now() });

      const result = await syncQueueService.processItem(item, syncFn);

      expect(syncFn).toHaveBeenCalledWith(item);
      expect(result.success).toBe(true);
      
      // Item should be removed from queue
      const queueItem = await db.syncQueue.get(id);
      expect(queueItem).toBeUndefined();
    });

    it('should handle sync failure with retry', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: { name: 'Test' },
        timestamp: Date.now(),
        status: SYNC_STATUS.PENDING,
        retryCount: 0
      });

      const item = await db.syncQueue.get(id)!;
      const syncFn = jest.fn().mockResolvedValue({ success: false, error: 'Server error' });

      const result = await syncQueueService.processItem(item, syncFn);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');

      // Item should be updated with retry count
      const queueItem = await db.syncQueue.get(id);
      expect(queueItem?.retryCount).toBe(1);
      expect(queueItem?.status).toBe(SYNC_STATUS.PENDING);
    });

    it('should return clock skew warning when detected', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: { name: 'Test' },
        timestamp: Date.now(),
        status: SYNC_STATUS.PENDING,
        retryCount: 0
      });

      const item = await db.syncQueue.get(id)!;
      const serverTimeWithSkew = Date.now() - (10 * 60 * 1000); // 10 min skew
      const syncFn = jest.fn().mockResolvedValue({ success: true, serverTime: serverTimeWithSkew });

      const result = await syncQueueService.processItem(item, syncFn);

      expect(result.success).toBe(true);
      expect(result.error).toContain('clock');
    });
  });

  describe('processQueue', () => {
    it('should process all pending items in FIFO order', async () => {
      const now = Date.now();
      
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: now + 1000, status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: now, status: SYNC_STATUS.PENDING, retryCount: 0 }
      ]);

      const processed: number[] = [];
      const syncFn = jest.fn().mockImplementation(async (item: SyncQueueItem) => {
        processed.push(item.recordId);
        return { success: true };
      });

      const result = await syncQueueService.processQueue(syncFn);

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(processed).toEqual([2, 1]); // FIFO by timestamp
    });

    it('should track failures correctly', async () => {
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: Date.now() + 1000, status: SYNC_STATUS.PENDING, retryCount: 0 }
      ]);

      const syncFn = jest.fn().mockImplementation(async (item: SyncQueueItem) => {
        if (item.recordId === 1) {
          return { success: true };
        }
        return { success: false, error: 'Failed' };
      });

      const result = await syncQueueService.processQueue(syncFn);

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should call onItemProcessed callback after each item', async () => {
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 }
      ]);

      const callback = jest.fn();
      const syncFn = jest.fn().mockResolvedValue({ success: true });

      await syncQueueService.processQueue(syncFn, callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 },
        { table: 'products', operation: 'UPDATE', recordId: 3, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PROCESSING, retryCount: 0 },
        { table: 'products', operation: 'DELETE', recordId: 4, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.FAILED, retryCount: MAX_RETRY_COUNT }
      ]);

      const stats = await syncQueueService.getStats();

      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.total).toBe(4);
    });
  });

  describe('retryFailed', () => {
    it('should retry a failed item', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: {},
        timestamp: Date.now(),
        status: SYNC_STATUS.FAILED,
        retryCount: MAX_RETRY_COUNT,
        lastError: 'Persistent error'
      });

      await syncQueueService.retryFailed(id);

      const item = await db.syncQueue.get(id);
      expect(item?.status).toBe(SYNC_STATUS.PENDING);
      expect(item?.retryCount).toBe(0);
      expect(item?.lastError).toBeUndefined();
    });

    it('should not retry non-failed items', async () => {
      const id = await db.syncQueue.add({
        table: 'products',
        operation: 'CREATE',
        recordId: 1,
        payload: {},
        timestamp: Date.now(),
        status: SYNC_STATUS.PENDING,
        retryCount: 0
      });

      await syncQueueService.retryFailed(id);

      const item = await db.syncQueue.get(id);
      expect(item?.status).toBe(SYNC_STATUS.PENDING);
    });
  });

  describe('retryAllFailed', () => {
    it('should retry all failed items', async () => {
      await db.syncQueue.bulkAdd([
        { table: 'products', operation: 'CREATE', recordId: 1, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.FAILED, retryCount: MAX_RETRY_COUNT },
        { table: 'sales', operation: 'CREATE', recordId: 2, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.FAILED, retryCount: MAX_RETRY_COUNT },
        { table: 'products', operation: 'UPDATE', recordId: 3, payload: {}, timestamp: Date.now(), status: SYNC_STATUS.PENDING, retryCount: 0 }
      ]);

      const count = await syncQueueService.retryAllFailed();

      expect(count).toBe(2);

      const failed = await db.syncQueue.where('status').equals(SYNC_STATUS.FAILED).toArray();
      expect(failed).toHaveLength(0);
    });
  });
});
