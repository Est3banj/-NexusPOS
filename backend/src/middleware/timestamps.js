/**
 * Timestamps Middleware
 * 
 * Express middleware for adding server timestamps to responses.
 * Also handles CORS and JSON parsing for offline sync requests.
 */

const db = require('../db');

/**
 * Add server timestamp to all responses
 */
function timestampsMiddleware(req, res, next) {
  // Store server time when request starts
  const serverTime = db.getServerTime();
  
  // Override json method to inject serverTime
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // Add serverTime to response if not already present
    if (data && typeof data === 'object' && !data.serverTime) {
      data.serverTime = serverTime;
    }
    return originalJson(data);
  };

  next();
}

/**
 * Validate sync request body
 * Ensures required fields are present for offline sync
 */
function validateSyncBody(req, res, next) {
  const { type, operation, data } = req.body;

  if (!type || !['products', 'sales'].includes(type)) {
    return res.status(400).json({ 
      error: 'Invalid or missing type. Must be products or sales' 
    });
  }

  if (!operation || !['CREATE', 'UPDATE', 'DELETE'].includes(operation)) {
    return res.status(400).json({ 
      error: 'Invalid or missing operation. Must be CREATE, UPDATE, or DELETE' 
    });
  }

  if (operation !== 'DELETE' && !data) {
    return res.status(400).json({ 
      error: 'Missing data for CREATE or UPDATE operation' 
    });
  }

  next();
}

/**
 * Handle preflight requests for CORS
 */
function corsMiddleware(req, res, next) {
  // Allow cross-origin requests (adjust in production)
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}

/**
 * Request logging middleware
 */
function loggingMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}

/**
 * Error handling middleware
 */
function errorHandlingMiddleware(err, req, res, next) {
  console.error('[Error]', err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

module.exports = {
  timestampsMiddleware,
  validateSyncBody,
  corsMiddleware,
  loggingMiddleware,
  errorHandlingMiddleware
};
