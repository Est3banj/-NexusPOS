/**
 * Express Server Setup - NexusPOS Production
 * 
 * Configurado para:
 * - PostgreSQL (Supabase) o SQLite local
 * - CORS restrictivo
 * - Bcryptjs para contraseñas
 * - Migraciones automáticas
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import db for initialization
const db = require('./db');

// Import routes
const productsRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const syncRoutes = require('./routes/sync');
const authRoutes = require('./routes/auth');
const customersRoutes = require('./routes/customers');

// Import middleware
const { 
  timestampsMiddleware, 
  loggingMiddleware, 
  errorHandlingMiddleware 
} = require('./middleware/timestamps');

// Import migrations
const { runMigrations } = require('./migrations/run');

// Configuration
const PORT = process.env.PORT || 10000;
const HOST = process.env.HOST || '0.0.0.0';

// CORS Configuration - Whitelist de dominios producción
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://nexus-pos-m0rz.onrender.com',
      'https://nexus-pos-delta.vercel.app'
    ].filter(Boolean);
    
    // Allow no-origin requests (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Create Express app
const app = express();

// ============================================================================
// Middleware
// ============================================================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS - Solo whitelist
app.use(cors(corsOptions));

// Custom middleware
app.use(timestampsMiddleware);
app.use(loggingMiddleware);

// ============================================================================
// Health Check (sin DB para verificar que el server funciona)
// ============================================================================

app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  
  try {
    // Test DB connection
    if (db.isProduction) {
      const result = await db.db.query('SELECT 1 as test');
      dbStatus = result.rows ? 'connected' : 'error';
    } else {
      db.db.prepare('SELECT 1').get();
      dbStatus = 'connected';
    }
  } catch (error) {
    dbStatus = `error: ${error.message}`;
  }
  
  res.json({ 
    status: 'ok', 
    timestamp: db.getServerTime(),
    uptime: process.uptime(),
    database: dbStatus,
    environment: db.isProduction ? 'production' : 'development'
  });
});

app.head('/api/health', (req, res) => {
  res.sendStatus(200);
});

// ============================================================================
// API Routes
// ============================================================================

// Products routes
app.use('/api/products', productsRoutes);

// Sales routes  
app.use('/api/sales', salesRoutes);

// Sync routes
app.use('/api/sync', syncRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Customers routes (Facturación Electrónica)
app.use('/api/customers', customersRoutes);

// ============================================================================
// Static Files (for production)
// ============================================================================

// Serve static files from frontend build
const staticPath = process.env.STATIC_PATH || path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(staticPath));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(staticPath, 'index.html'));
  }
});

// ============================================================================
// Error Handling - Global Error Handler
// ============================================================================

app.use(errorHandlingMiddleware);

// ============================================================================
// Server Start with Migrations
// ============================================================================

async function startServer() {
  // Run migrations for PostgreSQL
  if (db.isProduction) {
    try {
      await runMigrations();
      console.log('[Server] Migrations completed');
    } catch (error) {
      console.error('[Server] Migration failed:', error.message);
      // Continue anyway - tables might already exist
    }
  }

  app.listen(PORT, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   NexusPOS Backend Server                      ║
╠═══════════════════════════════════════════════════════════════╣
║  Environment: ${db.isProduction ? 'PRODUCTION (PostgreSQL/Supabase)' : 'DEVELOPMENT (SQLite)'}
║  Server running at http://${HOST}:${PORT}
║  API available at http://${HOST}:${PORT}/api
║                                                                   ║
║  Endpoints:                                                     ║
║    GET    /api/health          - Health check + DB status      ║
║    POST   /api/auth/login     - User login                     ║
║    POST   /api/auth/register  - User registration              ║
║    GET    /api/auth/validate - Token validation                ║
║    GET    /api/products       - List products                  ║
║    POST   /api/products       - Create product                 ║
║    GET    /api/sales          - List sales                     ║
║    POST   /api/sales          - Create sale (DIAN)             ║
║    POST   /api/sync/batch     - Batch sync                     ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  if (db.isProduction) {
    db.db.end();
  } else {
    db.db.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down...');
  if (db.isProduction) {
    db.db.end();
  } else {
    db.db.close();
  }
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;