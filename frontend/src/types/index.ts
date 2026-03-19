/**
 * TypeScript Interfaces for Offline-First POS
 * 
 * Defines all data models used in the IndexedDB stores
 * and sync queue operations.
 */

// ============================================================================
// Product Model
// ============================================================================

export interface Product {
  id?: number;
  localId?: string;           // UUID for offline identification
  name: string;
  description?: string;
  category: string;
  price: number;
  cost: number;              // wholesale/unit cost for profit calculations
  stock: number;
  barcode?: string;           // UPC/EAN code for scanning
  imageUrl?: string;
  createdAt: number;           // timestamp (local or server)
  updatedAt: number;           // timestamp for LWW conflict resolution
  serverUpdatedAt?: number;   // server timestamp after sync
  synced: boolean;             // true = confirmed on server
  pendingSync?: boolean;      // true = awaiting sync (alias for !synced)
  deleted?: boolean;           // soft delete flag for offline deletions
}

// ============================================================================
// Sale Item Model
// ============================================================================

export interface SaleItem {
  productId: number;
  localProductId?: string;     // for offline references
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// ============================================================================
// Sale Model
// ============================================================================

export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface Sale {
  id?: number;
  localId?: string;           // UUID for offline identification
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  sessionId?: number;         // Link to cash session for cash payments
  createdAt: number;           // timestamp
  updatedAt: number;           // timestamp for LWW
  serverUpdatedAt?: number;   // server timestamp after sync
  synced: boolean;
  pendingSync?: boolean;
  deleted?: boolean;
}

// ============================================================================
// Sync Queue Item Model
// ============================================================================

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'pending' | 'processing' | 'failed' | 'completed';
export type SyncTable = 'products' | 'sales';

export interface SyncQueueItem {
  id?: number;
  table: SyncTable;
  operation: SyncOperation;
  recordId: number;
  localId?: string;           // for CREATE operations
  payload: object;            // the data being synced
  timestamp: number;         // when the operation was created
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: number;       // timestamp for next retry attempt
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  serverTime?: number;        // server timestamp for clock sync
}

export interface ConflictResponse<T> {
  conflict: true;
  serverData: T;
  serverTime: number;
  message: string;
}

// ============================================================================
// Network Status Types
// ============================================================================

export type NetworkStatus = 'online' | 'offline';
export type SyncStatusState = 'idle' | 'syncing' | 'error' | 'warning';

export interface NetworkState {
  status: NetworkStatus;
  lastOnline?: number;
}

export interface SyncState {
  status: SyncStatusState;
  pendingCount: number;
  lastSyncAt?: number;
  error?: string;
}

// ============================================================================
// Configuration Types (re-export from config)
// ============================================================================

export interface SyncConfig {
  clockSkewTolerance: number;
  syncFrequency: number;
  maxQueueSize: number;
  maxRetryCount: number;
  retryDelays: number[];
}

// ============================================================================
// User & Authentication Types
// ============================================================================

export type UserRole = 'ADMIN' | 'EMPLOYEE';

export interface User {
  id?: number;
  username: string;
  password: string; // plain for demo, would be hashed in production
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

// User without password (for client-side use)
export interface UserWithoutPassword {
  id?: number;
  username: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

// Auth session state (stored in localStorage)
export interface AuthSession {
  userId: number;
  username: string;
  role: UserRole;
  token: string; // JWT token
  expiresAt: number; // timestamp when session expires
}

// Auth context type
export interface AuthState {
  user: UserWithoutPassword | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserWithoutPassword;
  error?: string;
}

// ============================================================================
// Cash Session Types
// ============================================================================

export type CashSessionStatus = 'open' | 'closed';

export interface CashSession {
  id?: number;
  openedBy: number; // user id
  openedAt: number;
  closedAt?: number;
  initialCash: number;
  actualCash?: number;
  expectedCash?: number;
  difference?: number;
  totalCashSales: number;
  totalCardSales: number;
  totalTransferSales: number;
  status: CashSessionStatus;
}
