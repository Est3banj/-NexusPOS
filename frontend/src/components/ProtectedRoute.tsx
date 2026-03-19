/**
 * Protected Route Component
 * 
 * Route guard that checks authentication and role-based access.
 * Redirects to login if not authenticated or unauthorized.
 */

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = '/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, user } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="protected-loading">
        <div className="protected-spinner" />
        <p>Cargando...</p>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    // In a real app, we'd use useNavigate() here
    // For now, we'll show a message
    return (
      <div className="protected-redirect">
        <p>Redirigiendo a login...</p>
      </div>
    );
  }

  // Role check
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="protected-unauthorized">
        <h2>Acceso Denegado</h2>
        <p>No tienes permisos para acceder a esta sección.</p>
        <p>Tu rol actual: <strong>{user?.role}</strong></p>
        <p>Se requiere: <strong>{requiredRole}</strong></p>
      </div>
    );
  }

  // Authorized - render children
  return <>{children}</>;

  <style>{`
    .protected-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      gap: 1rem;
      color: var(--color-text-muted);
    }

    .protected-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .protected-redirect,
    .protected-unauthorized {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      padding: 2rem;
      text-align: center;
    }

    .protected-unauthorized h2 {
      color: var(--color-error);
      margin-bottom: 1rem;
    }

    .protected-unauthorized p {
      color: var(--color-text-muted);
      margin: 0.5rem 0;
    }

    .protected-unauthorized strong {
      color: var(--color-text);
    }
  `}</style>
}

export default ProtectedRoute;
