/**
 * CashClosing Page
 * 
 * Admin page for managing cash drawer sessions.
 * Provides open/close workflow with sales summary.
 */

import React, { useState, useEffect } from 'react';
import { useCashSession } from '../hooks/useCashSession';
import type { CashSession } from '../types';

export default function CashClosing() {
  const {
    currentSession,
    sessions,
    loading,
    error,
    hasOpenSession,
    openSession,
    closeSession,
    refresh
  } = useCashSession();
  
  const [initialCash, setInitialCash] = useState<string>('');
  const [actualCash, setActualCash] = useState<string>('');
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Reset form when session changes
  useEffect(() => {
    if (!hasOpenSession) {
      setInitialCash('');
      setActualCash('');
    }
  }, [hasOpenSession]);
  
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsOpening(true);
    
    try {
      const initial = parseFloat(initialCash);
      if (isNaN(initial) || initial < 0) {
        throw new Error('Ingresa un monto válido');
      }
      
      await openSession(initial);
      setInitialCash('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al abrir la caja');
    } finally {
      setIsOpening(false);
    }
  };
  
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsClosing(true);
    
    try {
      const actual = parseFloat(actualCash);
      if (isNaN(actual) || actual < 0) {
        throw new Error('Ingresa un monto válido');
      }
      
      await closeSession(actual);
      setActualCash('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Error al cerrar la caja');
    } finally {
      setIsClosing(false);
    }
  };
  
  // Calculate expected cash
  const expectedCash = currentSession 
    ? currentSession.initialCash + currentSession.totalCashSales
    : 0;
  
  const difference = currentSession && actualCash
    ? parseFloat(actualCash) - expectedCash
    : 0;
  
  if (loading) {
    return (
      <div className="card">
        <h2>Cierre de Caja</h2>
        <p>Cargando...</p>
      </div>
    );
  }
  
  return (
    <div className="cash-closing">
      {/* Error Display */}
      {(error || localError) && (
        <div className="alert alert-error mb-4">
          {error || localError}
        </div>
      )}
      
      {/* Open Session Form */}
      {!hasOpenSession && (
        <div className="card mb-4">
          <h2>Abrir Caja</h2>
          <form onSubmit={handleOpenSession}>
            <div className="form-group">
              <label htmlFor="initialCash">Monto Inicial en Efectivo</label>
              <input
                type="number"
                id="initialCash"
                className="input"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
              />
              <small className="text-muted">
                Ingresa el dinero que hay en la caja al comenzar el turno
              </small>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isOpening}
            >
              {isOpening ? 'Abriendo...' : 'Abrir Caja'}
            </button>
          </form>
        </div>
      )}
      
      {/* Current Session Info */}
      {hasOpenSession && currentSession && (
        <div className="card mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2>Caja Abierta</h2>
            <span className="badge badge-success">Abierta</span>
          </div>
          
          <div className="cash-session-details">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Hora de Apertura</span>
                <span className="detail-value">
                  {new Date(currentSession.openedAt).toLocaleString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Monto Inicial</span>
                <span className="detail-value">${currentSession.initialCash.toFixed(2)}</span>
              </div>
            </div>
            
            <hr className="my-4" />
            
            <h3>Ventas del Turno</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Efectivo</span>
                <span className="detail-value detail-value--cash">
                  ${currentSession.totalCashSales.toFixed(2)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tarjeta</span>
                <span className="detail-value detail-value--card">
                  ${currentSession.totalCardSales.toFixed(2)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Transferencia</span>
                <span className="detail-value detail-value--transfer">
                  ${currentSession.totalTransferSales.toFixed(2)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Total Ventas</span>
                <span className="detail-value detail-value--total">
                  ${(currentSession.totalCashSales + currentSession.totalCardSales + currentSession.totalTransferSales).toFixed(2)}
                </span>
              </div>
            </div>
            
            <hr className="my-4" />
            
            {/* Close Session Form */}
            <h3>Cerrar Caja</h3>
            <form onSubmit={handleCloseSession}>
              <div className="form-group">
                <label htmlFor="expectedCash">Esperado en Efectivo</label>
                <input
                  type="text"
                  id="expectedCash"
                  className="input"
                  value={expectedCash.toFixed(2)}
                  readOnly
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                />
                <small className="text-muted">
                  inicial + ventas en efectivo
                </small>
              </div>
              
              <div className="form-group">
                <label htmlFor="actualCash">Efectivo Real (Conteoo)</label>
                <input
                  type="number"
                  id="actualCash"
                  className="input"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              {actualCash && (
                <div className={`difference-box ${difference >= 0 ? 'difference-positive' : 'difference-negative'}`}>
                  <span className="difference-label">Diferencia:</span>
                  <span className="difference-value">
                    {difference >= 0 ? '+' : ''}${difference.toFixed(2)}
                  </span>
                </div>
              )}
              
              <button 
                type="submit" 
                className="btn btn-danger"
                disabled={isClosing || !actualCash}
              >
                {isClosing ? 'Cerrando...' : 'Cerrar Caja'}
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Session History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2>Historial de Cajas</h2>
          <button className="btn btn-sm" onClick={refresh}>
            Actualizar
          </button>
        </div>
        
        {sessions.length === 0 ? (
          <p className="text-muted">No hay sesiones registradas</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="text-right">Inicial</th>
                <th className="text-right">Ventas</th>
                <th className="text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface SessionRowProps {
  session: CashSession;
}

function SessionRow({ session }: SessionRowProps) {
  const isOpen = session.status === 'open';
  
  return (
    <tr>
      <td>
        {new Date(session.openedAt).toLocaleDateString()}
        <br />
        <small className="text-muted">
          {new Date(session.openedAt).toLocaleTimeString()}
          {session.closedAt && (
            <> - {new Date(session.closedAt).toLocaleTimeString()}</>
          )}
        </small>
      </td>
      <td>
        <span className={`badge ${isOpen ? 'badge-success' : 'badge-secondary'}`}>
          {isOpen ? 'Abierta' : 'Cerrada'}
        </span>
      </td>
      <td className="text-right">${session.initialCash.toFixed(2)}</td>
      <td className="text-right">
        ${(session.totalCashSales + session.totalCardSales + session.totalTransferSales).toFixed(2)}
      </td>
      <td className="text-right">
        {session.difference !== undefined ? (
          <span className={session.difference >= 0 ? 'text-success' : 'text-error'}>
            {session.difference >= 0 ? '+' : ''}{session.difference.toFixed(2)}
          </span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
    </tr>
  );
}
