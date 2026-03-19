/**
 * Authentication Context
 * 
 * Provides authentication state and methods to all components
 * via React Context API.
 */

import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserWithoutPassword, UserRole, AuthState, LoginCredentials, AuthResponse } from '../types';
import authService from '../services/authService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserWithoutPassword | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const session = authService.getCurrentSession();
        
        if (session) {
          const validation = await authService.validateToken();
          if (validation.valid && validation.user) {
            setUser({
              id: validation.user.id,
              username: validation.user.username,
              role: validation.user.role
            });
          } else {
            authService.logout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        authService.logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await authService.login(credentials);
    
    if (response.success && response.user) {
      setUser(response.user);
    }
    
    return response;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const hasRole = useCallback((requiredRole: UserRole): boolean => {
    if (!user) return false;
    return user.role === requiredRole;
  }, [user]);

  const refreshUser = useCallback(async () => {
    const validation = await authService.validateToken();
    if (validation.valid && validation.user) {
      setUser({
        id: validation.user.id,
        username: validation.user.username,
        role: validation.user.role
      });
    } else {
      logout();
    }
  }, [logout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasRole,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
