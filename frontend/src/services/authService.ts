/**
 * Authentication Service
 * 
 * Handles login, logout, session management via backend API.
 * Uses localStorage for token persistence across page refreshes.
 */

import type { User, UserRole, AuthSession, LoginCredentials, AuthResponse } from '../types';
import { API_ENDPOINTS } from '../config/api';

const AUTH_TOKEN_KEY = 'pos_auth_token';
const AUTH_SESSION_KEY = 'pos_auth_session';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function validateToken(token: string): { valid: boolean; payload?: { sub: string; username: string; exp: number } } {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) {
      return { valid: false };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export const authService = {
  /**
   * Login user with credentials via API
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        userId: data.user.id,
        username: data.user.username,
        role: data.user.role,
        token: data.token,
        expiresAt: data.expiresAt
      }));

      return {
        success: true,
        user: data.user
      };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return { success: false, error: 'No se pudo conectar al servidor' };
    }
  },

  /**
   * Register a new user via API
   */
  async register(username: string, password: string, role: UserRole = 'ADMIN'): Promise<AuthResponse> {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, role })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
        userId: data.user.id,
        username: data.user.username,
        role: data.user.role,
        token: data.token,
        expiresAt: data.expiresAt
      }));

      return {
        success: true,
        user: data.user
      };
    } catch (error) {
      console.error('[Auth] Register error:', error);
      return { success: false, error: 'No se pudo conectar al servidor' };
    }
  },

  /**
   * Clear authentication session
   */
  logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
  },

  /**
   * Get current authenticated session
   */
  getCurrentSession(): AuthSession | null {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const sessionStr = localStorage.getItem(AUTH_SESSION_KEY);

    if (!token || !sessionStr) {
      return null;
    }

    const validation = validateToken(token);
    if (!validation.valid) {
      this.logout();
      return null;
    }

    try {
      return JSON.parse(sessionStr);
    } catch {
      this.logout();
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentSession() !== null;
  },

  /**
   * Get current user role
   */
  getCurrentRole(): UserRole | null {
    return this.getCurrentSession()?.role ?? null;
  },

  /**
   * Check if current user has required role
   */
  hasRole(requiredRole: UserRole): boolean {
    const currentRole = this.getCurrentRole();
    if (!currentRole) return false;
    return currentRole === requiredRole;
  },

  /**
   * Refresh session expiration
   */
  refreshSession(): void {
    const session = this.getCurrentSession();
    if (!session) return;

    const newExpiresAt = Date.now() + SESSION_DURATION_MS;
    const newSession: AuthSession = {
      ...session,
      expiresAt: newExpiresAt
    };

    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(newSession));
  },

  /**
   * Get auth token for API calls
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Validate token with server
   */
  async validateToken(): Promise<{ valid: boolean; user?: { id: number; username: string; role: UserRole } }> {
    const token = this.getToken();
    if (!token) return { valid: false };

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.VALIDATE, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return { valid: false };
      }

      return { valid: true, user: data.user };
    } catch {
      return { valid: false };
    }
  }
};

export default authService;
