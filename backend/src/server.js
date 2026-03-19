/**
 * Express Server Setup
 * 
 * Main server file for the POS backend.
 * Sets up Express with routes and middleware.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import db for initialization
const db = require('./db');

// Import routes
const productsRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const syncRoutes = require('./routes/sync');

// Import middleware
const { 
  timestampsMiddleware, 
  corsMiddleware, 
  loggingMiddleware, 
  errorHandlingMiddleware 
} = require('./middleware/timestamps');

// Configuration
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Create Express app
const app = express();

// ============================================================================
// Middleware
// ============================================================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(corsMiddleware);

// Custom middleware
app.use(timestampsMiddleware);
app.use(loggingMiddleware);

// ============================================================================
// Health Check
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: db.getServerTime(),
    uptime: process.uptime()
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
// Error Handling
// ============================================================================

app.use(errorHandlingMiddleware);

// ============================================================================
// Server Start
// ============================================================================

app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     POS Backend Server                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running at http://${HOST}:${PORT}                       ║
║  API available at http://${HOST}:${PORT}/api                    ║
║                                                                   ║
║  Endpoints:                                                     ║
║    GET  /api/health          - Health check                     ║
║    GET  /api/products       - List products                    ║
║    POST /api/products       - Create product                   ║
║    GET  /api/sales          - List sales                      ║
║    POST /api/sales          - Create sale                     ║
║    POST /api/sync/batch     - Batch sync                       ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  db.db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down...');
  db.db.close();
  process.exit(0);
});

module.exports = app;
