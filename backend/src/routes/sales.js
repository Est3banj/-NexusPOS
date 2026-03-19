/**
 * Sales API Routes
 * 
 * CRUD endpoints for sales with DIAN fields for facturación electrónica.
 * Handles Last Write Wins conflict resolution.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

const IVA_RATE = 0.19; // 19% IVA standard

/**
 * Calcula el desglose de IVA desde precio con IVA incluido (Reverse Tax)
 */
function calculateReverseTax(total, ivaRate = IVA_RATE) {
  const subtotal = total / (1 + ivaRate);
  const taxAmount = total - subtotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

/**
 * GET /api/sales
 * Get all sales
 */
router.get('/', async (req, res) => {
  try {
    const sales = await db.sales.getAll();
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
router.get('/:id', async (req, res) => {
  try {
    const sale = await db.sales.getById(req.params.id);
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
router.get('/range/:start/:end', async (req, res) => {
  try {
    const startDate = parseInt(req.params.start);
    const endDate = parseInt(req.params.end);
    
    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    const sales = await db.sales.getByDateRange(startDate, endDate);
    res.json(sales);
  } catch (error) {
    console.error('[sales] GET by date range error:', error);
    res.status(500).json({ error: 'Failed to fetch sales by date range' });
  }
});

/**
 * POST /api/sales
 * Create a new sale (supports offline sync)
 * Calcula automáticamente el desglose de IVA (Reverse Tax)
 */
router.post('/', async (req, res) => {
  try {
    const { 
      items, 
      subtotal, 
      taxAmount, 
      discount, 
      totalAmount, 
      paymentMethod, 
      localId, 
      createdAt,
      issueDate,
      dueDate,
      customerId
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid required fields: items (array required)' 
      });
    }

    if (totalAmount === undefined || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Missing required fields: totalAmount, paymentMethod' 
      });
    }

    // Calculate tax breakdown if not provided (Reverse Tax)
    let finalSubtotal = subtotal;
    let finalTaxAmount = taxAmount;
    let finalTotal = totalAmount;
    let finalDiscount = discount || 0;

    if (subtotal === undefined || taxAmount === undefined) {
      // Price includes IVA - calculate backwards
      const taxCalc = calculateReverseTax(totalAmount - (discount || 0));
      finalSubtotal = taxCalc.subtotal;
      finalTaxAmount = taxCalc.taxAmount;
      finalTotal = totalAmount;
      finalDiscount = discount || 0;
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
      const existing = await db.sales.getByLocalId(localId);
      if (existing) {
        return res.json({
          ...existing,
          serverTime: db.getServerTime()
        });
      }
    }

    const now = Date.now();
    const sale = await db.sales.create({
      items,
      subtotal: finalSubtotal,
      taxAmount: finalTaxAmount,
      discount: finalDiscount,
      totalAmount: finalTotal,
      paymentMethod,
      localId,
      createdAt: createdAt || now,
      issueDate: issueDate || now,
      dueDate: dueDate || null,
      customerId: customerId || null
    });

    console.log(`[sales] Created sale ${sale.id} (Invoice: ${sale.fullInvoiceNumber})`);

    // Update product stock (reduce inventory)
    for (const item of items) {
      if (item.productId) {
        const product = await db.products.getById(item.productId);
        if (product) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await db.products.update(item.productId, { stock: newStock });
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
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { 
      items, 
      subtotal, 
      taxAmount, 
      discount, 
      totalAmount, 
      paymentMethod, 
      updatedAt, 
      deleted 
    } = req.body;

    // Check if sale exists
    const existing = await db.sales.getById(id);
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

    const updated = await db.sales.update(id, {
      items,
      subtotal: subtotal ?? existing.subtotal,
      taxAmount: taxAmount ?? existing.taxAmount,
      discount: discount ?? existing.discount,
      totalAmount: totalAmount ?? existing.totalAmount,
      paymentMethod: paymentMethod ?? existing.paymentMethod,
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
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Check if sale exists
    const existing = await db.sales.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    await db.sales.delete(id);
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

// ============================================================================
// Reportes - Resumen financiero
// ============================================================================

/**
 * GET /api/sales/report/monthly/:year/:month
 * Get monthly sales report
 */
router.get('/report/monthly/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    
    const startDate = new Date(year, month - 1, 1).getTime();
    const endDate = new Date(year, month, 0, 23, 59, 59).getTime();
    
    const sales = await db.sales.getByDateRange(startDate, endDate);
    
    const summary = sales.reduce((acc, sale) => {
      acc.totalVentas += sale.totalAmount;
      acc.totalIVA += sale.taxAmount;
      acc.totalNeto += sale.subtotal;
      
      if (sale.paymentMethod === 'cash') acc.metodoPago.efectivo += sale.totalAmount;
      else if (sale.paymentMethod === 'card') acc.metodoPago.tarjeta += sale.totalAmount;
      else acc.metodoPago.transferencia += sale.totalAmount;
      
      return acc;
    }, {
      totalVentas: 0,
      totalIVA: 0,
      totalNeto: 0,
      cantidadVentas: sales.length,
      metodoPago: { efectivo: 0, tarjeta: 0, transferencia: 0 }
    });

    res.json({
      year,
      month,
      sales: sales.length,
      summary
    });
  } catch (error) {
    console.error('[sales] Report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;