/**
 * Authentication Service
 * 
 * Handles login, logout, session management, and JWT token operations.
 * Uses localStorage for session persistence across page refreshes.
 */

import { db } from '../db';
import type { User, UserRole, AuthSession, LoginCredentials, AuthResponse } from '../types';

// Session storage keys
const AUTH_TOKEN_KEY = 'pos_auth_token';
const AUTH_SESSION_KEY = 'pos_auth_session';

// Default session duration: 24 hours
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a simple JWT-like token (for demo purposes)
 * In production, this would be a real JWT from a backend
 */
function generateToken(username: string, userId: number): string {
  const payload = {
    sub: userId.toString(),
    username,
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS
  };
  // Simple base64 encoding (NOT secure - demo only)
  return btoa(JSON.stringify(payload));
}

/**
 * Validate token format and expiration
 */
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

/**
 * Pre-seed default users if database is empty
 * Creates admin and employee accounts
 */
export async function seedDefaultUsers(): Promise<void> {
  const userCount = await db.users.count();
  
  if (userCount === 0) {
    const now = Date.now();
    
    // Create default admin user
    await db.users.add({
      username: 'admin',
      password: 'admin123', // Plain for demo - would be hashed in production
      role: 'ADMIN' as UserRole,
      createdAt: now,
      updatedAt: now
    });
    
    // Create default employee user
    await db.users.add({
      username: 'empleado',
      password: 'empleado123', // Plain for demo
      role: 'EMPLOYEE' as UserRole,
      createdAt: now,
      updatedAt: now
    });
    
    console.log('Default users seeded: admin, empleado');
  }
}

/**
 * Auth Service
 * 
 * Provides authentication operations for the POS system.
 * Handles login validation, session management, and token operations.
 */
export const authService = {
  /**
   * Authenticate user with username and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { username, password } = credentials;
    
    // Find user by username
    const user = await db.users
      .where('username')
      .equals(username)
      .first();
    
    // Validate credentials
    if (!user) {
      return { success: false, error: 'Usuario no encontrado' };
    }
    
    if (user.password !== password) {
      return { success: false, error: 'Contraseña incorrecta' };
    }
    
    // Generate token
    const token = generateToken(user.username, user.id!);
    const expiresAt = Date.now() + SESSION_DURATION_MS;
    
    // Create session
    const session: AuthSession = {
      userId: user.id!,
      username: user.username,
      role: user.role,
      token,
      expiresAt
    };
    
    // Store session in localStorage
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword };
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
    
    // Validate token
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
    const session = this.getCurrentSession();
    return session !== null;
  },
  
  /**
   * Get current user role
   */
  getCurrentRole(): UserRole | null {
    const session = this.getCurrentSession();
    return session?.role ?? null;
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
    
    // Generate new token with updated expiration
    const newToken = generateToken(session.username, session.userId);
    newSession.token = newToken;
    
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(newSession));
  },
  
  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User | undefined> {
    return db.users.get(id);
  },
  
  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    const users = await db.users.toArray();
    // Remove passwords from response
    return users.map(({ password, ...user }) => user as User);
  },
  
  /**
   * Create a new user (admin only)
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = Date.now();
    return db.users.add({
      ...userData,
      createdAt: now,
      updatedAt: now
    });
  },
  
  /**
   * Update a user
   */
  async updateUser(id: number, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
    await db.users.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  },
  
  /**
   * Delete a user
   */
  async deleteUser(id: number): Promise<void> {
    await db.users.delete(id);
  }
};

export default authService;
