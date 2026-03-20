/**
 * Database Migrations Runner
 * 
 * Ejecuta las migraciones para PostgreSQL (Supabase).
 * Este script debe ejecutarse en el start de producción.
 */

const { Pool } = require('pg');

const MIGRATIONS = `
-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  "localId" TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  cost REAL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  barcode TEXT,
  "imageUrl" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  "syncedAt" INTEGER,
  UNIQUE("localId")
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_updatedat ON products("updatedAt");
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted);

-- Sales table (DIAN fields)
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  "localId" TEXT,
  "invoicePrefix" TEXT DEFAULT 'FV',
  "invoiceNumber" INTEGER,
  "fullInvoiceNumber" TEXT,
  items TEXT NOT NULL,
  subtotal REAL NOT NULL,
  "taxAmount" REAL NOT NULL,
  discount REAL DEFAULT 0,
  "totalAmount" REAL NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "issueDate" INTEGER,
  "dueDate" INTEGER,
  "customerId" INTEGER,
  status TEXT DEFAULT 'completed',
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  "syncedAt" INTEGER,
  UNIQUE("localId")
);

CREATE INDEX IF NOT EXISTS idx_sales_createdat ON sales("createdAt");
CREATE INDEX IF NOT EXISTS idx_sales_paymentmethod ON sales("paymentMethod");
CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deleted);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

-- Customers table (Facturación Electrónica)
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  "identificationNumber" TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  "fiscalRegime" TEXT NOT NULL DEFAULT 'Responsable de IVA',
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_identification ON customers("identificationNumber");

-- Invoice Ranges table (DIAN)
CREATE TABLE IF NOT EXISTS "invoiceRanges" (
  id SERIAL PRIMARY KEY,
  prefix TEXT NOT NULL UNIQUE,
  "fromNumber" INTEGER NOT NULL,
  "toNumber" INTEGER NOT NULL,
  "currentNumber" INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'invoice',
  active INTEGER DEFAULT 1,
  "createdAt" INTEGER NOT NULL
);

-- Invoices table (Factus responses)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  "saleId" INTEGER NOT NULL,
  "factusUuid" TEXT,
  "dianStatus" TEXT,
  "pdfUrl" TEXT,
  "xmlUrl" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  FOREIGN KEY ("saleId") REFERENCES sales(id)
);

-- Cash Sessions table
CREATE TABLE IF NOT EXISTS "cashSessions" (
  id SERIAL PRIMARY KEY,
  "openedBy" INTEGER NOT NULL,
  "openedAt" INTEGER NOT NULL,
  "closedAt" INTEGER,
  "initialCash" REAL DEFAULT 0,
  "actualCash" REAL,
  "expectedCash" REAL,
  difference REAL DEFAULT 0,
  "totalCashSales" REAL DEFAULT 0,
  "totalCardSales" REAL DEFAULT 0,
  "totalTransferSales" REAL DEFAULT 0,
  status TEXT DEFAULT 'open',
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  FOREIGN KEY ("openedBy") REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cashsessions_status ON "cashSessions"(status);
CREATE INDEX IF NOT EXISTS idx_cashsessions_openedat ON "cashSessions"("openedAt");
`;

const DEFAULT_INVOICE_RANGE = `
INSERT INTO "invoiceRanges" (prefix, "fromNumber", "toNumber", "currentNumber", type, active, "createdAt")
SELECT 'FV', 1, 999999, 0, 'invoice', 1, EXTRACT(EPOCH FROM NOW())::integer
WHERE NOT EXISTS (SELECT 1 FROM "invoiceRanges" WHERE prefix = 'FV');
`;

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('[Migrations] No DATABASE_URL found, skipping PostgreSQL migrations');
    console.log('[Migrations] Using SQLite schema from db.js');
    return;
  }
  
  console.log('[Migrations] Running PostgreSQL migrations...');
  
  let dbUrl = databaseUrl;
  if (!dbUrl.includes('sslmode')) {
    dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  
  const pool = new Pool({
    connectionString: dbUrl
  });
  
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  try {
    // Run migrations
    await pool.query(MIGRATIONS);
    console.log('[Migrations] Tables created successfully');
    
    // Insert default invoice range
    await pool.query(DEFAULT_INVOICE_RANGE);
    console.log('[Migrations] Default invoice range initialized');
    
    console.log('[Migrations] ✓ All migrations completed');
  } catch (error) {
    console.error('[Migrations] Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migrations] Done');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Migrations] Failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };