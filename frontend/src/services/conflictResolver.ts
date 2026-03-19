/**
 * Conflict Resolver Service
 * 
 * Implements Last Write Wins (LWW) conflict resolution strategy
 * using server timestamps as the authoritative source.
 */

import type { Product, Sale } from '../types';
import { CLOCK_SKEW_TOLERANCE } from '../config/syncConfig';

/**
 * Conflict types
 */
export type ConflictType = 'product' | 'sale';

/**
 * Conflict result
 */
export interface ConflictResult<T> {
  resolved: boolean;
  winner: 'local' | 'server' | 'merge';
  localData?: T;
  serverData?: T;
  mergedData?: T;
  message?: string;
}

/**
 * Conflict Resolver Service
 * 
 * Uses Last Write Wins (LWW) strategy:
 * - If local timestamp > server timestamp → local wins
 * - If local timestamp <= server timestamp → server wins
 * - If timestamps are equal (within 1 second) → server wins
 */
export const conflictResolver = {
  /**
   * Resolve conflict for a product
   * 
   * @param localProduct - The local version of the product
   * @param serverProduct - The server version of the product
   * @param serverTime - Current server timestamp
   */
  resolveProduct(
    localProduct: Product,
    serverProduct: Product,
    serverTime: number
  ): ConflictResult<Product> {
    const localTimestamp = localProduct.updatedAt;
    const serverTimestamp = serverProduct.updatedAt;
    
    // Check for clock skew
    const clientTime = Date.now();
    const skew = Math.abs(clientTime - serverTime);
    const hasClockSkew = skew > CLOCK_SKEW_TOLERANCE;
    
    if (hasClockSkew) {
      console.warn('[ConflictResolver] Clock skew detected, using server as authoritative');
    }
    
    // Last Write Wins logic
    // If local timestamp is GREATER than server timestamp, local wins
    // If equal or less, server wins
    if (localTimestamp > serverTimestamp) {
      return {
        resolved: true,
        winner: 'local',
        localData: localProduct,
        serverData: serverProduct,
        message: 'Local changes accepted (newer timestamp)'
      };
    } else if (localTimestamp === serverTimestamp) {
      // Same timestamp - server wins (deterministic choice)
      return {
        resolved: true,
        winner: 'server',
        localData: localProduct,
        serverData: serverProduct,
        message: 'Server data accepted (equal timestamp, server wins)'
      };
    } else {
      // Server has newer timestamp - server wins
      return {
        resolved: true,
        winner: 'server',
        localData: localProduct,
        serverData: serverProduct,
        message: 'Server data accepted (newer timestamp)'
      };
    }
  },
  
  /**
   * Resolve conflict for a sale
   * 
   * @param localSale - The local version of the sale
   * @param serverSale - The server version of the sale
   * @param serverTime - Current server timestamp
   */
  resolveSale(
    localSale: Sale,
    serverSale: Sale,
    serverTime: number
  ): ConflictResult<Sale> {
    const localTimestamp = localSale.updatedAt;
    const serverTimestamp = serverSale.updatedAt;
    
    // Check for clock skew
    const clientTime = Date.now();
    const skew = Math.abs(clientTime - serverTime);
    const hasClockSkew = skew > CLOCK_SKEW_TOLERANCE;
    
    if (hasClockSkew) {
      console.warn('[ConflictResolver] Clock skew detected, using server as authoritative');
    }
    
    // Last Write Wins logic for sales
    if (localTimestamp > serverTimestamp) {
      return {
        resolved: true,
        winner: 'local',
        localData: localSale,
        serverData: serverSale,
        message: 'Local sale accepted (newer timestamp)'
      };
    } else if (localTimestamp === serverTimestamp) {
      return {
        resolved: true,
        winner: 'server',
        localData: localSale,
        serverData: serverSale,
        message: 'Server sale accepted (equal timestamp, server wins)'
      };
    } else {
      return {
        resolved: true,
        winner: 'server',
        localData: localSale,
        serverData: serverSale,
        message: 'Server sale accepted (newer timestamp)'
      };
    }
  },
  
  /**
   * Generic conflict resolution for any entity type
   * 
   * @param entityType - Type of entity ('product' or 'sale')
   * @param localData - Local version
   * @param serverData - Server version
   * @param serverTime - Current server timestamp
   */
  resolve<T extends Product | Sale>(
    entityType: ConflictType,
    localData: T,
    serverData: T,
    serverTime: number
  ): ConflictResult<T> {
    if (entityType === 'product') {
      return this.resolveProduct(localData as Product, serverData as Product, serverTime) as ConflictResult<T>;
    } else {
      return this.resolveSale(localData as Sale, serverData as Sale, serverTime) as ConflictResult<T>;
    }
  },
  
  /**
   * Determine if a conflict should be reported to the user
   * Only report if server won (user lost local changes)
   */
  shouldNotifyUser<T>(result: ConflictResult<T>): boolean {
    return result.winner === 'server' && result.localData !== undefined;
  },
  
  /**
   * Generate a user-friendly conflict notification message
   */
  getConflictNotificationMessage<T>(result: ConflictResult<T>, entityType: string): string {
    if (result.winner === 'server') {
      return `Some local changes to ${entityType} were overwritten by server data.`;
    }
    return '';
  },
  
  /**
   * Check for clock skew and return warning if needed
   * 
   * @param serverTime - Server timestamp from API response
   * @returns Warning message if clock skew exceeds tolerance
   */
  checkClockSkew(serverTime: number): string | null {
    const clientTime = Date.now();
    const skew = Math.abs(clientTime - serverTime);
    
    if (skew > CLOCK_SKEW_TOLERANCE) {
      const skewSeconds = Math.round(skew / 1000);
      return `Warning: Your device clock is off by ${skewSeconds} seconds. This may affect conflict resolution. Please sync your device time.`;
    }
    
    return null;
  },
  
  /**
   * Prepare local data for server submission
   * Adds necessary metadata for conflict detection
   */
  prepareForSync<T extends { updatedAt: number }>(localData: T): {
    data: T;
    timestamp: number;
  } {
    return {
      data: localData,
      timestamp: localData.updatedAt
    };
  }
};

export default conflictResolver;
