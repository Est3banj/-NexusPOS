/**
 * SyncIndicator Component
 * 
 * React component that displays sync status and pending operation count.
 * Shows sync progress and any errors.
 */

import React from 'react';
import { useOfflineSync, useSyncStats } from '../hooks/useOfflineSync';
import { RefreshCw, Check, AlertCircle, Circle, AlertTriangle } from 'lucide-react';

export interface SyncIndicatorProps {
  /** Show pending count (default: true) */
  showCount?: boolean;
  /** Show status text (default: true) */
  showLabel?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when sync is triggered manually */
  onManualSync?: () => void;
}

/**
 * Sync status indicator component
 * 
 * Displays:
 * - Idle: "Synced" with checkmark when no pending items
 * - Syncing: Animated spinner with "Syncing..." text
 * - Warning: Yellow indicator when queue is large
 * - Error: Red indicator with error message
 */
export function SyncIndicator({ 
  showCount = true,
  showLabel = true, 
  className = '',
  onManualSync
}: SyncIndicatorProps) {
  const { status, pendingCount, lastSyncAt, error, triggerSync, clearFailed } = useOfflineSync();
  const stats = useSyncStats();

  const getStatusDisplay = () => {
    switch (status) {
      case 'syncing':
        return { Icon: RefreshCw, text: 'Sincronizando...', className: 'syncing' };
      case 'error':
        return { Icon: AlertCircle, text: 'Error', className: 'error' };
      case 'warning':
        return { Icon: AlertTriangle, text: `${pendingCount} pendientes`, className: 'warning' };
      default:
        if (pendingCount > 0) {
          return { Icon: Circle, text: `${pendingCount} pendientes`, className: 'pending' };
        }
        return { Icon: Check, text: 'Sincronizado', className: 'synced' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const { Icon } = statusDisplay;

  const handleClick = () => {
    if (status === 'error') {
      clearFailed();
    } else if (status !== 'syncing') {
      triggerSync();
      onManualSync?.();
    }
  };

  return (
    <div 
      className={`sync-indicator sync-indicator--${statusDisplay.className} ${className}`}
      onClick={handleClick}
      title={error || (status === 'syncing' ? 'Sincronizando...' : 'Clic para sincronizar')}
    >
      <Icon className="sync-indicator__icon" size={14} />
      
      {showLabel && (
        <span className="sync-indicator__label">{statusDisplay.text}</span>
      )}
      
      {showCount && status === 'syncing' && stats.total > 0 && (
        <span className="sync-indicator__progress">
          ({stats.processing}/{stats.total})
        </span>
      )}
      
      {lastSyncAt && status === 'idle' && pendingCount === 0 && (
        <span className="sync-indicator__last-sync">
          Última: {new Date(lastSyncAt).toLocaleTimeString()}
        </span>
      )}

      <style>{`
        .sync-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }
        
        .sync-indicator:hover {
          opacity: 0.9;
        }
        
        .sync-indicator--synced {
          background-color: #dcfce7;
          color: #166534;
        }
        
        .sync-indicator--pending {
          background-color: #f3f4f6;
          color: #6b7280;
        }
        
        .sync-indicator--syncing {
          background-color: #dbeafe;
          color: #1e40af;
        }
        
        .sync-indicator--warning {
          background-color: #fef3c7;
          color: #92400e;
        }
        
        .sync-indicator--error {
          background-color: #fee2e2;
          color: #991b1b;
        }
        
        .sync-indicator__icon {
          flex-shrink: 0;
        }
        
        .sync-indicator--syncing .sync-indicator__icon {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .sync-indicator__label {
          font-weight: 500;
        }
        
        .sync-indicator__progress {
          font-size: 12px;
          opacity: 0.8;
        }
        
        .sync-indicator__last-sync {
          font-size: 11px;
          opacity: 0.7;
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}

/**
 * Compact sync indicator showing just the count
 */
export function SyncIndicatorCompact({ className = '' }: { className?: string }) {
  const { status, pendingCount } = useOfflineSync();

  const getStatusDisplay = () => {
    switch (status) {
      case 'syncing': return { Icon: RefreshCw, className: 'syncing' };
      case 'error': return { Icon: AlertCircle, className: 'error' };
      case 'warning': return { Icon: AlertTriangle, className: 'warning' };
      default: return pendingCount > 0 ? { Icon: Circle, className: 'pending' } : { Icon: Check, className: 'synced' };
    }
  };

  const { Icon, className: statusClass } = getStatusDisplay();

  return (
    <div 
      className={`sync-indicator-compact sync-indicator-compact--${statusClass} ${className}`}
      title={status === 'syncing' ? 'Sincronizando...' : `${pendingCount} items pendientes`}
    >
      {pendingCount > 0 && (
        <span className="sync-indicator-compact__count">{pendingCount}</span>
      )}
      <Icon size={12} />
      
      <style>{`
        .sync-indicator-compact {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 28px;
          justify-content: center;
        }
        
        .sync-indicator-compact__count {
          font-size: 10px;
          font-weight: 600;
          background: #6b7280;
          color: white;
          padding: 1px 5px;
          border-radius: 10px;
        }
        
        .sync-indicator-compact--synced .sync-indicator-compact__count {
          display: none;
        }
        
        .sync-indicator-compact--pending .sync-indicator-compact__count {
          background: #6b7280;
        }
        
        .sync-indicator-compact--syncing .sync-indicator-compact__count {
          background: #1e40af;
          animation: pulse 1s infinite;
        }
        
        .sync-indicator-compact--warning .sync-indicator-compact__count {
          background: #d97706;
        }
        
        .sync-indicator-compact--error .sync-indicator-compact__count {
          background: #dc2626;
        }
        
        .sync-indicator-compact--syncing {
          animation: spin 1s linear infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default SyncIndicator;
