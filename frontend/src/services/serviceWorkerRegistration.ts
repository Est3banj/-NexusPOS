/**
 * Service Worker Registration Service
 * 
 * Handles Service Worker registration, updates, and lifecycle management.
 * Provides registration, unregistration, and update handling.
 */

/**
 * Service Worker registration state
 */
export interface SWRegistrationState {
  registered: boolean;
  updating: boolean;
  version?: string;
  error?: string;
}

/**
 * Service Worker update callback
 */
type SWUpdateCallback = (registration: ServiceWorkerRegistration) => void;

/**
 * Service Worker Registration Service
 * 
 * Manages Service Worker lifecycle:
 * - Registration on app start
 * - Update detection and handling
 * - Unregistration for cleanup
 */
export const serviceWorkerRegistration = {
  /**
   * Current registration
   */
  _registration: null as ServiceWorkerRegistration | null,
  
  /**
   * Registration state
   */
  _state: {
    registered: false,
    updating: false,
    version: undefined as string | undefined,
    error: undefined as string | undefined
  } as SWRegistrationState,
  
  /**
   * Update callbacks
   */
  _updateCallbacks: [] as SWUpdateCallback[],
  
  /**
   * Get the Service Worker URL based on environment
   */
  _getSWUrl(): string {
    if (import.meta.env.MODE === 'development') {
      return '/service-worker/sw.ts';
    }
    return '/service-worker.js';
  },
  
  /**
   * Register the Service Worker
   * 
   * @param onUpdate - Optional callback when SW updates are available
   * @returns Registration result
   */
  async register(onUpdate?: SWUpdateCallback): Promise<ServiceWorkerRegistration | null> {
    // Check if Service Workers are supported
    if (!('serviceWorker' in navigator)) {
      const error = 'Service Workers are not supported in this browser';
      console.warn(`[SWRegistration] ${error}`);
      this._state.error = error;
      return null;
    }
    
    try {
      const registration = await navigator.serviceWorker.register(this._getSWUrl(), {
        scope: '/'
      });
      
      this._registration = registration;
      this._state.registered = true;
      this._state.error = undefined;
      
      console.log(`[SWRegistration] Registered successfully, scope: ${registration.scope}`);
      
      // Set up update handling
      this._setupUpdateHandler(registration);
      
      // Register onUpdate callback if provided
      if (onUpdate) {
        this._updateCallbacks.push(onUpdate);
      }
      
      // Check for existing update
      if (registration.active) {
        this._getSWVersion(registration);
      }
      
      return registration;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SWRegistration] Registration failed:`, errorMessage);
      this._state.error = errorMessage;
      return null;
    }
  },
  
  /**
   * Set up update handler
   */
  _setupUpdateHandler(registration: ServiceWorkerRegistration): void {
    // Listen for install event
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New update available
              console.log('[SWRegistration] New version available');
              this._state.updating = true;
              
              // Notify callbacks
              this._notifyUpdate(registration);
            } else {
              // First install
              console.log('[SWRegistration] Service Worker installed for the first time');
            }
          }
        });
      }
    });
  },
  
  /**
   * Notify all update callbacks
   */
  _notifyUpdate(registration: ServiceWorkerRegistration): void {
    this._updateCallbacks.forEach(callback => {
      try {
        callback(registration);
      } catch (error) {
        console.error('[SWRegistration] Update callback error:', error);
      }
    });
  },
  
  /**
   * Get Service Worker version
   */
  async _getSWVersion(registration: ServiceWorkerRegistration): Promise<string | undefined> {
    try {
      // Try to get version from the SW
      const response = await new Promise<{ version?: string }>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => resolve(event.data);
        registration.active?.postMessage(
          { type: 'GET_VERSION' },
          [channel.port2]
        );
        
        // Timeout after 2 seconds
        setTimeout(() => resolve({}), 2000);
      });
      
      this._state.version = response.version;
      return response.version;
    } catch (error) {
      console.warn('[SWRegistration] Could not get SW version:', error);
      return undefined;
    }
  },
  
  /**
   * Get current registration
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this._registration;
  },
  
  /**
   * Get current registration state
   */
  getState(): SWRegistrationState {
    return { ...this._state };
  },
  
  /**
   * Check if Service Worker is registered
   */
  isRegistered(): boolean {
    return this._state.registered;
  },
  
  /**
   * Check if update is available
   */
  isUpdateAvailable(): boolean {
    return this._state.updating;
  },
  
  /**
   * Trigger update check
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this._registration) {
      console.warn('[SWRegistration] No registration to update');
      return false;
    }
    
    try {
      await this._registration.update();
      return true;
    } catch (error) {
      console.error('[SWRegistration] Update check failed:', error);
      return false;
    }
  },
  
  /**
   * Skip waiting and activate new version
   * Call this when user accepts the update
   */
  async skipWaiting(): Promise<boolean> {
    if (!this._registration) {
      return false;
    }
    
    try {
      await this._registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      this._state.updating = false;
      return true;
    } catch (error) {
      console.error('[SWRegistration] Skip waiting failed:', error);
      return false;
    }
  },
  
  /**
   * Unregister the Service Worker
   * Use this to disable offline functionality
   */
  async unregister(): Promise<boolean> {
    if (!this._registration) {
      console.warn('[SWRegistration] No registration to unregister');
      return false;
    }
    
    try {
      const success = await this._registration.unregister();
      
      if (success) {
        this._registration = null;
        this._state.registered = false;
        this._state.version = undefined;
        console.log('[SWRegistration] Unregistered successfully');
        
        // Clear caches
        await this._clearCaches();
      }
      
      return success;
    } catch (error) {
      console.error('[SWRegistration] Unregister failed:', error);
      return false;
    }
  },
  
  /**
   * Clear all POS caches
   */
  async _clearCaches(): Promise<void> {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('pos-'))
          .map(name => caches.delete(name))
      );
      console.log('[SWRegistration] Caches cleared');
    } catch (error) {
      console.error('[SWRegistration] Cache clear failed:', error);
    }
  },
  
  /**
   * Add update callback
   */
  onUpdate(callback: SWUpdateCallback): () => void {
    this._updateCallbacks.push(callback);
    
    return () => {
      const index = this._updateCallbacks.indexOf(callback);
      if (index > -1) {
        this._updateCallbacks.splice(index, 1);
      }
    };
  }
};

export default serviceWorkerRegistration;
