/**
 * Authentication Context
 * 
 * Provides authentication state and methods to all components
 * via React Context API.
 */

import React, { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserWithoutPassword, UserRole, AuthState, LoginCredentials, AuthResponse } from '../types';
import authService, { seedDefaultUsers } from '../services/authService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  refreshUser: () => Promise<void>;
}

// Create context with undefined default (must be provided)
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider - Wraps the application with authentication context
 * 
 * Initializes auth state from localStorage on mount.
 * Provides login/logout methods and role checking.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserWithoutPassword | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Seed default users if needed
        await seedDefaultUsers();
        
        // Check for existing session
        const session = authService.getCurrentSession();
        
        if (session) {
          // Fetch full user data
          const dbUser = await authService.getUserById(session.userId);
          if (dbUser) {
            const { password: _, ...userWithoutPassword } = dbUser;
            setUser(userWithoutPassword as UserWithoutPassword);
          } else {
            // Session invalid - clear it
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

  /**
   * Login user with credentials
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await authService.login(credentials);
    
    if (response.success && response.user) {
      setUser(response.user);
    }
    
    return response;
  }, []);

  /**
   * Logout current user
   */
  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  /**
   * Check if current user has specific role
   */
  const hasRole = useCallback((requiredRole: UserRole): boolean => {
    if (!user) return false;
    return user.role === requiredRole;
  }, [user]);

  /**
   * Refresh user data from database
   */
  const refreshUser = useCallback(async () => {
    const session = authService.getCurrentSession();
    if (!session) {
      setUser(null);
      return;
    }

    const dbUser = await authService.getUserById(session.userId);
    if (dbUser) {
      const { password: _, ...userWithoutPassword } = dbUser;
      setUser(userWithoutPassword as UserWithoutPassword);
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
