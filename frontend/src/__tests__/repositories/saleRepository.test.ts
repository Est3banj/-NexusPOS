/**
 * SaleRepository Unit Tests
 * 
 * Tests CRUD operations for sales using Dexie.js.
 */

import { db, clearDatabase } from '../../db/index';
import { saleRepository } from '../../db/repositories/saleRepository';
import type { SaleItem } from '../../types';

describe('SaleRepository', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe('create', () => {
    it('should create a sale with generated localId and timestamps', async () => {
      const saleData = {
        items: [
          { productId: 1, name: 'Product 1', quantity: 2, unitPrice: 10, subtotal: 20 }
        ] as SaleItem[],
        subtotal: 20,
        tax: 2,
        total: 22,
        paymentMethod: 'cash' as const
      };

      const id = await saleRepository.create(saleData);

      expect(id).toBeDefined();
      expect(typeof id).toBe('number');

      const sale = await db.sales.get(id);
      expect(sale).toBeDefined();
      expect(sale?.items).toHaveLength(1);
      expect(sale?.subtotal).toBe(20);
      expect(sale?.tax).toBe(2);
      expect(sale?.total).toBe(22);
      expect(sale?.paymentMethod).toBe('cash');
      expect(sale?.localId).toBeDefined();
      expect(sale?.createdAt).toBeDefined();
      expect(sale?.updatedAt).toBeDefined();
      expect(sale?.synced).toBe(false);
      expect(sale?.pendingSync).toBe(true);
      expect(sale?.deleted).toBe(false);
    });

    it('should update product stock when creating sale', async () => {
      // Create a product first
      const productId = await db.products.add({
        name: 'Test Product',
        category: 'Test',
        price: 10,
        stock: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      const saleData = {
        items: [
          { productId, name: 'Test Product', quantity: 3, unitPrice: 10, subtotal: 30 }
        ] as SaleItem[],
        subtotal: 30,
        tax: 3,
        total: 33,
        paymentMethod: 'card' as const
      };

      await saleRepository.create(saleData);

      const product = await db.products.get(productId);
      expect(product?.stock).toBe(7); // 10 - 3
    });
  });

  describe('getAll', () => {
    it('should return all non-deleted sales in reverse chronological order', async () => {
      const now = Date.now();
      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: now - 2000, updatedAt: now - 2000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'card', createdAt: now - 1000, updatedAt: now - 1000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 30, tax: 3, total: 33, paymentMethod: 'transfer', createdAt: now, updatedAt: now, synced: true, pendingSync: false, deleted: true }
      ]);

      const sales = await saleRepository.getAll();

      expect(sales).toHaveLength(2);
      expect(sales[0]?.total).toBe(22); // Most recent first
      expect(sales[1]?.total).toBe(11);
    });

    it('should include deleted sales when includeDeleted is true', async () => {
      const now = Date.now();
      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: now - 1000, updatedAt: now - 1000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'card', createdAt: now, updatedAt: now, synced: true, pendingSync: false, deleted: true }
      ]);

      const sales = await saleRepository.getAll(true);

      expect(sales).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should return sale by ID', async () => {
      const id = await db.sales.add({
        items: [],
        subtotal: 100,
        tax: 10,
        total: 110,
        paymentMethod: 'cash',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      const sale = await saleRepository.getById(id);

      expect(sale).toBeDefined();
      expect(sale?.total).toBe(110);
    });

    it('should return undefined for non-existent ID', async () => {
      const sale = await saleRepository.getById(99999);
      expect(sale).toBeUndefined();
    });
  });

  describe('getByLocalId', () => {
    it('should return sale by local ID', async () => {
      const localId = 'test-sale-local-id';
      await db.sales.add({
        localId,
        items: [],
        subtotal: 50,
        tax: 5,
        total: 55,
        paymentMethod: 'card',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      const sale = await saleRepository.getByLocalId(localId);

      expect(sale).toBeDefined();
      expect(sale?.total).toBe(55);
    });
  });

  describe('update', () => {
    it('should update sale and set updatedAt timestamp', async () => {
      const id = await db.sales.add({
        items: [],
        subtotal: 50,
        tax: 5,
        total: 55,
        paymentMethod: 'cash',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      const originalUpdatedAt = (await db.sales.get(id))!.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      await saleRepository.update(id, { total: 60, paymentMethod: 'card' });

      const sale = await db.sales.get(id);
      expect(sale?.total).toBe(60);
      expect(sale?.paymentMethod).toBe('card');
      expect(sale?.updatedAt).toBeGreaterThan(originalUpdatedAt);
      expect(sale?.synced).toBe(false);
      expect(sale?.pendingSync).toBe(true);
    });
  });

  describe('delete', () => {
    it('should soft delete sale by default', async () => {
      const id = await db.sales.add({
        items: [],
        subtotal: 50,
        tax: 5,
        total: 55,
        paymentMethod: 'cash',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      await saleRepository.delete(id);

      const sale = await db.sales.get(id);
      expect(sale?.deleted).toBe(true);
      expect(sale?.synced).toBe(false);
      expect(sale?.pendingSync).toBe(true);
    });

    it('should hard delete sale when hardDelete is true', async () => {
      const id = await db.sales.add({
        items: [],
        subtotal: 50,
        tax: 5,
        total: 55,
        paymentMethod: 'cash',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      await saleRepository.delete(id, true);

      const sale = await db.sales.get(id);
      expect(sale).toBeUndefined();
    });
  });

  describe('queryByDateRange', () => {
    it('should return sales within date range', async () => {
      const startDate = new Date('2024-01-01').getTime();
      const endDate = new Date('2024-12-31').getTime();
      const midDate = new Date('2024-06-15').getTime();

      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: startDate - 1000, updatedAt: startDate - 1000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'cash', createdAt: midDate, updatedAt: midDate, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 30, tax: 3, total: 33, paymentMethod: 'cash', createdAt: endDate + 1000, updatedAt: endDate + 1000, synced: true, pendingSync: false, deleted: false }
      ]);

      const sales = await saleRepository.queryByDateRange(startDate, endDate);

      expect(sales).toHaveLength(1);
      expect(sales[0]?.total).toBe(22);
    });
  });

  describe('queryByPaymentMethod', () => {
    it('should return sales filtered by payment method', async () => {
      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'card', createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 30, tax: 3, total: 33, paymentMethod: 'cash', createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false }
      ]);

      const sales = await saleRepository.queryByPaymentMethod('cash');

      expect(sales).toHaveLength(2);
      expect(sales.every(s => s.paymentMethod === 'cash')).toBe(true);
    });
  });

  describe('getTodaySales', () => {
    it('should return sales from today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: yesterday.getTime(), updatedAt: yesterday.getTime(), synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'cash', createdAt: startOfDay + 3600000, updatedAt: startOfDay + 3600000, synced: true, pendingSync: false, deleted: false }
      ]);

      const sales = await saleRepository.getTodaySales();

      expect(sales).toHaveLength(1);
    });
  });

  describe('getPendingSync', () => {
    it('should return sales not yet synced', async () => {
      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'cash', createdAt: Date.now(), updatedAt: Date.now(), synced: false, pendingSync: true, deleted: false }
      ]);

      const pending = await saleRepository.getPendingSync();

      expect(pending).toHaveLength(1);
    });
  });

  describe('markSynced', () => {
    it('should mark sale as synced with server timestamp', async () => {
      const id = await db.sales.add({
        items: [],
        subtotal: 50,
        tax: 5,
        total: 55,
        paymentMethod: 'cash',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
        pendingSync: true,
        deleted: false
      });

      await saleRepository.markSynced(id, 1700000000000);

      const sale = await db.sales.get(id);
      expect(sale?.synced).toBe(true);
      expect(sale?.pendingSync).toBe(false);
      expect(sale?.serverUpdatedAt).toBe(1700000000000);
    });
  });

  describe('getTotalSales', () => {
    it('should return total sales amount for date range', async () => {
      const startDate = new Date('2024-01-01').getTime();
      const endDate = new Date('2024-12-31').getTime();

      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: startDate + 1000, updatedAt: startDate + 1000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'cash', createdAt: startDate + 2000, updatedAt: startDate + 2000, synced: true, pendingSync: false, deleted: false }
      ]);

      const total = await saleRepository.getTotalSales(startDate, endDate);

      expect(total).toBe(33);
    });
  });

  describe('getSalesCount', () => {
    it('should return sales count for date range', async () => {
      const startDate = new Date('2024-01-01').getTime();
      const endDate = new Date('2024-12-31').getTime();

      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 11, paymentMethod: 'cash', createdAt: startDate + 1000, updatedAt: startDate + 1000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 22, paymentMethod: 'cash', createdAt: startDate + 2000, updatedAt: startDate + 2000, synced: true, pendingSync: false, deleted: false }
      ]);

      const count = await saleRepository.getSalesCount(startDate, endDate);

      expect(count).toBe(2);
    });
  });

  describe('getSalesByPaymentMethod', () => {
    it('should return sales grouped by payment method', async () => {
      const startDate = new Date('2024-01-01').getTime();
      const endDate = new Date('2024-12-31').getTime();

      await db.sales.bulkAdd([
        { items: [], subtotal: 10, tax: 1, total: 10, paymentMethod: 'cash', createdAt: startDate + 1000, updatedAt: startDate + 1000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 20, tax: 2, total: 20, paymentMethod: 'card', createdAt: startDate + 2000, updatedAt: startDate + 2000, synced: true, pendingSync: false, deleted: false },
        { items: [], subtotal: 30, tax: 3, total: 30, paymentMethod: 'cash', createdAt: startDate + 3000, updatedAt: startDate + 3000, synced: true, pendingSync: false, deleted: false }
      ]);

      const result = await saleRepository.getSalesByPaymentMethod(startDate, endDate);

      expect(result.cash).toBe(40);
      expect(result.card).toBe(20);
      expect(result.transfer).toBe(0);
    });
  });
});
