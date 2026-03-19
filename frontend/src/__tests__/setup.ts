/**
 * Jest Test Setup
 * 
 * Provides global mocks and setup for all tests.
 */

import '@testing-library/jest-dom';

// Mock IndexedDB for jsdom environment
import 'fake-indexeddb/auto';

// Mock crypto.randomUUID for tests
const originalCrypto = globalThis.crypto;

// Create a mock crypto with randomUUID
const mockCrypto = {
  ...originalCrypto,
  randomUUID: () => `test-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  subtle: originalCrypto?.subtle,
  getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto)
};

Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Mock structuredClone (needed by fake-indexeddb)
if (typeof globalThis.structuredClone === 'undefined') {
  (globalThis as any).structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Mock fetch for API tests
globalThis.fetch = jest.fn();

// Mock window.addEventListener and window.removeEventListener
const originalAddEventListener = window.addEventListener.bind(window);
const originalRemoveEventListener = window.removeEventListener.bind(window);
const eventListeners: Record<string, Set<EventListener>> = {
  online: new Set(),
  offline: new Set(),
  'pos:network-status': new Set()
};

(window as any).addEventListener = jest.fn((event: string, listener: EventListener) => {
  if (!eventListeners[event]) {
    eventListeners[event] = new Set();
  }
  eventListeners[event].add(listener);
  originalAddEventListener(event, listener);
});

(window as any).removeEventListener = jest.fn((event: string, listener: EventListener) => {
  if (eventListeners[event]) {
    eventListeners[event].delete(listener);
  }
  originalRemoveEventListener(event, listener);
});

(window as any).dispatchEvent = jest.fn((event: Event) => {
  if (eventListeners[event.type]) {
    eventListeners[event.type].forEach(listener => listener.call(window, event));
  }
  return true;
});

// Mock window.navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Jest configuration
export {};
