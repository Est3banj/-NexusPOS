import { db } from '../index';
import type { User, UserWithoutPassword } from '../../types';

function getTimestamp(): number {
  return Date.now();
}

export const userRepository = {
  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const existing = await db.users.where('username').equals(user.username).first();
    if (existing) {
      throw new Error('El nombre de usuario ya existe');
    }

    const now = getTimestamp();
    const newUser: User = {
      ...user,
      createdAt: now,
      updatedAt: now
    };

    return db.users.add(newUser);
  },

  async getAll(): Promise<UserWithoutPassword[]> {
    const users = await db.users.toArray();
    return users.map(({ password, ...rest }) => rest as UserWithoutPassword);
  },

  async getById(id: number): Promise<User | undefined> {
    return db.users.get(id);
  },

  async getByUsername(username: string): Promise<User | undefined> {
    return db.users.where('username').equals(username).first();
  },

  async update(id: number, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<number> {
    if (updates.username) {
      const existing = await db.users
        .where('username')
        .equals(updates.username)
        .and(u => u.id !== id)
        .first();
      if (existing) {
        throw new Error('El nombre de usuario ya existe');
      }
    }

    await db.users.update(id, {
      ...updates,
      updatedAt: getTimestamp()
    });

    return id;
  },

  async delete(id: number): Promise<void> {
    await db.users.delete(id);
  },

  async authenticate(username: string, password: string): Promise<UserWithoutPassword | null> {
    const user = await db.users.where('username').equals(username).first();
    if (!user || user.password !== password) {
      return null;
    }
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as UserWithoutPassword;
  },

  async seedDefaultAdmin(): Promise<void> {
    const adminExists = await db.users.where('username').equals('admin').first();
    if (!adminExists) {
      await this.create({
        username: 'admin',
        password: 'admin123',
        role: 'ADMIN'
      });
    }
  }
};

export default userRepository;
