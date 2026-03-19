import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import type { User, UserRole } from '../types';

interface UserManagementProps {
  currentUserId?: number;
}

export function UserManagement({ currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'EMPLOYEE' as UserRole
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { userRepository } = await import('../db/repositories/userRepository');
      const allUsers = await userRepository.getAll();
      setUsers(allUsers.map(u => ({ ...u, password: '' })));
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const { userRepository } = await import('../db/repositories/userRepository');

      if (editingUser) {
        const updates: Partial<User> = {
          username: formData.username,
          role: formData.role
        };
        if (formData.password) {
          updates.password = formData.password;
        }
        await userRepository.update(editingUser.id!, updates);
      } else {
        if (!formData.password) {
          setError('La contraseña es requerida');
          return;
        }
        await userRepository.create({
          username: formData.username,
          password: formData.password,
          role: formData.role
        });
      }

      await loadUsers();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      role: user.role
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    if (userId === currentUserId) {
      setError('No puedes eliminar tu propio usuario');
      return;
    }

    try {
      const { userRepository } = await import('../db/repositories/userRepository');
      await userRepository.delete(userId);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar usuario');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({ username: '', password: '', role: 'EMPLOYEE' });
    setError(null);
  };

  if (loading) {
    return <div className="text-muted">Cargando usuarios...</div>;
  }

  return (
    <div className="user-management">
      <div className="flex justify-between items-center mb-4">
        <h2>Gestión de Usuarios</h2>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <UserPlus size={18} />
            <span>Agregar</span>
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-warning mb-4">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-4">
          <h3 className="mb-4">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
          <div className="user-form__grid">
            <div className="input-group">
              <label className="input-label">Usuario</label>
              <input
                type="text"
                className="input"
                placeholder="Nombre de usuario"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">
                Contraseña {editingUser && '(dejar vacío para no cambiar)'}
              </label>
              <input
                type="password"
                className="input"
                placeholder={editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Rol</label>
              <select
                className="input"
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
              >
                <option value="ADMIN">Administrador</option>
                <option value="EMPLOYEE">Empleado</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn btn-success">
              {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
            <button type="button" className="btn" onClick={resetForm}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="user-list">
        {users.map(user => (
          <div key={user.id} className="user-card">
            <div className="user-card__avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-card__info">
              <div className="user-card__name">
                {user.username}
                {user.id === currentUserId && (
                  <span className="user-card__badge">(Tú)</span>
                )}
              </div>
              <div className={`user-card__role user-card__role--${user.role.toLowerCase()}`}>
                {user.role === 'ADMIN' ? 'Administrador' : 'Empleado'}
              </div>
            </div>
            <div className="user-card__actions">
              <button
                className="btn btn-sm btn-icon"
                onClick={() => handleEdit(user)}
                disabled={user.id === currentUserId}
                title="Editar"
              >
                <Pencil size={16} />
              </button>
              <button
                className="btn btn-sm btn-icon btn-icon--danger"
                onClick={() => handleDelete(user.id!)}
                disabled={user.id === currentUserId}
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && !showForm && (
        <p className="text-muted">No hay usuarios registrados</p>
      )}
    </div>
  );
}
