/**
 * Products API Routes
 * 
 * CRUD endpoints for products with offline sync support.
 * Handles Last Write Wins conflict resolution.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/products
 * Get all products
 */
router.get('/', (req, res) => {
  try {
    const products = db.products.getAll();
    res.json(products);
  } catch (error) {
    console.error('[products] GET all error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 * Get product by ID
 */
router.get('/:id', (req, res) => {
  try {
    const product = db.products.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('[products] GET by id error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * GET /api/products/category/:category
 * Get products by category
 */
router.get('/category/:category', (req, res) => {
  try {
    const products = db.products.getByCategory(req.params.category);
    res.json(products);
  } catch (error) {
    console.error('[products] GET by category error:', error);
    res.status(500).json({ error: 'Failed to fetch products by category' });
  }
});

/**
 * GET /api/products/categories
 * Get all categories
 */
router.get('/meta/categories', (req, res) => {
  try {
    const categories = db.products.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('[products] GET categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/products
 * Create a new product (supports offline sync)
 */
router.post('/', (req, res) => {
  try {
    const { name, category, price, stock, description, imageUrl, localId, updatedAt } = req.body;

    // Validate required fields
    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, category, price, stock' 
      });
    }

    // Check if localId already exists (might be a retry from offline)
    if (localId) {
      const existing = db.products.getByLocalId(localId);
      if (existing) {
        // Already synced, return existing
        return res.json({
          ...existing,
          serverTime: db.getServerTime()
        });
      }
    }

    const product = db.products.create({
      name,
      category,
      price,
      stock,
      description,
      imageUrl,
      localId,
      createdAt: updatedAt || Date.now()
    });

    console.log(`[products] Created product ${product.id} (localId: ${localId || 'none'})`);

    res.status(201).json({
      ...product,
      serverTime: db.getServerTime()
    });
  } catch (error) {
    console.error('[products] POST error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /api/products/:id
 * Update a product (supports offline sync with LWW)
 */
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, price, stock, description, imageUrl, updatedAt, deleted } = req.body;

    // Check if product exists
    const existing = db.products.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check for conflict (Last Write Wins)
    if (updatedAt && updatedAt < existing.updatedAt) {
      console.log(`[products] Conflict on update ${id}: client ${updatedAt} < server ${existing.updatedAt}`);
      return res.status(409).json({
        conflict: true,
        serverData: existing,
        serverTime: existing.updatedAt,
        message: 'Server version is newer, client changes were overwritten'
      });
    }

    const updated = db.products.update(id, {
      name,
      category,
      price,
      stock,
      description,
      imageUrl,
      updatedAt,
      deleted
    });

    console.log(`[products] Updated product ${id}`);

    res.json({
      ...updated,
      serverTime: db.getServerTime()
    });
  } catch (error) {
    console.error('[products] PUT error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/:id
 * Delete a product (soft delete)
 */
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Check if product exists
    const existing = db.products.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    db.products.delete(id);
    console.log(`[products] Deleted product ${id}`);

    res.json({ 
      success: true, 
      serverTime: db.getServerTime() 
    });
  } catch (error) {
    console.error('[products] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
