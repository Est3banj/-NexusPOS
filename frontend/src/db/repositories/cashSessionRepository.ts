/**
 * Cash Session Repository - IndexedDB Operations
 * 
 * Provides CRUD operations for cash sessions using Dexie.js.
 * Manages open/close workflow for cash drawer sessions.
 */

import { db } from '../index';
import type { CashSession, CashSessionStatus } from '../../types';

/**
 * Generate a UUID for offline identification
 */
function generateLocalId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the current timestamp
 */
function getTimestamp(): number {
  return Date.now();
}

/**
 * Cash Session Repository
 * 
 * Handles all cash session CRUD operations against IndexedDB.
 * Manages the open/close workflow for cash drawer tracking.
 */
export const cashSessionRepository = {
  /**
   * Create a new cash session (open the cash drawer)
   * @param openedBy - User ID who is opening the session
   * @param initialCash - Initial cash amount in the drawer
   */
  async openSession(openedBy: number, initialCash: number): Promise<number> {
    const now = getTimestamp();
    
    const newSession: CashSession = {
      openedBy,
      openedAt: now,
      initialCash,
      totalCashSales: 0,
      totalCardSales: 0,
      totalTransferSales: 0,
      status: 'open'
    };
    
    const id = await db.cashSessions.add(newSession);
    return id;
  },
  
  /**
   * Close an existing cash session
   * @param id - Session ID
   * @param actualCash - Actual cash counted in the drawer
   */
  async closeSession(id: number, actualCash: number): Promise<void> {
    const session = await db.cashSessions.get(id);
    if (!session) {
      throw new Error('Cash session not found');
    }
    
    if (session.status === 'closed') {
      throw new Error('Cash session is already closed');
    }
    
    // Calculate expected cash: initial + cash sales - cash outs (if any)
    const expectedCash = session.initialCash + session.totalCashSales;
    const difference = actualCash - expectedCash;
    
    const now = getTimestamp();
    
    await db.cashSessions.update(id, {
      closedAt: now,
      actualCash,
      expectedCash,
      difference,
      status: 'closed'
    });
  },
  
  /**
   * Get all cash sessions
   */
  async getAll(): Promise<CashSession[]> {
    return db.cashSessions.orderBy('openedAt').reverse().toArray();
  },
  
  /**
   * Get a session by ID
   */
  async getById(id: number): Promise<CashSession | undefined> {
    return db.cashSessions.get(id);
  },
  
  /**
   * Get the currently open session (if any)
   */
  async getOpenSession(): Promise<CashSession | undefined> {
    return db.cashSessions
      .where('status')
      .equals('open')
      .first();
  },
  
  /**
   * Get the most recent closed session
   */
  async getLastClosedSession(): Promise<CashSession | undefined> {
    return db.cashSessions
      .where('status')
      .equals('closed')
      .reverse()
      .sortBy('closedAt')
      .then(sessions => sessions[0]);
  },
  
  /**
   * Get sessions by status
   */
  async getByStatus(status: CashSessionStatus): Promise<CashSession[]> {
    return db.cashSessions
      .where('status')
      .equals(status)
      .toArray();
  },
  
  /**
   * Get sessions by user (who opened them)
   */
  async getByUser(openedBy: number): Promise<CashSession[]> {
    return db.cashSessions
      .where('openedBy')
      .equals(openedBy)
      .toArray();
  },
  
  /**
   * Get sessions by date range
   */
  async queryByDateRange(startDate: number, endDate: number): Promise<CashSession[]> {
    return db.cashSessions
      .where('openedAt')
      .between(startDate, endDate)
      .toArray();
  },
  
  /**
   * Update session sales totals
   * @param id - Session ID
   * @param paymentMethod - Payment method of the new sale
   * @param amount - Sale amount
   */
  async addSaleToSession(id: number, paymentMethod: 'cash' | 'card' | 'transfer', amount: number): Promise<void> {
    const session = await db.cashSessions.get(id);
    if (!session) {
      throw new Error('Cash session not found');
    }
    
    if (session.status !== 'open') {
      throw new Error('Cannot add sale to closed session');
    }
    
    const updateField: Partial<CashSession> = {};
    
    switch (paymentMethod) {
      case 'cash':
        updateField.totalCashSales = session.totalCashSales + amount;
        break;
      case 'card':
        updateField.totalCardSales = session.totalCardSales + amount;
        break;
      case 'transfer':
        updateField.totalTransferSales = session.totalTransferSales + amount;
        break;
    }
    
    await db.cashSessions.update(id, updateField);
  },
  
  /**
   * Get total sales for a session
   */
  async getTotalSales(id: number): Promise<number> {
    const session = await db.cashSessions.get(id);
    if (!session) return 0;
    
    return session.totalCashSales + session.totalCardSales + session.totalTransferSales;
  },
  
  /**
   * Check if there is an open session
   */
  async hasOpenSession(): Promise<boolean> {
    const count = await db.cashSessions.where('status').equals('open').count();
    return count > 0;
  },
  
  /**
   * Bulk create sessions (for initial sync from server)
   */
  async bulkCreate(sessions: CashSession[]): Promise<number[]> {
    return db.cashSessions.bulkAdd(sessions, { allKeys: true });
  }
};

export default cashSessionRepository;
