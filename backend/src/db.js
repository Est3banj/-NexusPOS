/**
 * SQLite Database Setup
 * 
 * Initializes SQLite database with schema for products and sales.
 * Includes timestamp fields for Last Write Wins conflict resolution.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database file path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'pos.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
function initializeSchema() {
  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      localId TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      imageUrl TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      syncedAt INTEGER,
      UNIQUE(localId)
    )
  `);

  // Create indices for products
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_updatedAt ON products(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted);
  `);

  // Sales table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      localId TEXT,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      syncedAt INTEGER,
      UNIQUE(localId)
    )
  `);

  // Create indices for sales
  db.exec(`
    CREATE INDEX IF NOT EXISTS sales_createdAt ON sales(createdAt);
    CREATE INDEX IF NOT EXISTS sales_paymentMethod ON sales(paymentMethod);
    CREATE INDEX IF NOT EXISTS sales_deleted ON sales(deleted);
  `);

  console.log('[DB] Schema initialized successfully');
}

// Helper functions
function getServerTime() {
  return Date.now();
}

function createTimestamp() {
  return Date.now();
}

/**
 * Product operations
 */
const productOps = {
  /**
   * Create a new product
   */
  create(data) {
    const now = getServerTime();
    const stmt = db.prepare(`
      INSERT INTO products (localId, name, description, category, price, stock, imageUrl, createdAt, updatedAt, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
    
    const result = stmt.run(
      data.localId || null,
      data.name,
      data.description || null,
      data.category,
      data.price,
      data.stock,
      data.imageUrl || null,
      data.createdAt || now,
      now
    );
    
    return this.getById(result.lastInsertRowid);
  },

  /**
   * Get all products (excluding soft-deleted)
   */
  getAll() {
    const stmt = db.prepare(`
      SELECT * FROM products WHERE deleted = 0 ORDER BY updatedAt DESC
    `);
    return stmt.all();
  },

  /**
   * Get product by ID
   */
  getById(id) {
    const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
    return stmt.get(id);
  },

  /**
   * Get product by local ID
   */
  getByLocalId(localId) {
    const stmt = db.prepare('SELECT * FROM products WHERE localId = ?');
    return stmt.get(localId);
  },

  /**
   * Update a product
   */
  update(id, data) {
    const now = getServerTime();
    
    // Get existing product
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    // Check for conflict (Last Write Wins)
    if (data.updatedAt && data.updatedAt < existing.updatedAt) {
      return { conflict: true, serverData: existing, serverTime: existing.updatedAt };
    }

    const stmt = db.prepare(`
      UPDATE products SET
        name = ?,
        description = ?,
        category = ?,
        price = ?,
        stock = ?,
        imageUrl = ?,
        updatedAt = ?,
        deleted = ?
      WHERE id = ?
    `);

    stmt.run(
      data.name ?? existing.name,
      data.description ?? existing.description,
      data.category ?? existing.category,
      data.price ?? existing.price,
      data.stock ?? existing.stock,
      data.imageUrl ?? existing.imageUrl,
      now,
      data.deleted ?? existing.deleted,
      id
    );

    return this.getById(id);
  },

  /**
   * Delete a product (soft delete)
   */
  delete(id) {
    const now = getServerTime();
    const stmt = db.prepare(`
      UPDATE products SET deleted = 1, updatedAt = ? WHERE id = ?
    `);
    return stmt.run(now, id);
  },

  /**
   * Query by category
   */
  getByCategory(category) {
    const stmt = db.prepare(`
      SELECT * FROM products WHERE category = ? AND deleted = 0 ORDER BY name
    `);
    return stmt.all(category);
  },

  /**
   * Get all unique categories
   */
  getCategories() {
    const stmt = db.prepare(`
      SELECT DISTINCT category FROM products WHERE deleted = 0 ORDER BY category
    `);
    return stmt.all().map(row => row.category);
  }
};

/**
 * Sale operations
 */
const saleOps = {
  /**
   * Create a new sale
   */
  create(data) {
    const now = getServerTime();
    const stmt = db.prepare(`
      INSERT INTO sales (localId, items, subtotal, tax, total, paymentMethod, createdAt, updatedAt, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
    
    const result = stmt.run(
      data.localId || null,
      JSON.stringify(data.items),
      data.subtotal,
      data.tax,
      data.total,
      data.paymentMethod,
      data.createdAt || now,
      now
    );
    
    return this.getById(result.lastInsertRowid);
  },

  /**
   * Get all sales (excluding soft-deleted)
   */
  getAll() {
    const stmt = db.prepare(`
      SELECT * FROM sales WHERE deleted = 0 ORDER BY createdAt DESC
    `);
    const rows = stmt.all();
    return rows.map(row => ({
      ...row,
      items: JSON.parse(row.items)
    }));
  },

  /**
   * Get sale by ID
   */
  getById(id) {
    const stmt = db.prepare('SELECT * FROM sales WHERE id = ?');
    const row = stmt.get(id);
    if (row) {
      row.items = JSON.parse(row.items);
    }
    return row;
  },

  /**
   * Get sale by local ID
   */
  getByLocalId(localId) {
    const stmt = db.prepare('SELECT * FROM sales WHERE localId = ?');
    const row = stmt.get(localId);
    if (row) {
      row.items = JSON.parse(row.items);
    }
    return row;
  },

  /**
   * Update a sale
   */
  update(id, data) {
    const now = getServerTime();
    
    // Get existing sale
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    // Check for conflict (Last Write Wins)
    if (data.updatedAt && data.updatedAt < existing.updatedAt) {
      return { conflict: true, serverData: existing, serverTime: existing.updatedAt };
    }

    const stmt = db.prepare(`
      UPDATE sales SET
        items = ?,
        subtotal = ?,
        tax = ?,
        total = ?,
        paymentMethod = ?,
        updatedAt = ?,
        deleted = ?
      WHERE id = ?
    `);

    stmt.run(
      data.items ? JSON.stringify(data.items) : JSON.stringify(existing.items),
      data.subtotal ?? existing.subtotal,
      data.tax ?? existing.tax,
      data.total ?? existing.total,
      data.paymentMethod ?? existing.paymentMethod,
      now,
      data.deleted ?? existing.deleted,
      id
    );

    return this.getById(id);
  },

  /**
   * Delete a sale (soft delete)
   */
  delete(id) {
    const now = getServerTime();
    const stmt = db.prepare(`
      UPDATE sales SET deleted = 1, updatedAt = ? WHERE id = ?
    `);
    return stmt.run(now, id);
  },

  /**
   * Query by date range
   */
  getByDateRange(startDate, endDate) {
    const stmt = db.prepare(`
      SELECT * FROM sales 
      WHERE createdAt >= ? AND createdAt <= ? AND deleted = 0 
      ORDER BY createdAt DESC
    `);
    const rows = stmt.all(startDate, endDate);
    return rows.map(row => ({
      ...row,
      items: JSON.parse(row.items)
    }));
  }
};

// Initialize schema
initializeSchema();

module.exports = {
  db,
  getServerTime,
  createTimestamp,
  products: productOps,
  sales: saleOps
};
