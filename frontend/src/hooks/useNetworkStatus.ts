/**
 * useNetworkStatus Hook
 * 
 * React hook for online/offline network status detection.
 * Uses the networkStatusService for detection and exposes state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { NetworkStatus, NetworkState } from '../types';
import { networkStatusService } from '../services/networkStatusService';

/**
 * Hook to detect and respond to network connectivity changes
 * 
 * @returns Object containing:
 *   - status: 'online' | 'offline'
 *   - lastOnline: timestamp of last online event
 *   - isOnline: boolean convenience getter
 *   - isOffline: boolean convenience getter
 *   - verifyConnectivity: function to verify actual server connectivity
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(() => 
    networkStatusService.getStatus()
  );
  const [lastOnline, setLastOnline] = useState<number | undefined>(() => 
    networkStatusService.getState().lastOnline
  );

  useEffect(() => {
    // Initialize the service
    networkStatusService.init();

    // Subscribe to status changes
    const unsubscribe = networkStatusService.subscribe((newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'online') {
        setLastOnline(Date.now());
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  const verifyConnectivity = useCallback(async (): Promise<boolean> => {
    return networkStatusService.verifyConnectivity();
  }, []);

  return {
    status,
    lastOnline,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    verifyConnectivity
  };
}

/**
 * Hook to get full network state with additional metadata
 */
export function useNetworkState(): NetworkState & { 
  verifyConnectivity: () => Promise<boolean> 
} {
  const [state, setState] = useState<NetworkState>(() => 
    networkStatusService.getState()
  );

  useEffect(() => {
    networkStatusService.init();

    const unsubscribe = networkStatusService.subscribe((newStatus) => {
      setState({
        status: newStatus,
        lastOnline: newStatus === 'online' ? Date.now() : state.lastOnline
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const verifyConnectivity = useCallback(async (): Promise<boolean> => {
    return networkStatusService.verifyConnectivity();
  }, []);

  return {
    ...state,
    verifyConnectivity
  };
}

export default useNetworkStatus;
