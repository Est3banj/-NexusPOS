/**
 * Customers API Routes
 * 
 * CRUD endpoints for customers (facturación electrónica DIAN).
 * Gestiona clientes para factura electrónica.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/customers
 * Get all customers
 */
router.get('/', async (req, res) => {
  try {
    const customers = await db.customers.getAll();
    res.json(customers);
  } catch (error) {
    console.error('[customers] GET all error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

/**
 * GET /api/customers/:id
 * Get customer by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const customer = await db.customers.getById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('[customers] GET by id error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

/**
 * GET /api/customers/identification/:number
 * Get customer by NIT/Cédula
 */
router.get('/identification/:number', async (req, res) => {
  try {
    const customer = await db.customers.getByIdentification(req.params.number);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('[customers] GET by identification error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

/**
 * POST /api/customers
 * Create a new customer
 */
router.post('/', async (req, res) => {
  try {
    const { fullName, identificationNumber, email, phone, address, fiscalRegime } = req.body;

    // Validate required fields
    if (!fullName || !identificationNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: fullName, identificationNumber' 
      });
    }

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const customer = await db.customers.create({
      fullName,
      identificationNumber,
      email,
      phone,
      address,
      fiscalRegime: fiscalRegime || 'Responsable de IVA'
    });

    if (customer.error) {
      return res.status(409).json({ error: customer.error });
    }

    console.log(`[customers] Created customer ${customer.id}: ${fullName}`);

    res.status(201).json({
      ...customer,
      serverTime: db.getServerTime()
    });
  } catch (error) {
    console.error('[customers] POST error:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

/**
 * PUT /api/customers/:id
 * Update a customer
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, identificationNumber, email, phone, address, fiscalRegime } = req.body;

    // Check if customer exists
    const existing = await db.customers.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updated = await db.customers.update(id, {
      fullName: fullName || existing.fullName,
      identificationNumber: identificationNumber || existing.identificationNumber,
      email: email !== undefined ? email : existing.email,
      phone: phone !== undefined ? phone : existing.phone,
      address: address !== undefined ? address : existing.address,
      fiscalRegime: fiscalRegime || existing.fiscalRegime
    });

    console.log(`[customers] Updated customer ${id}`);

    res.json({
      ...updated,
      serverTime: db.getServerTime()
    });
  } catch (error) {
    console.error('[customers] PUT error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

/**
 * DELETE /api/customers/:id
 * Delete a customer
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Check if customer exists
    const existing = await db.customers.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await db.customers.delete(id);
    console.log(`[customers] Deleted customer ${id}`);

    res.json({ 
      success: true, 
      serverTime: db.getServerTime() 
    });
  } catch (error) {
    console.error('[customers] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;