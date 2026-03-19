/**
 * useCashSession Hook
 * 
 * React hook for cash session management.
 * Provides open/close workflow and session state tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import type { CashSession } from '../types';
import { cashSessionRepository } from '../db/repositories/cashSessionRepository';
import { saleRepository } from '../db/repositories/saleRepository';
import { useAuth } from './useAuth';

export interface UseCashSessionReturn {
  // State
  currentSession: CashSession | null;
  sessions: CashSession[];
  loading: boolean;
  error: string | null;
  hasOpenSession: boolean;
  
  // Actions
  openSession: (initialCash: number) => Promise<number>;
  closeSession: (actualCash: number) => Promise<void>;
  refresh: () => Promise<void>;
  canProcessCashSale: () => { allowed: boolean; reason?: string };
}

export function useCashSession(): UseCashSessionReturn {
  const { user } = useAuth();
  
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOpenSession, setHasOpenSession] = useState<boolean>(false);
  
  // Load sessions and check for open session
  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load all sessions
      const allSessions = await cashSessionRepository.getAll();
      setSessions(allSessions);
      
      // Check for open session
      const open = await cashSessionRepository.getOpenSession();
      setCurrentSession(open || null);
      setHasOpenSession(!!open);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load cash sessions';
      setError(message);
      console.error('[useCashSession] Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Open a new cash session
  const openSession = useCallback(async (initialCash: number): Promise<number> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }
    
    setError(null);
    
    try {
      // Check if there's already an open session
      const hasOpen = await cashSessionRepository.hasOpenSession();
      if (hasOpen) {
        throw new Error('There is already an open cash session. Please close it first.');
      }
      
      const sessionId = await cashSessionRepository.openSession(user.id, initialCash);
      
      // Refresh to get the new session
      await loadSessions();
      
      return sessionId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open cash session';
      setError(message);
      throw err;
    }
  }, [user, loadSessions]);
  
  // Close the current cash session
  const closeSession = useCallback(async (actualCash: number): Promise<void> => {
    if (!currentSession?.id) {
      throw new Error('No open cash session');
    }
    
    setError(null);
    
    try {
      await cashSessionRepository.closeSession(currentSession.id, actualCash);
      
      // Refresh to clear current session
      await loadSessions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close cash session';
      setError(message);
      throw err;
    }
  }, [currentSession, loadSessions]);
  
  // Check if cash sales can be processed
  const canProcessCashSale = useCallback((): { allowed: boolean; reason?: string } => {
    if (!hasOpenSession) {
      return {
        allowed: false,
        reason: 'No hay una caja abierta. Abre la caja primero.'
      };
    }
    
    if (!currentSession || currentSession.status !== 'open') {
      return {
        allowed: false,
        reason: 'La caja está cerrada.'
      };
    }
    
    return { allowed: true };
  }, [hasOpenSession, currentSession]);
  
  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);
  
  return {
    // State
    currentSession,
    sessions,
    loading,
    error,
    hasOpenSession,
    
    // Actions
    openSession,
    closeSession,
    refresh: loadSessions,
    canProcessCashSale
  };
}

export default useCashSession;
