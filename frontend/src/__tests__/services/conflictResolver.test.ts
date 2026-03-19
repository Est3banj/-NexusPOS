/**
 * ConflictResolver Unit Tests
 * 
 * Tests for Last Write Wins (LWW) conflict resolution strategy.
 */

import { conflictResolver } from '../../services/conflictResolver';
import type { Product, Sale } from '../../types';
import { CLOCK_SKEW_TOLERANCE } from '../../config/syncConfig';

describe('ConflictResolver', () => {
  describe('resolveProduct', () => {
    const serverTime = Date.now();

    it('should resolve in favor of local when local timestamp is newer', () => {
      const localProduct: Product = {
        id: 1,
        name: 'Local Version',
        category: 'Makeup',
        price: 30,
        stock: 20,
        createdAt: Date.now() - 10000,
        updatedAt: serverTime + 1000, // Local is newer
        synced: false,
        deleted: false
      };

      const serverProduct: Product = {
        id: 1,
        name: 'Server Version',
        category: 'Makeup',
        price: 25,
        stock: 25,
        createdAt: Date.now() - 20000,
        updatedAt: serverTime, // Server is older
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolveProduct(localProduct, serverProduct, serverTime);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('local');
      expect(result.localData?.name).toBe('Local Version');
      expect(result.message).toContain('Local');
    });

    it('should resolve in favor of server when server timestamp is newer', () => {
      const localProduct: Product = {
        id: 1,
        name: 'Local Version',
        category: 'Makeup',
        price: 30,
        stock: 20,
        createdAt: Date.now() - 20000,
        updatedAt: serverTime - 1000, // Local is older
        synced: false,
        deleted: false
      };

      const serverProduct: Product = {
        id: 1,
        name: 'Server Version',
        category: 'Makeup',
        price: 25,
        stock: 25,
        createdAt: Date.now() - 10000,
        updatedAt: serverTime, // Server is newer
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolveProduct(localProduct, serverProduct, serverTime);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('server');
      expect(result.serverData?.name).toBe('Server Version');
      expect(result.message).toContain('Server');
    });

    it('should resolve in favor of server when timestamps are equal', () => {
      const localProduct: Product = {
        id: 1,
        name: 'Local Version',
        category: 'Makeup',
        price: 30,
        stock: 20,
        createdAt: Date.now() - 10000,
        updatedAt: serverTime,
        synced: false,
        deleted: false
      };

      const serverProduct: Product = {
        id: 1,
        name: 'Server Version',
        category: 'Makeup',
        price: 25,
        stock: 25,
        createdAt: Date.now() - 10000,
        updatedAt: serverTime,
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolveProduct(localProduct, serverProduct, serverTime);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('server');
      expect(result.message).toContain('equal');
    });

    it('should detect clock skew and warn', () => {
      const localProduct: Product = {
        id: 1,
        name: 'Test',
        category: 'Makeup',
        price: 30,
        stock: 20,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
        deleted: false
      };

      const serverProduct: Product = {
        id: 1,
        name: 'Test',
        category: 'Makeup',
        price: 30,
        stock: 20,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        deleted: false
      };

      // Server time is 10 minutes in the past (exceeds tolerance)
      const skewedServerTime = Date.now() - (10 * 60 * 1000);

      // Mock console.warn to capture warnings
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = conflictResolver.resolveProduct(localProduct, serverProduct, skewedServerTime);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('resolveSale', () => {
    const serverTime = Date.now();

    it('should resolve in favor of local when local timestamp is newer', () => {
      const localSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 100,
        tax: 10,
        total: 110,
        paymentMethod: 'cash',
        createdAt: serverTime - 5000,
        updatedAt: serverTime + 1000,
        synced: false,
        deleted: false
      };

      const serverSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 90,
        tax: 9,
        total: 99,
        paymentMethod: 'card',
        createdAt: serverTime - 10000,
        updatedAt: serverTime,
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolveSale(localSale, serverSale, serverTime);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('local');
      expect(result.localData?.paymentMethod).toBe('cash');
    });

    it('should resolve in favor of server when server timestamp is newer', () => {
      const localSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 100,
        tax: 10,
        total: 110,
        paymentMethod: 'cash',
        createdAt: serverTime - 10000,
        updatedAt: serverTime - 1000,
        synced: false,
        deleted: false
      };

      const serverSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 90,
        tax: 9,
        total: 99,
        paymentMethod: 'card',
        createdAt: serverTime - 5000,
        updatedAt: serverTime,
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolveSale(localSale, serverSale, serverTime);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('server');
      expect(result.serverData?.paymentMethod).toBe('card');
    });

    it('should resolve in favor of server when timestamps are equal', () => {
      const localSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 100,
        tax: 10,
        total: 110,
        paymentMethod: 'cash',
        createdAt: serverTime - 5000,
        updatedAt: serverTime,
        synced: false,
        deleted: false
      };

      const serverSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 90,
        tax: 9,
        total: 99,
        paymentMethod: 'card',
        createdAt: serverTime - 5000,
        updatedAt: serverTime,
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolveSale(localSale, serverSale, serverTime);

      expect(result.resolved).toBe(true);
      expect(result.winner).toBe('server');
    });
  });

  describe('resolve (generic)', () => {
    it('should dispatch to resolveProduct for products', () => {
      const localProduct: Product = {
        id: 1,
        name: 'Local',
        category: 'Test',
        price: 10,
        stock: 5,
        createdAt: Date.now(),
        updatedAt: Date.now() + 1000,
        synced: false,
        deleted: false
      };

      const serverProduct: Product = {
        id: 1,
        name: 'Server',
        category: 'Test',
        price: 15,
        stock: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolve('product', localProduct, serverProduct, Date.now());

      expect(result.winner).toBe('local');
    });

    it('should dispatch to resolveSale for sales', () => {
      const localSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 100,
        tax: 10,
        total: 110,
        paymentMethod: 'cash',
        createdAt: Date.now(),
        updatedAt: Date.now() + 1000,
        synced: false,
        deleted: false
      };

      const serverSale: Sale = {
        id: 1,
        localId: 'local-1',
        items: [],
        subtotal: 90,
        tax: 9,
        total: 99,
        paymentMethod: 'card',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: true,
        deleted: false
      };

      const result = conflictResolver.resolve('sale', localSale, serverSale, Date.now());

      expect(result.winner).toBe('local');
    });
  });

  describe('shouldNotifyUser', () => {
    it('should return true when server won and there were local changes', () => {
      const result = {
        resolved: true,
        winner: 'server' as const,
        localData: { name: 'Local' },
        serverData: { name: 'Server' }
      };

      expect(conflictResolver.shouldNotifyUser(result)).toBe(true);
    });

    it('should return false when local won', () => {
      const result = {
        resolved: true,
        winner: 'local' as const,
        localData: { name: 'Local' },
        serverData: { name: 'Server' }
      };

      expect(conflictResolver.shouldNotifyUser(result)).toBe(false);
    });
  });

  describe('getConflictNotificationMessage', () => {
    it('should return appropriate message when server won', () => {
      const result = {
        resolved: true,
        winner: 'server' as const,
        localData: { name: 'Local' },
        serverData: { name: 'Server' }
      };

      const message = conflictResolver.getConflictNotificationMessage(result, 'product');

      expect(message).toContain('product');
      expect(message).toContain('overwritten');
    });

    it('should return empty string when local won', () => {
      const result = {
        resolved: true,
        winner: 'local' as const,
        localData: { name: 'Local' },
        serverData: { name: 'Server' }
      };

      const message = conflictResolver.getConflictNotificationMessage(result, 'product');

      expect(message).toBe('');
    });
  });

  describe('checkClockSkew', () => {
    it('should return null when clock is within tolerance', () => {
      const serverTime = Date.now();

      const result = conflictResolver.checkClockSkew(serverTime);

      expect(result).toBeNull();
    });

    it('should return warning when clock skew exceeds tolerance', () => {
      const serverTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago

      const result = conflictResolver.checkClockSkew(serverTime);

      expect(result).not.toBeNull();
      expect(result).toContain('clock');
      expect(result).toContain('Warning');
    });

    it('should calculate correct skew in seconds', () => {
      const serverTime = Date.now() - (6 * 60 * 1000); // 6 minutes ago (exceeds 5 min tolerance)

      const result = conflictResolver.checkClockSkew(serverTime);

      expect(result).not.toBeNull();
      expect(result).toContain('360'); // ~360 seconds
    });
  });

  describe('prepareForSync', () => {
    it('should prepare local data for sync with timestamp', () => {
      const data = { updatedAt: 1700000000000 };

      const result = conflictResolver.prepareForSync(data);

      expect(result.data).toEqual(data);
      expect(result.timestamp).toBe(1700000000000);
    });
  });
});
