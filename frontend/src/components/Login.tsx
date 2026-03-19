/**
 * Login Component
 * 
 * User authentication form with validation and error handling.
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { LoginCredentials } from '../types';

interface LoginProps {
  onLoginSuccess?: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Basic validation
    if (!credentials.username.trim()) {
      setError('Por favor ingresa el usuario');
      return;
    }
    if (!credentials.password.trim()) {
      setError('Por favor ingresa la contraseña');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(credentials);
      
      if (!result.success) {
        setError(result.error || 'Error al iniciar sesión');
        return;
      }

      // Login successful
      onLoginSuccess?.();
    } catch (err) {
      setError('Error de conexión. Intenta de nuevo.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">NexusPOS</h1>
          <p className="login-subtitle">Ingresa tus credenciales</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="username" className="login-label">Usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              className="login-input"
              value={credentials.username}
              onChange={handleChange}
              placeholder="Usuario"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              className="login-input"
              value={credentials.password}
              onChange={handleChange}
              placeholder="Contraseña"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-hint">
            Credenciales por defecto:
          </p>
          <div className="login-credentials">
            <span><strong>Admin:</strong> admin / admin123</span>
            <span><strong>Empleado:</strong> empleado / empleado123</span>
          </div>
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          padding: 1rem;
        }

        .login-card {
          background: var(--color-surface);
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          padding: 2.5rem;
          width: 100%;
          max-width: 400px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 0.5rem 0;
        }

        .login-subtitle {
          color: var(--color-text-muted);
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .login-error {
          padding: 0.75rem 1rem;
          background: rgb(239 68 68 / 0.1);
          border: 1px solid var(--color-error);
          border-radius: 8px;
          color: var(--color-error);
          font-size: 0.875rem;
          text-align: center;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .login-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .login-input {
          padding: 0.75rem 1rem;
          font-size: 1rem;
          border: 2px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-bg);
          color: var(--color-text);
          transition: all 0.2s;
        }

        .login-input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgb(99 102 241 / 0.1);
        }

        .login-input:disabled {
          background: var(--color-border-light);
          cursor: not-allowed;
        }

        .login-input::placeholder {
          color: var(--color-text-muted);
        }

        .login-button {
          padding: 0.875rem;
          font-size: 1rem;
          font-weight: 600;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.5rem;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-footer {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border-light);
          text-align: center;
        }

        .login-hint {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin: 0 0 0.5rem 0;
        }

        .login-credentials {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .login-credentials strong {
          color: var(--color-text);
        }
      `}</style>
    </div>
  );
}

export default Login;
