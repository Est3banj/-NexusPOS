/**
 * NetworkStatus Component
 * 
 * React component that displays online/offline network status indicator.
 * Shows connectivity state with visual feedback.
 */

import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export interface NetworkStatusProps {
  /** Show text label (default: true) */
  showLabel?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when status changes */
  onStatusChange?: (status: 'online' | 'offline') => void;
}

/**
 * Network status indicator component
 * 
 * Displays:
 * - Green dot + "Online" when connected
 * - Red dot + "Offline" when disconnected
 */
export function NetworkStatus({ 
  showLabel = true, 
  className = '',
  onStatusChange 
}: NetworkStatusProps) {
  const { status, isOnline, lastOnline } = useNetworkStatus();

  // Notify parent of status changes
  React.useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const statusClass = isOnline ? 'network-status--online' : 'network-status--offline';
  const statusText = isOnline ? 'Online' : 'Offline';

  return (
    <div className={`network-status ${statusClass} ${className}`}>
      <span className="network-status__indicator" />
      {showLabel && (
        <span className="network-status__label">
          {statusText}
          {lastOnline && !isOnline && (
            <span className="network-status__last-online">
              {' '}Last online: {new Date(lastOnline).toLocaleTimeString()}
            </span>
          )}
        </span>
      )}
      <style>{`
        .network-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .network-status--online {
          background-color: #dcfce7;
          color: #166534;
        }
        
        .network-status--offline {
          background-color: #fee2e2;
          color: #991b1b;
        }
        
        .network-status__indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        .network-status--online .network-status__indicator {
          background-color: #22c55e;
        }
        
        .network-status--offline .network-status__indicator {
          background-color: #ef4444;
        }
        
        .network-status__label {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .network-status__last-online {
          font-size: 12px;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}

/**
 * Compact network status for use in header/toolbar
 */
export function NetworkStatusCompact({ className = '' }: { className?: string }) {
  const { isOnline } = useNetworkStatus();

  return (
    <div 
      className={`network-status-compact ${isOnline ? 'online' : 'offline'} ${className}`}
      title={isOnline ? 'Connected' : 'Offline - Changes will sync when online'}
    >
      <span className="network-status-compact__dot" />
      <style>{`
        .network-status-compact {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
        }
        
        .network-status-compact__dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transition: background-color 0.3s ease;
        }
        
        .network-status-compact.online .network-status-compact__dot {
          background-color: #22c55e;
        }
        
        .network-status-compact.offline .network-status-compact__dot {
          background-color: #ef4444;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default NetworkStatus;
