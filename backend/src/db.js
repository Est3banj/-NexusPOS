/**
 * Hybrid Database Layer - SQLite + PostgreSQL (Supabase)
 * 
 * Detecta DATABASE_URL para usar PostgreSQL (producción) o SQLite (desarrollo local).
 * Schema compatible con DIAN para facturación electrónica en Colombia.
 */

const path = require('path');
const fs = require('fs');

const isProduction = !!process.env.DATABASE_URL;
let db;

if (isProduction) {
  // PostgreSQL - Supabase/Production
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  db = pool;
  console.log('[DB] Connected to PostgreSQL (Supabase)');
} else {
  // SQLite - Desarrollo local
  const Database = require('better-sqlite3');
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'pos.db');
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  console.log('[DB] Connected to SQLite (local)');
}

// ============================================================================
// Helper Functions
// ============================================================================

function getServerTime() {
  return Date.now();
}

function createTimestamp() {
  return Date.now();
}

function parseJsonField(row, field) {
  if (!row) return null;
  try {
    return row[field] ? JSON.parse(row[field]) : null;
  } catch {
    return row[field];
  }
}

// ============================================================================
// SQL Templates (ANSI SQL compatible)
// ============================================================================

const CREATE_TABLES_SQL = isProduction ? '' : `
  -- Products
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    localId TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    cost REAL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    barcode TEXT,
    imageUrl TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    syncedAt INTEGER,
    UNIQUE(localId)
  );

  -- Sales (DIAN fields)
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    localId TEXT,
    invoicePrefix TEXT DEFAULT 'FV',
    invoiceNumber INTEGER,
    fullInvoiceNumber TEXT,
    items TEXT NOT NULL,
    subtotal REAL NOT NULL,
    taxAmount REAL NOT NULL,
    discount REAL DEFAULT 0,
    totalAmount REAL NOT NULL,
    paymentMethod TEXT NOT NULL,
    issueDate INTEGER,
    dueDate INTEGER,
    customerId INTEGER,
    status TEXT DEFAULT 'completed',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    syncedAt INTEGER,
    UNIQUE(localId)
  );

  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  -- Customers (Facturación Electrónica)
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT NOT NULL,
    identificationNumber TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    address TEXT,
    fiscalRegime TEXT NOT NULL DEFAULT 'Responsable de IVA',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  -- Invoice Ranges (DIAN)
  CREATE TABLE IF NOT EXISTS invoiceRanges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL UNIQUE,
    fromNumber INTEGER NOT NULL,
    toNumber INTEGER NOT NULL,
    currentNumber INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'invoice',
    active INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL
  );

  -- Invoices (Factus responses)
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    saleId INTEGER NOT NULL,
    factusUuid TEXT,
    dianStatus TEXT,
    pdfUrl TEXT,
    xmlUrl TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (saleId) REFERENCES sales(id)
  );

  -- Cash Sessions
  CREATE TABLE IF NOT EXISTS cashSessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openedBy INTEGER NOT NULL,
    openedAt INTEGER NOT NULL,
    closedAt INTEGER,
    initialCash REAL DEFAULT 0,
    actualCash REAL,
    expectedCash REAL,
    difference REAL DEFAULT 0,
    totalCashSales REAL DEFAULT 0,
    totalCardSales REAL DEFAULT 0,
    totalTransferSales REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (openedBy) REFERENCES users(id)
  );
`;

// ============================================================================
// Initialize Schema (SQLite only)
// ============================================================================

