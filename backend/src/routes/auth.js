/**
 * Auth API Routes
 * 
 * Endpoints for authentication (login, register).
 * Usa bcryptjs para hashear contraseñas en producción.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

function generateToken(username, userId) {
  const payload = {
    sub: userId.toString(),
    username,
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function validateToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) {
      return { valid: false };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

/**
 * POST /api/auth/register
 * Create a new user - Hashea la contraseña con bcryptjs
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const validRoles = ['ADMIN', 'EMPLOYEE'];
    const userRole = role && validRoles.includes(role) ? role : 'EMPLOYEE';

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await db.users.create({
      username,
      password: passwordHash,
      role: userRole,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    if (result.error) {
      return res.status(409).json({ error: result.error });
    }

    const token = generateToken(username, result.id);
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    res.status(201).json({
      success: true,
      user: {
        id: result.id,
        username: result.username,
        role: result.role
      },
      token,
      expiresAt
    });
  } catch (error) {
    console.error('[auth] POST register error:', error);
    res.status(500).json({ error: 'Failed to register user', detail: error.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user - Compara password hasheado con bcrypt
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.users.getByUsername(username);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Compare password with bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = generateToken(username, user.id);
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      token,
      expiresAt
    });
  } catch (error) {
    console.error('[auth] POST login error:', error);
    res.status(500).json({ error: 'Failed to authenticate' });
  }
});

/**
 * GET /api/auth/validate
 * Validate a token
 */
router.get('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const validation = validateToken(token);

    if (!validation.valid) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await db.users.getById(parseInt(validation.payload.sub));
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[auth] GET validate error:', error);
    res.status(500).json({ error: 'Failed to validate token' });
  }
});

/**
 * PUT /api/auth/password
 * Change user password
 */
router.put('/password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const validation = validateToken(token);

    if (!validation.valid) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await db.users.getById(parseInt(validation.payload.sub));
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    
    await db.users.update(user.id, {
      password: newPasswordHash,
      updatedAt: Date.now()
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('[auth] PUT password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;