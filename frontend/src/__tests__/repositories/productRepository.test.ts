/**
 * ProductRepository Unit Tests
 * 
 * Tests CRUD operations for products using Dexie.js.
 */

import { db, clearDatabase } from '../../db/index';
import { productRepository } from '../../db/repositories/productRepository';

describe('ProductRepository', () => {
  beforeEach(async () => {
    // Clear database before each test
    await clearDatabase();
  });

  describe('create', () => {
    it('should create a product with generated localId and timestamps', async () => {
      const productData = {
        name: 'Lipstick Red',
        category: 'Makeup',
        price: 25.99,
        stock: 50
      };

      const id = await productRepository.create(productData);

      expect(id).toBeDefined();
      expect(typeof id).toBe('number');

      const product = await db.products.get(id);
      expect(product).toBeDefined();
      expect(product?.name).toBe('Lipstick Red');
      expect(product?.category).toBe('Makeup');
      expect(product?.price).toBe(25.99);
      expect(product?.stock).toBe(50);
      expect(product?.localId).toBeDefined();
      expect(product?.createdAt).toBeDefined();
      expect(product?.updatedAt).toBeDefined();
      expect(product?.synced).toBe(false);
      expect(product?.pendingSync).toBe(true);
      expect(product?.deleted).toBe(false);
    });

    it('should create product without queuing for sync when queueForSync is false', async () => {
      const productData = {
        name: 'Foundation',
        category: 'Skincare',
        price: 45.00,
        stock: 20
      };

      const id = await productRepository.create(productData, false);

      const product = await db.products.get(id);
      expect(product?.pendingSync).toBe(true); // Still true, sync handled separately
    });
  });

  describe('getAll', () => {
    it('should return all non-deleted products', async () => {
      await db.products.bulkAdd([
        { name: 'Product 1', category: 'A', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'Product 2', category: 'B', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'Product 3', category: 'C', price: 30, stock: 15, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: true }
      ]);

      const products = await productRepository.getAll();

      expect(products).toHaveLength(2);
      expect(products.map(p => p.name).sort()).toEqual(['Product 1', 'Product 2']);
    });

    it('should include deleted products when includeDeleted is true', async () => {
      await db.products.bulkAdd([
        { name: 'Product 1', category: 'A', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'Product 2', category: 'B', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: true }
      ]);

      const products = await productRepository.getAll(true);

      expect(products).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should return product by ID', async () => {
      const id = await db.products.add({
        name: 'Test Product',
        category: 'Test',
        price: 100,
        stock: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      const product = await productRepository.getById(id);

      expect(product).toBeDefined();
      expect(product?.name).toBe('Test Product');
    });

    it('should return undefined for non-existent ID', async () => {
      const product = await productRepository.getById(99999);
      expect(product).toBeUndefined();
    });
  });

  describe('getByLocalId', () => {
    it('should return product by local ID', async () => {
      const localId = 'test-local-id-123';
      await db.products.add({
        localId,
        name: 'Test Product',
        category: 'Test',
        price: 100,
        stock: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      const product = await productRepository.getByLocalId(localId);

      expect(product).toBeDefined();
      expect(product?.name).toBe('Test Product');
    });
  });

  describe('update', () => {
    it('should update product and set updatedAt timestamp', async () => {
      const id = await db.products.add({
        name: 'Original Name',
        category: 'Test',
        price: 50,
        stock: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      const originalUpdatedAt = (await db.products.get(id))!.updatedAt;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await productRepository.update(id, { name: 'Updated Name', price: 75 });

      const product = await db.products.get(id);
      expect(product?.name).toBe('Updated Name');
      expect(product?.price).toBe(75);
      expect(product?.updatedAt).toBeGreaterThan(originalUpdatedAt);
      expect(product?.synced).toBe(false);
      expect(product?.pendingSync).toBe(true);
    });
  });

  describe('delete', () => {
    it('should soft delete product by default', async () => {
      const id = await db.products.add({
        name: 'To Delete',
        category: 'Test',
        price: 50,
        stock: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      await productRepository.delete(id);

      const product = await db.products.get(id);
      expect(product?.deleted).toBe(true);
      expect(product?.synced).toBe(false);
      expect(product?.pendingSync).toBe(true);
    });

    it('should hard delete product when hardDelete is true', async () => {
      const id = await db.products.add({
        name: 'To Delete',
        category: 'Test',
        price: 50,
        stock: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      await productRepository.delete(id, true);

      const product = await db.products.get(id);
      expect(product).toBeUndefined();
    });
  });

  describe('queryByCategory', () => {
    it('should return products filtered by category', async () => {
      await db.products.bulkAdd([
        { name: 'P1', category: 'Makeup', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P2', category: 'Skincare', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P3', category: 'Makeup', price: 30, stock: 15, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false }
      ]);

      const products = await productRepository.queryByCategory('Makeup');

      expect(products).toHaveLength(2);
      expect(products.every(p => p.category === 'Makeup')).toBe(true);
    });

    it('should exclude deleted products', async () => {
      await db.products.bulkAdd([
        { name: 'P1', category: 'Makeup', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P2', category: 'Makeup', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: true }
      ]);

      const products = await productRepository.queryByCategory('Makeup');

      expect(products).toHaveLength(1);
      expect(products[0].name).toBe('P1');
    });
  });

  describe('queryByName', () => {
    it('should return products matching name search (case-insensitive)', async () => {
      await db.products.bulkAdd([
        { name: 'Lipstick Red', category: 'Makeup', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'Lipstick Pink', category: 'Makeup', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'Foundation', category: 'Skincare', price: 30, stock: 15, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false }
      ]);

      const products = await productRepository.queryByName('lipstick');

      expect(products).toHaveLength(2);
    });
  });

  describe('getCategories', () => {
    it('should return unique sorted categories', async () => {
      await db.products.bulkAdd([
        { name: 'P1', category: 'Makeup', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P2', category: 'Skincare', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P3', category: 'Makeup', price: 30, stock: 15, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P4', category: 'Accessories', price: 40, stock: 20, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false }
      ]);

      const categories = await productRepository.getCategories();

      expect(categories).toEqual(['Accessories', 'Makeup', 'Skincare']);
    });
  });

  describe('getLowStock', () => {
    it('should return products with stock below threshold', async () => {
      await db.products.bulkAdd([
        { name: 'P1', category: 'A', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P2', category: 'B', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P3', category: 'C', price: 30, stock: 15, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false }
      ]);

      const lowStock = await productRepository.getLowStock(10);

      expect(lowStock).toHaveLength(2);
    });
  });

  describe('getPendingSync', () => {
    it('should return products not yet synced', async () => {
      await db.products.bulkAdd([
        { name: 'P1', category: 'A', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P2', category: 'B', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: false, pendingSync: true, deleted: false },
        { name: 'P3', category: 'C', price: 30, stock: 15, createdAt: Date.now(), updatedAt: Date.now(), synced: false, pendingSync: true, deleted: false }
      ]);

      const pending = await productRepository.getPendingSync();

      expect(pending).toHaveLength(2);
    });
  });

  describe('markSynced', () => {
    it('should mark product as synced with server timestamp', async () => {
      const id = await db.products.add({
        name: 'Test',
        category: 'Test',
        price: 10,
        stock: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
        pendingSync: true,
        deleted: false
      });

      await productRepository.markSynced(id, 1700000000000);

      const product = await db.products.get(id);
      expect(product?.synced).toBe(true);
      expect(product?.pendingSync).toBe(false);
      expect(product?.serverUpdatedAt).toBe(1700000000000);
    });
  });

  describe('bulkCreate and bulkPut', () => {
    it('should bulk create products', async () => {
      const products = [
        { name: 'P1', category: 'A', price: 10, stock: 5, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false },
        { name: 'P2', category: 'B', price: 20, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false }
      ];

      const ids = await productRepository.bulkCreate(products);

      expect(ids).toHaveLength(2);
      expect(await db.products.count()).toBe(2);
    });

    it('should bulk put products (upsert)', async () => {
      const id = await db.products.add({
        name: 'Existing',
        category: 'A',
        price: 10,
        stock: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        pendingSync: false,
        deleted: false
      });

      await productRepository.bulkPut([
        { id, name: 'Updated', category: 'A', price: 15, stock: 10, createdAt: Date.now(), updatedAt: Date.now(), synced: true, pendingSync: false, deleted: false }
      ]);

      const product = await db.products.get(id);
      expect(product?.name).toBe('Updated');
      expect(product?.price).toBe(15);
    });
  });
});