if (!isProduction) {
  const statements = CREATE_TABLES_SQL.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) db.exec(stmt);
  }
  
  // Create default invoice range if not exists
  const existingRange = db.prepare('SELECT * FROM invoiceRanges WHERE prefix = ?').get('FV');
  if (!existingRange) {
    db.prepare(`
      INSERT INTO invoiceRanges (prefix, fromNumber, toNumber, currentNumber, type, active, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('FV', 1, 999999, 0, 'invoice', 1, getServerTime());
  }
  
  console.log('[DB] SQLite schema initialized');
}

// ============================================================================
// Product Operations
// ============================================================================

const productOps = {
  async create(data) {
    const now = getServerTime();
    if (isProduction) {
      const result = await db.query(`
        INSERT INTO products (localId, name, description, category, price, cost, stock, barcode, imageUrl, createdAt, updatedAt, deleted)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
        RETURNING *
      `, [data.localId || null, data.name, data.description || null, data.category, data.price, data.cost || 0, data.stock, data.barcode || null, data.imageUrl || null, data.createdAt || now, now]);
      return result.rows[0];
    } else {
      const stmt = db.prepare(`
        INSERT INTO products (localId, name, description, category, price, cost, stock, barcode, imageUrl, createdAt, updatedAt, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);
      const result = stmt.run(data.localId || null, data.name, data.description || null, data.category, data.price, data.cost || 0, data.stock, data.barcode || null, data.imageUrl || null, data.createdAt || now, now);
      return this.getById(result.lastInsertRowid);
    }
  },

  async getAll() {
    if (isProduction) {
      const result = await db.query('SELECT * FROM products WHERE deleted = 0 ORDER BY updatedAt DESC');
      return result.rows;
    }
    return db.prepare('SELECT * FROM products WHERE deleted = 0 ORDER BY updatedAt DESC').all();
  },

  async getById(id) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  async getByLocalId(localId) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM products WHERE localId = $1', [localId]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM products WHERE localId = ?').get(localId);
  },

  async update(id, data) {
    const now = getServerTime();
    if (isProduction) {
      const existing = await this.getById(id);
      if (!existing) return null;
      
      const result = await db.query(`
        UPDATE products SET
          name = $1, description = $2, category = $3, price = $4, cost = $5,
          stock = $6, barcode = $7, imageUrl = $8, updatedAt = $9, deleted = $10
        WHERE id = $11
        RETURNING *
      `, [
        data.name ?? existing.name, data.description ?? existing.description,
        data.category ?? existing.category, data.price ?? existing.price,
        data.cost ?? existing.cost, data.stock ?? existing.stock,
        data.barcode ?? existing.barcode, data.imageUrl ?? existing.imageUrl,
        now, data.deleted ?? existing.deleted, id
      ]);
      return result.rows[0];
    }
    
    const existing = this.getById(id);
    if (!existing) return null;
    
    db.prepare(`
      UPDATE products SET name = ?, description = ?, category = ?, price = ?, cost = ?,
        stock = ?, barcode = ?, imageUrl = ?, updatedAt = ?, deleted = ?
      WHERE id = ?
    `).run(
      data.name ?? existing.name, data.description ?? existing.description,
      data.category ?? existing.category, data.price ?? existing.price,
      data.cost ?? existing.cost, data.stock ?? existing.stock,
      data.barcode ?? existing.barcode, data.imageUrl ?? existing.imageUrl,
      now, data.deleted ?? existing.deleted, id
    );
    return this.getById(id);
  },

  async delete(id) {
    const now = getServerTime();
    if (isProduction) {
      await db.query('UPDATE products SET deleted = 1, updatedAt = $1 WHERE id = $2', [now, id]);
      return { changes: 1 };
    }
    return db.prepare('UPDATE products SET deleted = 1, updatedAt = ? WHERE id = ?').run(now, id);
  },

  async getByCategory(category) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM products WHERE category = $1 AND deleted = 0 ORDER BY name', [category]);
      return result.rows;
    }
    return db.prepare('SELECT * FROM products WHERE category = ? AND deleted = 0 ORDER BY name').all(category);
  },

  async getCategories() {
    if (isProduction) {
      const result = await db.query('SELECT DISTINCT category FROM products WHERE deleted = 0 ORDER BY category');
      return result.rows.map(row => row.category);
    }
    return db.prepare('SELECT DISTINCT category FROM products WHERE deleted = 0 ORDER BY category').all().map(r => r.category);
  }
};

// ============================================================================
// Sale Operations (DIAN Compatible)
// ============================================================================

