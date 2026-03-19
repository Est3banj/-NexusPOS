/**
 * Cash Session Service
 * 
 * Business logic layer for cash session operations.
 * Handles workflow orchestration between repositories.
 */

import { cashSessionRepository } from '../db/repositories/cashSessionRepository';
import { saleRepository } from '../db/repositories/saleRepository';
import type { CashSession, Sale } from '../types';

/**
 * Get or create the active cash session
 * @throws Error if no session is open
 */
export async function getActiveSession(): Promise<CashSession> {
  const session = await cashSessionRepository.getOpenSession();
  
  if (!session) {
    throw new Error('No hay una caja abierta');
  }
  
  return session;
}

/**
 * Process a sale and link it to the active cash session
 * Updates the session totals based on payment method
 */
export async function processSaleWithSession(
  saleData: {
    items: Sale['items'];
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: Sale['paymentMethod'];
  }
): Promise<{ saleId: number; sessionId: number }> {
  // Get active session
  const session = await getActiveSession();
  
  if (!session.id) {
    throw new Error('Invalid session ID');
  }
  
  // Create the sale (without sessionId first)
  const saleId = await saleRepository.create({
    items: saleData.items,
    subtotal: saleData.subtotal,
    tax: saleData.tax,
    total: saleData.total,
    paymentMethod: saleData.paymentMethod
  });
  
  // Link sale to session and update totals
  await cashSessionRepository.addSaleToSession(
    session.id,
    saleData.paymentMethod,
    saleData.total
  );
  
  // Update the sale with session ID
  await saleRepository.update(saleId, { sessionId: session.id });
  
  return { saleId, sessionId: session.id };
}

/**
 * Process a sale without requiring a cash session
 * (For non-cash payment methods or when no session is needed)
 */
export async function processSaleWithoutSession(
  saleData: {
    items: Sale['items'];
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: Sale['paymentMethod'];
  }
): Promise<number> {
  // For non-cash payments, we can optionally link to an open session
  // but it's not required
  const hasOpen = await cashSessionRepository.hasOpenSession();
  
  const saleId = await saleRepository.create(saleData);
  
  // If there's an open session, track the sale even for non-cash methods
  if (hasOpen) {
    const session = await cashSessionRepository.getOpenSession();
    if (session?.id) {
      await cashSessionRepository.addSaleToSession(
        session.id,
        saleData.paymentMethod,
        saleData.total
      );
      await saleRepository.update(saleId, { sessionId: session.id });
    }
  }
  
  return saleId;
}

/**
 * Get summary for closing a session
 */
export async function getSessionSummary(sessionId: number): Promise<{
  session: CashSession;
  expectedCash: number;
  salesCount: number;
  breakdown: {
    cash: number;
    card: number;
    transfer: number;
    total: number;
  };
}> {
  const session = await cashSessionRepository.getById(sessionId);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Calculate expected cash
  const expectedCash = session.initialCash + session.totalCashSales;
  
  // Get sales count for this session
  const allSales = await saleRepository.getAll();
  const sessionSales = allSales.filter(s => s.sessionId === sessionId);
  const salesCount = sessionSales.length;
  
  return {
    session,
    expectedCash,
    salesCount,
    breakdown: {
      cash: session.totalCashSales,
      card: session.totalCardSales,
      transfer: session.totalTransferSales,
      total: session.totalCashSales + session.totalCardSales + session.totalTransferSales
    }
  };
}

/**
 * Validate that a cash sale can be processed
 */
export async function validateCashSale(): Promise<{ valid: boolean; session?: CashSession; error?: string }> {
  const hasOpen = await cashSessionRepository.hasOpenSession();
  
  if (!hasOpen) {
    return {
      valid: false,
      error: 'No hay una caja abierta. Abre la caja antes de procesar ventas en efectivo.'
    };
  }
  
  const session = await cashSessionRepository.getOpenSession();
  
  if (!session) {
    return {
      valid: false,
      error: 'Error al obtener la sesión de caja.'
    };
  }
  
  if (session.status !== 'open') {
    return {
      valid: false,
      error: 'La caja está cerrada.'
    };
  }
  
  return { valid: true, session };
}

export const cashSessionService = {
  getActiveSession,
  processSaleWithSession,
  processSaleWithoutSession,
  getSessionSummary,
  validateCashSale
};

export default cashSessionService;
