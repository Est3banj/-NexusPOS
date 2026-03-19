import React, { useState } from 'react';
import type { UserRole } from '../types';
import authService from '../services/authService';

interface InitialSetupProps {
  onSetupComplete: () => void;
}

export function InitialSetup({ onSetupComplete }: InitialSetupProps) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.username.trim()) {
      setError('El usuario es requerido');
      return;
    }

    if (formData.username.length < 3) {
      setError('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!formData.password) {
      setError('La contraseña es requerida');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.register(formData.username.trim(), formData.password, 'ADMIN' as UserRole);
      
      if (!result.success) {
        setError(result.error || 'Error al crear el usuario');
        setIsLoading(false);
        return;
      }

      onSetupComplete();
    } catch (err: any) {
      setError(err.message || 'Error al crear el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-header">
          <h1 className="setup-title">NexusPOS</h1>
          <h2 className="setup-subtitle">Configuración Inicial</h2>
          <p className="setup-description">
            Crea tu cuenta de administrador para comenzar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {error && (
            <div className="setup-error">{error}</div>
          )}

          <div className="setup-field">
            <label htmlFor="username" className="setup-label">Usuario</label>
            <input
              id="username"
              name="username"
              type="text"
              className="setup-input"
              value={formData.username}
              onChange={handleChange}
              placeholder="Nombre de usuario"
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          <div className="setup-field">
            <label htmlFor="password" className="setup-label">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              className="setup-input"
              value={formData.password}
              onChange={handleChange}
              placeholder="Contraseña"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          <div className="setup-field">
            <label htmlFor="confirmPassword" className="setup-label">Confirmar Contraseña</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="setup-input"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repetir contraseña"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="setup-button"
            disabled={isLoading}
          >
            {isLoading ? 'Creando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="setup-tips">
          <p><strong>Recomendaciones de seguridad:</strong></p>
          <ul>
            <li>Usa al menos 8 caracteres</li>
            <li>Combina letras, números y símbolos</li>
            <li>No uses información personal fácil de adivinar</li>
          </ul>
        </div>
      </div>

      <style>{`
        .setup-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          padding: 1rem;
        }

        .setup-card {
          background: var(--color-surface);
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          padding: 2.5rem;
          width: 100%;
          max-width: 400px;
        }

        .setup-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .setup-title {
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 1rem 0;
        }

        .setup-subtitle {
          font-size: 1.25rem;
          color: var(--color-text);
          margin: 0 0 0.5rem 0;
        }

        .setup-description {
          color: var(--color-text-muted);
          margin: 0;
          font-size: 0.875rem;
        }

        .setup-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .setup-error {
          background: rgb(239 68 68 / 0.1);
          color: #dc2626;
          padding: 0.75rem;
          border-radius: 8px;
          font-size: 0.875rem;
          text-align: center;
        }

        .setup-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .setup-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
        }

        .setup-input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .setup-input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
        }

        .setup-input:disabled {
          background: var(--color-bg);
          cursor: not-allowed;
        }

        .setup-button {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.5rem;
        }

        .setup-button:hover:not(:disabled) {
          box-shadow: 0 4px 12px rgb(99 102 241 / 0.4);
          transform: translateY(-1px);
        }

        .setup-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .setup-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .setup-tips {
          margin-top: 1.5rem;
          padding: 1rem;
          background: var(--color-border-light);
          border-radius: 8px;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .setup-tips p {
          margin: 0 0 0.5rem 0;
        }

        .setup-tips ul {
          margin: 0;
          padding-left: 1.25rem;
        }

        .setup-tips li {
          margin-bottom: 0.25rem;
        }

        @media (max-width: 480px) {
          .setup-card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