const saleOps = {
  async create(data) {
    const now = getServerTime();
    
    // Get next invoice number
    let invoicePrefix = 'FV';
    let invoiceNumber = 1;
    
    if (isProduction) {
      const range = await db.query('SELECT * FROM invoiceRanges WHERE prefix = $1 AND active = 1 FOR UPDATE', [invoicePrefix]);
      if (range.rows.length > 0) {
        invoicePrefix = range.rows[0].prefix;
        invoiceNumber = range.rows[0].currentNumber + 1;
        await db.query('UPDATE invoiceRanges SET currentNumber = $1 WHERE prefix = $2', [invoiceNumber, invoicePrefix]);
      }
    } else {
      const range = db.prepare('SELECT * FROM invoiceRanges WHERE prefix = ? AND active = 1').get(invoicePrefix);
      if (range) {
        invoicePrefix = range.prefix;
        invoiceNumber = range.currentNumber + 1;
        db.prepare('UPDATE invoiceRanges SET currentNumber = ? WHERE prefix = ?').run(invoiceNumber, invoicePrefix);
      }
    }
    
    const fullInvoiceNumber = `${invoicePrefix}${invoiceNumber.toString().padStart(6, '0')}`;
    
    if (isProduction) {
      const result = await db.query(`
        INSERT INTO sales (localId, invoicePrefix, invoiceNumber, fullInvoiceNumber, items, subtotal, taxAmount, discount, totalAmount, paymentMethod, issueDate, dueDate, customerId, status, createdAt, updatedAt, deleted)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'completed', $14, $15, 0)
        RETURNING *
      `, [data.localId || null, invoicePrefix, invoiceNumber, fullInvoiceNumber, JSON.stringify(data.items), data.subtotal, data.taxAmount || 0, data.discount || 0, data.totalAmount, data.paymentMethod, data.issueDate || now, data.dueDate || null, data.customerId || null, data.createdAt || now, now]);
      return result.rows[0];
    } else {
      const stmt = db.prepare(`
        INSERT INTO sales (localId, invoicePrefix, invoiceNumber, fullInvoiceNumber, items, subtotal, taxAmount, discount, totalAmount, paymentMethod, issueDate, dueDate, customerId, status, createdAt, updatedAt, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 0)
      `);
      const result = stmt.run(data.localId || null, invoicePrefix, invoiceNumber, fullInvoiceNumber, JSON.stringify(data.items), data.subtotal, data.taxAmount || 0, data.discount || 0, data.totalAmount, data.paymentMethod, data.issueDate || now, data.dueDate || null, data.customerId || null, data.createdAt || now, now);
      return this.getById(result.lastInsertRowid);
    }
  },

  async getAll() {
    if (isProduction) {
      const result = await db.query('SELECT * FROM sales WHERE deleted = 0 ORDER BY createdAt DESC');
      return result.rows.map(row => ({ ...row, items: parseJsonField(row, 'items') }));
    }
    const rows = db.prepare('SELECT * FROM sales WHERE deleted = 0 ORDER BY createdAt DESC').all();
    return rows.map(row => ({ ...row, items: parseJsonField(row, 'items') }));
  },

  async getById(id) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM sales WHERE id = $1', [id]);
      const row = result.rows[0];
      if (row) row.items = parseJsonField(row, 'items');
      return row;
    }
    const row = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (row) row.items = parseJsonField(row, 'items');
    return row;
  },

  async getByLocalId(localId) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM sales WHERE localId = $1', [localId]);
      const row = result.rows[0];
      if (row) row.items = parseJsonField(row, 'items');
      return row;
    }
    const row = db.prepare('SELECT * FROM sales WHERE localId = ?').get(localId);
    if (row) row.items = parseJsonField(row, 'items');
    return row;
  },

  async update(id, data) {
    const now = getServerTime();
    if (isProduction) {
      const existing = await this.getById(id);
      if (!existing) return null;
      
      const result = await db.query(`
        UPDATE sales SET items = $1, subtotal = $2, taxAmount = $3, discount = $4, totalAmount = $5, paymentMethod = $6, updatedAt = $7, deleted = $8
        WHERE id = $9
        RETURNING *
      `, [JSON.stringify(data.items ?? existing.items), data.subtotal ?? existing.subtotal, data.taxAmount ?? existing.taxAmount, data.discount ?? existing.discount, data.totalAmount ?? existing.totalAmount, data.paymentMethod ?? existing.paymentMethod, now, data.deleted ?? existing.deleted, id]);
      return result.rows[0];
    }
    
    const existing = this.getById(id);
    if (!existing) return null;
    
    db.prepare('UPDATE sales SET items = ?, subtotal = ?, taxAmount = ?, discount = ?, totalAmount = ?, paymentMethod = ?, updatedAt = ?, deleted = ? WHERE id = ?')
      .run(JSON.stringify(data.items ?? existing.items), data.subtotal ?? existing.subtotal, data.taxAmount ?? existing.taxAmount, data.discount ?? existing.discount, data.totalAmount ?? existing.totalAmount, data.paymentMethod ?? existing.paymentMethod, now, data.deleted ?? existing.deleted, id);
    return this.getById(id);
  },

  async delete(id) {
    const now = getServerTime();
    if (isProduction) {
      await db.query('UPDATE sales SET deleted = 1, updatedAt = $1 WHERE id = $2', [now, id]);
      return { changes: 1 };
    }
    return db.prepare('UPDATE sales SET deleted = 1, updatedAt = ? WHERE id = ?').run(now, id);
  },

  async getByDateRange(startDate, endDate) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM sales WHERE createdAt >= $1 AND createdAt <= $2 AND deleted = 0 ORDER BY createdAt DESC', [startDate, endDate]);
      return result.rows.map(row => ({ ...row, items: parseJsonField(row, 'items') }));
    }
    const rows = db.prepare('SELECT * FROM sales WHERE createdAt >= ? AND createdAt <= ? AND deleted = 0 ORDER BY createdAt DESC').all(startDate, endDate);
    return rows.map(row => ({ ...row, items: parseJsonField(row, 'items') }));
  }
};

