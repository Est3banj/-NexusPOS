/**
 * Sync API Routes
 * 
 * Endpoints for batch sync operations and conflict resolution.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/sync/status
 * Get sync status (server time, pending counts)
 */
router.get('/status', (req, res) => {
  try {
    const serverTime = db.getServerTime();
    
    res.json({
      serverTime,
      status: 'ok',
      version: '1.0.0'
    });
  } catch (error) {
    console.error('[sync] GET status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

/**
 * POST /api/sync/batch
 * Batch sync multiple operations
 * 
 * Request body:
 * {
 *   products: [
 *     { operation: 'CREATE'|'UPDATE'|'DELETE', data: {...} },
 *     ...
 *   ],
 *   sales: [
 *     { operation: 'CREATE'|'UPDATE'|'DELETE', data: {...} },
 *     ...
 *   ]
 * }
 */
router.post('/batch', (req, res) => {
  try {
    const { products = [], sales = [] } = req.body;
    const serverTime = db.getServerTime();
    const results = {
      products: { success: 0, failed: 0, conflicts: [] },
      sales: { success: 0, failed: 0, conflicts: [] }
    };

    // Process products
    for (const item of products) {
      try {
        const { operation, data } = item;
        
        switch (operation) {
          case 'CREATE': {
            // Check if localId already exists
            if (data.localId) {
              const existing = db.products.getByLocalId(data.localId);
              if (existing) {
                results.products.success++;
                continue;
              }
            }
            db.products.create(data);
            results.products.success++;
            break;
          }
          case 'UPDATE': {
            if (!data.id) break;
            const updated = db.products.update(data.id, data);
            if (updated && updated.conflict) {
              results.products.conflicts.push({ id: data.id, serverData: updated.serverData });
            } else {
              results.products.success++;
            }
            break;
          }
          case 'DELETE': {
            if (!data.id) break;
            db.products.delete(data.id);
            results.products.success++;
            break;
          }
        }
      } catch (err) {
        console.error('[sync] Batch product error:', err);
        results.products.failed++;
      }
    }

    // Process sales
    for (const item of sales) {
      try {
        const { operation, data } = item;
        
        switch (operation) {
          case 'CREATE': {
            // Check if localId already exists
            if (data.localId) {
              const existing = db.sales.getByLocalId(data.localId);
              if (existing) {
                results.sales.success++;
                continue;
              }
            }
            db.sales.create(data);
            results.sales.success++;
            break;
          }
          case 'UPDATE': {
            if (!data.id) break;
            const updated = db.sales.update(data.id, data);
            if (updated && updated.conflict) {
              results.sales.conflicts.push({ id: data.id, serverData: updated.serverData });
            } else {
              results.sales.success++;
            }
            break;
          }
          case 'DELETE': {
            if (!data.id) break;
            db.sales.delete(data.id);
            results.sales.success++;
            break;
          }
        }
      } catch (err) {
        console.error('[sync] Batch sale error:', err);
        results.sales.failed++;
      }
    }

    console.log(`[sync] Batch sync complete: products=${results.products.success}/${products.length}, sales=${results.sales.success}/${sales.length}`);

    res.json({
      serverTime,
      results,
      success: results.products.failed === 0 && results.sales.failed === 0
    });
  } catch (error) {
    console.error('[sync] POST batch error:', error);
    res.status(500).json({ error: 'Failed to process batch sync' });
  }
});

/**
 * POST /api/sync/resolve/:type/:id
 * Resolve a conflict (accept server or client version)
 * 
 * Request body:
 * {
 *   resolution: 'server' | 'client',
 *   clientData: {...} // required if resolution is 'client'
 * }
 */
router.post('/resolve/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;
    const { resolution, clientData } = req.body;
    const serverTime = db.getServerTime();

    if (!['products', 'sales'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be products or sales' });
    }

    if (!['server', 'client'].includes(resolution)) {
      return res.status(400).json({ error: 'Invalid resolution. Must be server or client' });
    }

    const table = type === 'products' ? db.products : db.sales;
    const itemId = parseInt(id);

    if (resolution === 'server') {
      // Just return current server data
      const serverData = table.getById(itemId);
      return res.json({ serverData, serverTime, resolved: true });
    }

    // Resolution is 'client' - force update with client data
    if (!clientData) {
      return res.status(400).json({ error: 'clientData required when resolution is client' });
    }

    // Force update (ignore timestamp check)
    const updated = table.update(itemId, {
      ...clientData,
      updatedAt: serverTime // Set to current server time
    });

    console.log(`[sync] Conflict resolved for ${type}/${id} with client data`);

    res.json({
      ...updated,
      serverTime,
      resolved: true
    });
  } catch (error) {
    console.error('[sync] POST resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

module.exports = router;
