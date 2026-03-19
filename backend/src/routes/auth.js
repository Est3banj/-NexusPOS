/**
 * Auth API Routes
 * 
 * Endpoints for authentication (login, register).
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

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
 * Create a new user (admin only in production, open for setup)
 */
router.post('/register', (req, res) => {
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

    const result = db.users.create({
      username,
      password,
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
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return token
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.users.getByUsername(username);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.password !== password) {
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
router.get('/validate', (req, res) => {
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

    const user = db.users.getById(parseInt(validation.payload.sub));
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

module.exports = router;