// ============================================================================
// User Operations
// ============================================================================

const userOps = {
  async create(data) {
    const now = getServerTime();
    if (isProduction) {
      try {
        const result = await db.query(`
          INSERT INTO users (username, password, role, createdAt, updatedAt)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, username, role, createdAt, updatedAt
        `, [data.username, data.password, data.role || 'EMPLOYEE', data.createdAt || now, now]);
        return result.rows[0];
      } catch (error) {
        if (error.code === '23505') return { error: 'Username already exists' };
        throw error;
      }
    }
    
    try {
      const stmt = db.prepare('INSERT INTO users (username, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(data.username, data.password, data.role || 'EMPLOYEE', data.createdAt || now, now);
      return this.getById(result.lastInsertRowid);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) return { error: 'Username already exists' };
      throw error;
    }
  },

  async getAll() {
    if (isProduction) {
      const result = await db.query('SELECT id, username, role, createdAt, updatedAt FROM users ORDER BY username');
      return result.rows;
    }
    return db.prepare('SELECT id, username, role, createdAt, updatedAt FROM users ORDER BY username').all();
  },

  async getById(id) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  async getByUsername(username) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  async update(id, data) {
    const now = getServerTime();
    if (isProduction) {
      const existing = await this.getById(id);
      if (!existing) return null;
      
      const result = await db.query(`
        UPDATE users SET username = $1, password = $2, role = $3, updatedAt = $4
        WHERE id = $5
        RETURNING *
      `, [data.username ?? existing.username, data.password ?? existing.password, data.role ?? existing.role, now, id]);
      return result.rows[0];
    }
    
    const existing = this.getById(id);
    if (!existing) return null;
    
    db.prepare('UPDATE users SET username = ?, password = ?, role = ?, updatedAt = ? WHERE id = ?')
      .run(data.username ?? existing.username, data.password ?? existing.password, data.role ?? existing.role, now, id);
    return this.getById(id);
  },

  async delete(id) {
    if (isProduction) {
      await db.query('DELETE FROM users WHERE id = $1', [id]);
      return { changes: 1 };
    }
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
};

// ============================================================================
// Customer Operations (Facturación)
// ============================================================================

const customerOps = {
  async create(data) {
    const now = getServerTime();
    if (isProduction) {
      try {
        const result = await db.query(`
          INSERT INTO customers (fullName, identificationNumber, email, phone, address, fiscalRegime, createdAt, updatedAt)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [data.fullName, data.identificationNumber, data.email || null, data.phone || null, data.address || null, data.fiscalRegime || 'Responsable de IVA', now, now]);
        return result.rows[0];
      } catch (error) {
        if (error.code === '23505') return { error: 'Cliente ya existe' };
        throw error;
      }
    }
    
    try {
      const stmt = db.prepare('INSERT INTO customers (fullName, identificationNumber, email, phone, address, fiscalRegime, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const result = stmt.run(data.fullName, data.identificationNumber, data.email || null, data.phone || null, data.address || null, data.fiscalRegime || 'Responsable de IVA', now, now);
      return this.getById(result.lastInsertRowid);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) return { error: 'Cliente ya existe' };
      throw error;
    }
  },

  async getAll() {
    if (isProduction) {
      const result = await db.query('SELECT * FROM customers ORDER BY fullName');
      return result.rows;
    }
    return db.prepare('SELECT * FROM customers ORDER BY fullName').all();
  },

  async getById(id) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM customers WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  },

  async getByIdentification(number) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM customers WHERE identificationNumber = $1', [number]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM customers WHERE identificationNumber = ?').get(number);
  },

  async update(id, data) {
    const now = getServerTime();
    if (isProduction) {
      const existing = await this.getById(id);
      if (!existing) return null;
      
      const result = await db.query(`
        UPDATE customers SET fullName = $1, identificationNumber = $2, email = $3, phone = $4, address = $5, fiscalRegime = $6, updatedAt = $7
        WHERE id = $8
        RETURNING *
      `, [data.fullName ?? existing.fullName, data.identificationNumber ?? existing.identificationNumber, data.email ?? existing.email, data.phone ?? existing.phone, data.address ?? existing.address, data.fiscalRegime ?? existing.fiscalRegime, now, id]);
      return result.rows[0];
    }
    
    const existing = this.getById(id);
    if (!existing) return null;
    
    db.prepare('UPDATE customers SET fullName = ?, identificationNumber = ?, email = ?, phone = ?, address = ?, fiscalRegime = ?, updatedAt = ? WHERE id = ?')
      .run(data.fullName ?? existing.fullName, data.identificationNumber ?? existing.identificationNumber, data.email ?? existing.email, data.phone ?? existing.phone, data.address ?? existing.address, data.fiscalRegime ?? existing.fiscalRegime, now, id);
    return this.getById(id);
  },

  async delete(id) {
    if (isProduction) {
      await db.query('DELETE FROM customers WHERE id = $1', [id]);
      return { changes: 1 };
    }
    return db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  }
};

// ============================================================================
// Invoice Operations (Factus)
// ============================================================================

const invoiceOps = {
  async create(data) {
    const now = getServerTime();
    if (isProduction) {
      const result = await db.query(`
        INSERT INTO invoices (saleId, factusUuid, dianStatus, pdfUrl, xmlUrl, createdAt, updatedAt)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [data.saleId, data.factusUuid || null, data.dianStatus || 'pending', data.pdfUrl || null, data.xmlUrl || null, now, now]);
      return result.rows[0];
    }
    
    const stmt = db.prepare('INSERT INTO invoices (saleId, factusUuid, dianStatus, pdfUrl, xmlUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const result = stmt.run(data.saleId, data.factusUuid || null, data.dianStatus || 'pending', data.pdfUrl || null, data.xmlUrl || null, now, now);
    return this.getById(result.lastInsertRowid);
  },

  async getBySaleId(saleId) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM invoices WHERE saleId = $1', [saleId]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM invoices WHERE saleId = ?').get(saleId);
  },

  async updateStatus(id, status, urls) {
    const now = getServerTime();
    if (isProduction) {
      await db.query(`
        UPDATE invoices SET dianStatus = $1, pdfUrl = $2, xmlUrl = $3, updatedAt = $4
        WHERE id = $5
      `, [status, urls?.pdfUrl || null, urls?.xmlUrl || null, now, id]);
      return { changes: 1 };
    }
    return db.prepare('UPDATE invoices SET dianStatus = ?, pdfUrl = ?, xmlUrl = ?, updatedAt = ? WHERE id = ?')
      .run(status, urls?.pdfUrl || null, urls?.xmlUrl || null, now, id);
  }
};

// ============================================================================
// Cash Session Operations
// ============================================================================

const cashSessionOps = {
  async create(data) {
    const now = getServerTime();
    if (isProduction) {
      const result = await db.query(`
        INSERT INTO cashSessions (openedBy, openedAt, initialCash, totalCashSales, totalCardSales, totalTransferSales, status, createdAt, updatedAt)
        VALUES ($1, $2, $3, 0, 0, 0, 'open', $4, $5)
        RETURNING *
      `, [data.openedBy, data.openedAt || now, data.initialCash || 0, now, now]);
      return result.rows[0];
    }
    
    const stmt = db.prepare('INSERT INTO cashSessions (openedBy, openedAt, initialCash, totalCashSales, totalCardSales, totalTransferSales, status, createdAt, updatedAt) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?)');
    const result = stmt.run(data.openedBy, data.openedAt || now, data.initialCash || 0, 'open', now, now);
    return this.getById(result.lastInsertRowid);
  },

  async getAll() {
    if (isProduction) {
      const result = await db.query('SELECT * FROM cashSessions ORDER BY openedAt DESC');
      return result.rows;
    }
    return db.prepare('SELECT * FROM cashSessions ORDER BY openedAt DESC').all();
  },

  async getOpenSession() {
    if (isProduction) {
      const result = await db.query("SELECT * FROM cashSessions WHERE status = 'open' ORDER BY openedAt DESC LIMIT 1");
      return result.rows[0] || null;
    }
    return db.prepare("SELECT * FROM cashSessions WHERE status = 'open' ORDER BY openedAt DESC LIMIT 1").get();
  },

  async getById(id) {
    if (isProduction) {
      const result = await db.query('SELECT * FROM cashSessions WHERE id = $1', [id]);
      return result.rows[0] || null;
    }
    return db.prepare('SELECT * FROM cashSessions WHERE id = ?').get(id);
  },

  async close(id, data) {
    const now = getServerTime();
    if (isProduction) {
      await db.query(`
        UPDATE cashSessions SET closedAt = $1, actualCash = $2, expectedCash = $3, difference = $4, 
          totalCashSales = $5, totalCardSales = $6, totalTransferSales = $7, status = 'closed', updatedAt = $8
        WHERE id = $9
      `, [now, data.actualCash, data.expectedCash, data.difference, data.totalCashSales, data.totalCardSales, data.totalTransferSales, now, id]);
      return this.getById(id);
    }
    
    db.prepare(`
      UPDATE cashSessions SET closedAt = ?, actualCash = ?, expectedCash = ?, difference = ?,
        totalCashSales = ?, totalCardSales = ?, totalTransferSales = ?, status = 'closed', updatedAt = ?
      WHERE id = ?
    `).run(now, data.actualCash, data.expectedCash, data.difference, data.totalCashSales, data.totalCardSales, data.totalTransferSales, now, id);
    return this.getById(id);
  }
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  db,
  isProduction,
  getServerTime,
  createTimestamp,
  products: productOps,
  sales: saleOps,
  users: userOps,
  customers: customerOps,
  invoices: invoiceOps,
  cashSessions: cashSessionOps
};