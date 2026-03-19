/**
 * Sales API Routes
 * 
 * CRUD endpoints for sales with offline sync support.
 * Handles Last Write Wins conflict resolution.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/sales
 * Get all sales
 */
router.get('/', (req, res) => {
  try {
    const sales = db.sales.getAll();
    res.json(sales);
  } catch (error) {
    console.error('[sales] GET all error:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

/**
 * GET /api/sales/:id
 * Get sale by ID
 */
router.get('/:id', (req, res) => {
  try {
    const sale = db.sales.getById(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.json(sale);
  } catch (error) {
    console.error('[sales] GET by id error:', error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

/**
 * GET /api/sales/range/:start/:end
 * Get sales by date range
 */
router.get('/range/:start/:end', (req, res) => {
  try {
    const startDate = parseInt(req.params.start);
    const endDate = parseInt(req.params.end);
    
    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const sales = db.sales.getByDateRange(startDate, endDate);
    res.json(sales);
  } catch (error) {
    console.error('[sales] GET by date range error:', error);
    res.status(500).json({ error: 'Failed to fetch sales by date range' });
  }
});

/**
 * POST /api/sales
 * Create a new sale (supports offline sync)
 */
router.post('/', (req, res) => {
  try {
    const { items, subtotal, tax, total, paymentMethod, localId, createdAt } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid required fields: items (array required)' 
      });
    }

    if (subtotal === undefined || tax === undefined || total === undefined || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Missing required fields: subtotal, tax, total, paymentMethod' 
      });
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'transfer'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ 
        error: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}` 
      });
    }

    // Check if localId already exists (might be a retry from offline)
    if (localId) {
      const existing = db.sales.getByLocalId(localId);
      if (existing) {
        // Already synced, return existing
        return res.json({
          ...existing,
          serverTime: db.getServerTime()
        });
      }
    }

    const sale = db.sales.create({
      items,
      subtotal,
      tax,
      total,
      paymentMethod,
      localId,
      createdAt: createdAt || Date.now()
    });

    console.log(`[sales] Created sale ${sale.id} (localId: ${localId || 'none'})`);

    // Update product stock (reduce inventory)
    for (const item of items) {
      if (item.productId) {
        const product = db.products.getById(item.productId);
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          db.products.update(item.productId, { stock: newStock });
        }
      }
    }

    res.status(201).json({
      ...sale,
      serverTime: db.getServerTime()
    });
  } catch (error) {
    console.error('[sales] POST error:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

/**
 * PUT /api/sales/:id
 * Update a sale (supports offline sync with LWW)
 */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { items, subtotal, tax, total, paymentMethod, updatedAt, deleted } = req.body;

    // Check if sale exists
    const existing = db.sales.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Check for conflict (Last Write Wins)
    if (updatedAt && updatedAt < existing.updatedAt) {
      console.log(`[sales] Conflict on update ${id}: client ${updatedAt} < server ${existing.updatedAt}`);
      return res.status(409).json({
        conflict: true,
        serverData: existing,
        serverTime: existing.updatedAt,
        message: 'Server version is newer, client changes were overwritten'
      });
    }

    const updated = db.sales.update(id, {
      items,
      subtotal,
      tax,
      total,
      paymentMethod,
      updatedAt,
      deleted
    });

    console.log(`[sales] Updated sale ${id}`);

    res.json({
      ...updated,
      serverTime: db.getServerTime()
    });
  } catch (error) {
    console.error('[sales] PUT error:', error);
    res.status(500).json({ error: 'Failed to update sale' });
  }
});

/**
 * DELETE /api/sales/:id
 * Delete a sale (soft delete)
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Check if sale exists
    const existing = db.sales.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    db.sales.delete(id);
    console.log(`[sales] Deleted sale ${id}`);

    res.json({ 
      success: true, 
      serverTime: db.getServerTime() 
    });
  } catch (error) {
    console.error('[sales] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete sale' });
  }
});

module.exports = router;
