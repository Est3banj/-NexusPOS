/**
 * Main Entry Point - POS Frontend
 * 
 * Initializes the offline-first POS application:
 * - Database initialization
 * - Service Worker registration
 * - Network status monitoring
 */

import { db } from './db/index';
import serviceWorkerRegistration from './services/serviceWorkerRegistration';
import networkStatusService from './services/networkStatusService';
import syncQueueService from './services/syncQueueService';

/**
 * Initialize the POS application
 * 
 * This function sets up:
 * 1. IndexedDB via Dexie.js (already created on import)
 * 2. Service Worker for offline asset caching
 * 3. Network status monitoring
 * 4. Periodic sync queue processing
 */
export async function initializeApp(): Promise<void> {
  console.log('[App] Initializing POS application...');
  
  // 1. Initialize database (Dexie.js creates tables on import)
  // The db instance is already set up in ./db/index.ts
  console.log('[App] Database initialized');
  
  // 2. Register Service Worker
  const swRegistration = await serviceWorkerRegistration.register((registration) => {
    console.log('[App] Service Worker update available');
    
    // Optional: Show update prompt to user
    // For now, we'll auto-update
    serviceWorkerRegistration.skipWaiting();
  });
  
  if (swRegistration) {
    console.log('[App] Service Worker registered successfully');
  } else {
    console.warn('[App] Service Worker registration failed - running in online-only mode');
  }
  
  // 3. Initialize network status monitoring
  networkStatusService.init();
  
  // Listen for network changes to trigger sync
  networkStatusService.subscribe(async (status) => {
    if (status === 'online') {
      console.log('[App] Network online - starting sync...');
      await processSyncQueue();
    } else {
      console.log('[App] Network offline - sync paused');
    }
  });
  
  // 4. Set up periodic sync when online
  // Sync every 10 seconds when connected
  const SYNC_INTERVAL = 10000; // 10 seconds
  let syncIntervalId: number | undefined;
  
  const startPeriodicSync = () => {
    if (syncIntervalId) return;
    
    syncIntervalId = window.setInterval(async () => {
      if (networkStatusService.isOnline()) {
        await processSyncQueue();
      }
    }, SYNC_INTERVAL);
    
    console.log(`[App] Periodic sync started (every ${SYNC_INTERVAL}ms)`);
  };
  
  // Start periodic sync
  startPeriodicSync();
  
  // Initial sync on startup if online
  if (networkStatusService.isOnline()) {
    await processSyncQueue();
  }
  
  console.log('[App] POS application initialized');
}

/**
 * Process the sync queue
 * Sends pending operations to the server
 */
async function processSyncQueue(): Promise<void> {
  const pendingCount = await syncQueueService.getPendingCount();
  
  if (pendingCount === 0) {
    return;
  }
  
  console.log(`[App] Processing sync queue (${pendingCount} items)`);
  
  // This is a placeholder - in a real app, you'd have an API client
  // that knows how to handle each operation type
  await syncQueueService.processQueue(async (item) => {
    try {
      // Example API call structure:
      // const response = await fetch(`/api/${item.table}`, {
      //   method: item.operation === 'CREATE' ? 'POST' : 
      //          item.operation === 'UPDATE' ? 'PUT' : 'DELETE',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(item.payload)
      // });
      
      // For now, simulate success
      console.log(`[App] Synced: ${item.operation} ${item.table}#${item.recordId}`);
      
      return { 
        success: true, 
        serverTime: Date.now() 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });
}

/**
 * Get app initialization state
 */
export function getAppState() {
  return {
    db: db.name,
    sw: serviceWorkerRegistration.getState(),
    network: networkStatusService.getState()
  };
}

// Auto-initialize when running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeApp());
  } else {
    initializeApp();
  }
}

export default { initializeApp, getAppState };
