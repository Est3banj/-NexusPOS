/**
 * NetworkStatusService Unit Tests
 * 
 * Tests for online/offline detection using navigator.onLine and events.
 */

// These tests use jest-environment-jsdom which provides window/navigator

import { networkStatusService } from '../../services/networkStatusService';

describe('NetworkStatusService', () => {
  let originalOnLine: boolean;
  
  beforeEach(() => {
    // Save original navigator.onLine
    originalOnLine = navigator.onLine;
    jest.clearAllMocks();
    
    // Reset the service state between tests
    (networkStatusService as any)._state.initialized = false;
    (networkStatusService as any)._state.listeners = [];
    (networkStatusService as any)._state.status = 'online';
  });

  afterEach(() => {
    // Restore original navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true
    });
  });

  describe('init', () => {
    it('should initialize with current navigator.onLine status', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });
      
      networkStatusService.init();
      expect(networkStatusService.getStatus()).toBe('online');
    });

    it('should initialize as offline when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });
      
      networkStatusService.init();
      expect(networkStatusService.getStatus()).toBe('offline');
    });

    it('should only initialize once', () => {
      networkStatusService.init();
      const listenersAdded = (window.addEventListener as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0] === 'online' || call[0] === 'offline'
      ).length;
      
      // Should have added listeners only on first init
      expect(listenersAdded).toBe(2);
    });

    it('should set up event listeners for online and offline', () => {
      networkStatusService.init();
      
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('getStatus', () => {
    it('should return online when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });

      const status = networkStatusService.getStatus();
      expect(status).toBe('online');
    });

    it('should return offline when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      const status = networkStatusService.getStatus();
      expect(status).toBe('offline');
    });

    it('should auto-initialize if not initialized', () => {
      (networkStatusService as any)._state.initialized = false;

      networkStatusService.getStatus();

      expect((networkStatusService as any)._state.initialized).toBe(true);
    });
  });

  describe('isOnline', () => {
    it('should return true when online', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });

      expect(networkStatusService.isOnline()).toBe(true);
    });

    it('should return false when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      expect(networkStatusService.isOnline()).toBe(false);
    });
  });

  describe('isOffline', () => {
    it('should return false when online', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });

      expect(networkStatusService.isOffline()).toBe(false);
    });

    it('should return true when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      expect(networkStatusService.isOffline()).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return current network state', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true
      });

      const state = networkStatusService.getState();
      expect(state.status).toBe('online');
    });
  });

  describe('subscribe', () => {
    it('should add listener and return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = networkStatusService.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should auto-initialize if not initialized', () => {
      (networkStatusService as any)._state.initialized = false;

      networkStatusService.subscribe(jest.fn());

      expect((networkStatusService as any)._state.initialized).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should remove event listeners', () => {
      networkStatusService.init();
      networkStatusService.destroy();

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should clear listeners array', () => {
      networkStatusService.subscribe(jest.fn());
      networkStatusService.destroy();

      expect((networkStatusService as any)._state.listeners).toHaveLength(0);
    });

    it('should set initialized to false', () => {
      networkStatusService.init();
      networkStatusService.destroy();

      expect((networkStatusService as any)._state.initialized).toBe(false);
    });
  });

  describe('verifyConnectivity', () => {
    beforeEach(() => {
      globalThis.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return false if navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true
      });

      const result = await networkStatusService.verifyConnectivity();
      expect(result).toBe(false);
    });

    it('should return true if fetch succeeds', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true
      });

      const result = await networkStatusService.verifyConnectivity();
      expect(result).toBe(true);
    });

    it('should return false if fetch fails', async () => {
      (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await networkStatusService.verifyConnectivity();
      expect(result).toBe(false);
    });

    it('should return false if response is not ok', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await networkStatusService.verifyConnectivity();
      expect(result).toBe(false);
    });

    it('should use custom URL and timeout', async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await networkStatusService.verifyConnectivity('/api/health', 3000);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/health',
        expect.objectContaining({
          method: 'HEAD',
          signal: expect.any(AbortSignal)
        })
      );
    });
  });

  describe('addPosListener', () => {
    it('should add listener for custom POS network event', () => {
      const callback = jest.fn();
      const unsubscribe = networkStatusService.addPosListener(callback);

      expect(window.addEventListener).toHaveBeenCalledWith(
        'pos:network-status',
        expect.any(Function)
      );

      unsubscribe();
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = networkStatusService.addPosListener(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });
});
