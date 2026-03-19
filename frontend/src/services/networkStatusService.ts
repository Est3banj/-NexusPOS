/**
 * Network Status Service
 * 
 * Provides online/offline detection using navigator.onLine
 * and network change event listeners.
 */

import type { NetworkStatus, NetworkState } from '../types';

/**
 * Callback type for network status changes
 */
type NetworkStatusCallback = (status: NetworkStatus) => void;

/**
 * Network Status Service
 * 
 * Manages network connectivity detection and event handling.
 * Uses navigator.onLine and 'online'/'offline' window events.
 */
export const networkStatusService = {
  /**
   * Current network state
   */
  _state: {
    status: 'online' as NetworkStatus,
    lastOnline: undefined as number | undefined,
    listeners: [] as NetworkStatusCallback[]
  } as {
    status: NetworkStatus;
    lastOnline?: number;
    listeners: NetworkStatusCallback[];
    initialized: boolean;
  },
  
  /**
   * Initialize network status detection
   * Sets up event listeners for online/offline events
   */
  init(): void {
    if (this._state.initialized) return;
    
    // Set initial status
    this._state.status = navigator.onLine ? 'online' : 'offline';
    this._state.initialized = true;
    
    // Listen for online event
    window.addEventListener('online', this._handleOnline);
    
    // Listen for offline event
    window.addEventListener('offline', this._handleOffline);
    
    console.log(`[NetworkStatus] Initialized, status: ${this._state.status}`);
  },
  
  /**
   * Handle online event
   */
  _handleOnline() {
    const now = Date.now();
    this._state.status = 'online';
    this._state.lastOnline = now;
    
    console.log('[NetworkStatus] Connection restored');
    
    // Notify all listeners
    this._notifyListeners('online');
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('pos:network-status', {
      detail: { status: 'online', lastOnline: now }
    }));
  },
  
  /**
   * Handle offline event
   */
  _handleOffline() {
    this._state.status = 'offline';
    
    console.log('[NetworkStatus] Connection lost');
    
    // Notify all listeners
    this._notifyListeners('offline');
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('pos:network-status', {
      detail: { status: 'offline' }
    }));
  },
  
  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    // Ensure we're initialized
    if (!this._state.initialized) {
      this.init();
    }
    return navigator.onLine ? 'online' : 'offline';
  },
  
  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.getStatus() === 'online';
  },
  
  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.getStatus() === 'offline';
  },
  
  /**
   * Get full network state
   */
  getState(): NetworkState {
    return {
      status: this.getStatus(),
      lastOnline: this._state.lastOnline
    };
  },
  
  /**
   * Subscribe to network status changes
   * @param callback - Function to call when status changes
   * @returns Unsubscribe function
   */
  subscribe(callback: NetworkStatusCallback): () => void {
    // Ensure initialized
    if (!this._state.initialized) {
      this.init();
    }
    
    this._state.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this._state.listeners.indexOf(callback);
      if (index > -1) {
        this._state.listeners.splice(index, 1);
      }
    };
  },
  
  /**
   * Notify all listeners of status change
   */
  _notifyListeners(status: NetworkStatus): void {
    this._state.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[NetworkStatus] Listener error:', error);
      }
    });
  },
  
  /**
   * Clean up event listeners
   * Call this when the app is unmounting
   */
  destroy(): void {
    window.removeEventListener('online', this._handleOnline);
    window.removeEventListener('offline', this._handleOffline);
    this._state.listeners = [];
    this._state.initialized = false;
    
    console.log('[NetworkStatus] Destroyed');
  },
  
  /**
   * Add a listener for the custom POS network event
   * @param callback - Function to call when POS network status changes
   * @returns Unsubscribe function
   */
  addPosListener(callback: (event: CustomEvent<{ status: NetworkStatus; lastOnline?: number }>) => void): () => void {
    window.addEventListener('pos:network-status', callback as EventListener);
    
    return () => {
      window.removeEventListener('pos:network-status', callback as EventListener);
    };
  },
  
  /**
   * Attempt to verify connectivity by making a lightweight request
   * @param url - URL to check (default: /api/health)
   * @param timeout - Timeout in ms (default: 5000)
   * @returns Promise that resolves to true if reachable
   */
  async verifyConnectivity(url = '/api/health', timeout = 5000): Promise<boolean> {
    if (!navigator.onLine) {
      return false;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('[NetworkStatus] Connectivity check failed:', error);
      return false;
    }
  }
};

// Auto-initialize when imported in a browser environment
if (typeof window !== 'undefined') {
  networkStatusService.init();
}

export default networkStatusService;
