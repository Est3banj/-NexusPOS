/**
 * Reports Page Component
 * 
 * Displays monthly financial reports including revenue, costs, profits, and margins.
 * Admin-only access.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getMonthlyReport,
  getReportSummary,
  type MonthlyReport,
  type ReportSummary
} from '../services/reportService';

// Month options for selector
const MONTHS = [
  { value: 0, label: 'Enero' },
  { value: 1, label: 'Febrero' },
  { value: 2, label: 'Marzo' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Mayo' },
  { value: 5, label: 'Junio' },
  { value: 6, label: 'Julio' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Septiembre' },
  { value: 9, label: 'Octubre' },
  { value: 10, label: 'Noviembre' },
  { value: 11, label: 'Diciembre' }
];

function Reports() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [detailedReport, setDetailedReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [summaryData, detailedData] = await Promise.all([
        getReportSummary(selectedYear, selectedMonth),
        getMonthlyReport(selectedYear, selectedMonth)
      ]);
      
      setSummary(summaryData);
      setDetailedReport(detailedData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar el reporte';
      setError(message);
      console.error('[Reports] Error loading report:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Generate year options (current year and 2 years back)
  const years = [currentDate.getFullYear(), currentDate.getFullYear() - 1, currentDate.getFullYear() - 2];

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="card">
        <h2>Reportes Financieros</h2>
        <div className="text-center p-4">
          <p>Cargando reporte...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2>Reportes Financieros</h2>
        <div className="alert alert-error">
          <p>{error}</p>
          <button className="btn btn-sm" onClick={loadReport}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2>Reportes Financieros</h2>
      </div>

      {/* Month/Year Selector */}
      <div className="report-selector mb-4">
        <div className="flex gap-2 items-center">
          <label htmlFor="month-select">Mes:</label>
          <select
            id="month-select"
            className="input"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
          
          <label htmlFor="year-select">Año:</label>
          <select
            id="year-select"
            className="input"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          
          <button className="btn btn-sm" onClick={loadReport}>
            Actualizar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="report-summary mb-4">
          <div className="report-summary__grid">
            <div className="report-card">
              <div className="report-card__label">Ingresos Mensuales</div>
              <div className="report-card__value">{formatCurrency(summary.monthlyRevenue)}</div>
            </div>
            
            <div className="report-card">
              <div className="report-card__label">Costo Total</div>
              <div className="report-card__value report-card__value--cost">
                {formatCurrency(summary.totalCost)}
              </div>
            </div>
            
            <div className="report-card">
              <div className="report-card__label">Ganancia Neta</div>
              <div className="report-card__value report-card__value--profit">
                {formatCurrency(summary.totalProfit)}
              </div>
            </div>
            
            <div className="report-card">
              <div className="report-card__label">Margen de Ganancia</div>
              <div className={`report-card__value ${summary.profitMargin >= 20 ? 'report-card__value--profit' : summary.profitMargin >= 10 ? 'report-card__value--warning' : 'report-card__value--cost'}`}>
                {formatPercent(summary.profitMargin)}
              </div>
            </div>
          </div>
          
          <div className="report-meta mt-2">
            <span className="text-muted">
              Transacciones: {summary.transactionCount}
            </span>
          </div>
        </div>
      )}

      {/* Payment Breakdown */}
      {detailedReport && (
        <div className="report-breakdown mb-4">
          <h3>Métodos de Pago</h3>
          <div className="flex gap-4">
            <div className="breakdown-item">
              <span className="breakdown-item__label">Efectivo:</span>
              <span className="breakdown-item__value">
                {formatCurrency(detailedReport.paymentBreakdown.cash)}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-item__label">Tarjeta:</span>
              <span className="breakdown-item__value">
                {formatCurrency(detailedReport.paymentBreakdown.card)}
              </span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-item__label">Transferencia:</span>
              <span className="breakdown-item__value">
                {formatCurrency(detailedReport.paymentBreakdown.transfer)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Details */}
      {detailedReport && detailedReport.dailyReports.length > 0 && (
        <div className="report-details">
          <button
            className="btn btn-sm mb-2"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Ocultar' : 'Mostrar'} Detalles Diarios
          </button>
          
          {showDetails && (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="text-right">Ingresos</th>
                  <th className="text-right">Costo</th>
                  <th className="text-right">Ganancia</th>
                  <th className="text-right">Transacciones</th>
                </tr>
              </thead>
              <tbody>
                {detailedReport.dailyReports.map((day) => (
                  <tr key={day.date}>
                    <td>{day.dateLabel}</td>
                    <td className="text-right">{formatCurrency(day.totalRevenue)}</td>
                    <td className="text-right text-muted">{formatCurrency(day.totalCost)}</td>
                    <td className="text-right text-success">{formatCurrency(day.totalProfit)}</td>
                    <td className="text-right">{day.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="report-total">
                  <td><strong>Total</strong></td>
                  <td className="text-right"><strong>{formatCurrency(detailedReport.totalRevenue)}</strong></td>
                  <td className="text-right text-muted"><strong>{formatCurrency(detailedReport.totalCost)}</strong></td>
                  <td className="text-right text-success"><strong>{formatCurrency(detailedReport.totalProfit)}</strong></td>
                  <td className="text-right"><strong>{detailedReport.transactionCount}</strong></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Empty State */}
      {detailedReport && detailedReport.dailyReports.length === 0 && (
        <div className="text-center p-4 text-muted">
          <p>No hay ventas registradas para este período.</p>
        </div>
      )}
    </div>
  );
}

export default Reports;
