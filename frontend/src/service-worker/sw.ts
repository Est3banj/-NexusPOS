/**
 * Service Worker with Workbox Precaching
 * 
 * Handles offline asset caching and provides fallback strategies
 * for network requests when offline.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { CACHE_NAME, RUNTIME_CACHE_NAME, API_BASE_URL } from '../config/syncConfig';

// ============================================================================
// Precache Configuration
// ============================================================================

// Workbox automatically injects the precache manifest
// This list is generated at build time from the webpack assets
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);

// ============================================================================
// Cleanup Old Caches
// ============================================================================

// Clean up old caches from previous versions
cleanupOutdatedCaches();

// ============================================================================
// Caching Strategies
// ============================================================================

/**
 * Cache-First strategy for static assets that don't change often
 * (images, fonts, icons)
 */
registerRoute(
  ({ request, url }) => {
    const isImage = url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/i);
    const isFont = url.pathname.match(/\.(woff2?|ttf|otf|eot)$/i);
    return isImage || isFont;
  },
  new CacheFirst({
    cacheName: RUNTIME_CACHE_NAME,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

/**
 * Stale-While-Revalidate for JavaScript and CSS bundles
 * Serve from cache immediately, then update cache in background
 */
registerRoute(
  ({ request }) => request.destination === 'script' || 
                   request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: RUNTIME_CACHE_NAME
  })
);

/**
 * Network-First for HTML documents
 * Try network first, fall back to cache if offline
 */
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: RUNTIME_CACHE_NAME,
    networkTimeoutSeconds: 3
  })
);

/**
 * Network-First for API calls with IndexedDB fallback
 * This is handled by the background sync handler in backgroundSync.ts
 * This route catches any API requests that bypass the sync queue
 */
registerRoute(
  ({ url }) => url.pathname.startsWith('/api'),
  new NetworkFirst({
    cacheName: `${RUNTIME_CACHE_NAME}-api`,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      })
    ]
  })
);

// ============================================================================
// Service Worker Lifecycle Events
// ============================================================================

/**
 * Install event - cache additional resources
 */
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Installing...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Activating...');
  
  // Claim clients to start controlling pages immediately
  self.clients.claim();
});

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event: MessageEvent) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_NAME });
      break;
      
    case 'CLEAR_CACHE':
      clearRuntimeCache().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    default:
      console.warn('[ServiceWorker] Unknown message type:', type);
  }
});

/**
 * Clear all runtime caches
 */
async function clearRuntimeCache(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith('pos-'))
      .map(name => caches.delete(name))
  );
}

// ============================================================================
// TypeScript declarations for Workbox
// ============================================================================

interface ExtendableEvent extends Event {
  waitUntil(fn: Promise<any>): void;
  readonly request: Request;
}

interface CacheName {
  readonly [key: string]: any;
}

interface MessageEvent extends Event {
  data: any;
  ports: MessagePort[];
}

// Workbox plugin interfaces
declare class CacheableResponsePlugin {
  constructor(options?: { statuses?: number[] });
}

declare class ExpirationPlugin {
  constructor(options?: { 
    maxEntries?: number; 
    maxAgeSeconds?: number;
    purgeOnQuotaError?: boolean;
  });
}
