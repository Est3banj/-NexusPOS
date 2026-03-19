/**
 * Report Service - Financial Report Calculations
 * 
 * Provides calculations for monthly sales, revenue, costs, and profits.
 * Works with offline-first data from IndexedDB.
 */

import { saleRepository } from '../db/repositories/saleRepository';
import { productRepository } from '../db/repositories/productRepository';
import type { Sale, Product, PaymentMethod } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface DailyReport {
  date: string; // ISO date string (YYYY-MM-DD)
  dateLabel: string; // Human readable
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  transactionCount: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    transfer: number;
  };
}

export interface MonthlyReport {
  month: string; // YYYY-MM
  monthLabel: string; // Human readable
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  transactionCount: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    transfer: number;
  };
  dailyReports: DailyReport[];
}

export interface ReportSummary {
  monthlyRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  transactionCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get start and end timestamps for a specific month
 */
function getMonthRange(year: number, month: number): { start: number; end: number } {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[0];
}

/**
 * Format month as YYYY-MM
 */
function formatMonth(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get human readable month label
 */
function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

/**
 * Get human readable day label
 */
function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Get product cost by ID (from cache or fetch)
 */
async function getProductCost(productId: number, productCache: Map<number, Product>): Promise<number> {
  if (productCache.has(productId)) {
    return productCache.get(productId)!.cost || 0;
  }
  
  const product = await productRepository.getById(productId);
  if (product) {
    productCache.set(productId, product);
    return product.cost || 0;
  }
  
  return 0;
}

/**
 * Calculate sale profit
 * Profit = SUM((unitPrice - cost) * quantity) - tax
 * Note: Tax is already included in total, so we calculate profit from items
 */
async function calculateSaleProfit(
  sale: Sale, 
  productCache: Map<number, Product>
): Promise<{ revenue: number; cost: number; profit: number }> {
  let revenue = 0;
  let totalCost = 0;
  
  for (const item of sale.items) {
    // Revenue is the sale price (without tax)
    revenue += item.subtotal;
    
    // Cost calculation
    const cost = await getProductCost(item.productId, productCache);
    totalCost += cost * item.quantity;
  }
  
  // Subtract tax to get profit on revenue
  const profit = revenue - totalCost - sale.tax;
  
  return {
    revenue,
    cost: totalCost,
    profit: Math.max(0, profit) // Don't return negative profit
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get monthly report for a specific year and month
 */
export async function getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  const { start, end } = getMonthRange(year, month);
  
  // Get all sales in the month
  const sales = await saleRepository.queryByDateRange(start, end);
  
  // Build product cache
  const productCache = new Map<number, Product>();
  const products = await productRepository.getAll();
  products.forEach(p => p.id && productCache.set(p.id, p));
  
  // Group sales by day
  const dailyMap = new Map<string, {
    sales: Sale[];
    revenue: number;
    cost: number;
    profit: number;
    transactions: number;
    cash: number;
    card: number;
    transfer: number;
  }>();
  
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let transactionCount = 0;
  const paymentTotals = { cash: 0, card: 0, transfer: 0 };
  
  for (const sale of sales) {
    const dateKey = formatDate(sale.createdAt);
    
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        sales: [],
        revenue: 0,
        cost: 0,
        profit: 0,
        transactions: 0,
        cash: 0,
        card: 0,
        transfer: 0
      });
    }
    
    const dayData = dailyMap.get(dateKey)!;
    const { revenue, cost, profit } = await calculateSaleProfit(sale, productCache);
    
    dayData.sales.push(sale);
    dayData.revenue += revenue;
    dayData.cost += cost;
    dayData.profit += profit;
    dayData.transactions += 1;
    
    // Payment breakdown
    if (sale.paymentMethod === 'cash') {
      dayData.cash += sale.total;
      paymentTotals.cash += sale.total;
    } else if (sale.paymentMethod === 'card') {
      dayData.card += sale.total;
      paymentTotals.card += sale.total;
    } else if (sale.paymentMethod === 'transfer') {
      dayData.transfer += sale.total;
      paymentTotals.transfer += sale.total;
    }
    
    totalRevenue += revenue;
    totalCost += cost;
    totalProfit += profit;
    transactionCount += 1;
  }
  
  // Build daily reports
  const dailyReports: DailyReport[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      dateLabel: getDayLabel(date),
      totalRevenue: data.revenue,
      totalCost: data.cost,
      totalProfit: data.profit,
      transactionCount: data.transactions,
      paymentBreakdown: {
        cash: data.cash,
        card: data.card,
        transfer: data.transfer
      }
    }));
  
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const monthStr = formatMonth(start);
  
  return {
    month: monthStr,
    monthLabel: getMonthLabel(monthStr),
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
    transactionCount,
    paymentBreakdown: paymentTotals,
    dailyReports
  };
}

/**
 * Get current month's report (convenience function)
 */
export async function getCurrentMonthReport(): Promise<MonthlyReport> {
  const now = new Date();
  return getMonthlyReport(now.getFullYear(), now.getMonth());
}

/**
 * Get report summary for a specific month
 */
export async function getReportSummary(year: number, month: number): Promise<ReportSummary> {
  const report = await getMonthlyReport(year, month);
  
  return {
    monthlyRevenue: report.totalRevenue,
    totalCost: report.totalCost,
    totalProfit: report.totalProfit,
    profitMargin: report.profitMargin,
    transactionCount: report.transactionCount
  };
}

/**
 * Get current month summary (convenience function)
 */
export async function getCurrentMonthSummary(): Promise<ReportSummary> {
  const now = new Date();
  return getReportSummary(now.getFullYear(), now.getMonth());
}

export default {
  getMonthlyReport,
  getCurrentMonthReport,
  getReportSummary,
  getCurrentMonthSummary
};
