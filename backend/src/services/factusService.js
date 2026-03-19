/**
 * Factus Service - Facturación Electrónica Colombia
 * 
 * Interfaces para integración con API de Factus.
 * Modelo de datos compatible con DIAN para factura electrónica.
 * 
 * Pending: Cuando se tenga la API key de Factus, configurar:
 * - FACTUS_API_URL
 * - FACTUS_API_KEY
 */

const db = require('../db');

const FACTUS_CONFIG = {
  apiUrl: process.env.FACTUS_API_URL || 'https://api.factus.com.co/v1',
  apiKey: process.env.FACTUS_API_KEY || '',
  testMode: !process.env.FACTUS_API_KEY
};

// ============================================================================
// DIAN Invoice Data Structures
// ============================================================================

/**
 * Emisor - Información del vendedor (tu empresa)
 * @typedef {Object} Emisor
 * @property {string} nit - NIT sin dígito de verificación
 * @property {string} razonSocial - Razón social o nombre
 * @property {string} nombreComercial - Nombre comercial (opcional)
 * @property {string} direccion - Dirección
 * @property {string} ciudad - Ciudad
 * @property {string} departamento - Departamento
 * @property {string} telefono - Teléfono
 * @property {string} email - Correo electrónico
 * @property {string} regimen - 'Común' o 'Simplificado'
 * @property {string} actividadEconomica - Código CIIU
 */

/**
 * Receptor - Información del cliente
 * @typedef {Object} Receptor
 * @property {string} nit - NIT o Cédula
 * @property {string} nombre - Nombre o razón social
 * @property {string} direccion - Dirección
 * @property {string} ciudad - Ciudad
 * @property {string} departamento - Departamento
 * @property {string} telefono - Teléfono (opcional)
 * @property {string} email - Correo para envío de XML/PDF
 * @property {string} regimen - 'Responsable de IVA', 'No Responsable', 'Simplificado'
 */

/**
 * Item - Línea de producto en factura
 * @typedef {Object} InvoiceItem
 * @property {string} codigo - Código SKU del producto
 * @property {string} nombre - Nombre del producto
 * @property {number} cantidad - Cantidad
 * * @property {string} unidad - Unidad de medida (UN, KG, LT, etc.)
 * @property {number} precioUnitario - Precio sin IVA
 * @property {number} descuento - Descuento en pesos (opcional)
 * @property {number} iva - Porcentaje de IVA (0, 5, 19)
 * @property {number} ivaMonto - Monto del IVA
 */

/**
 * Totales - Resumen financiero
 * @typedef {Object} InvoiceTotales
 * @property {number} subtotal - Base gravable (sin IVA)
 * @property {number} descuentoTotal - Total descuentos
 * @property {number} totalBase - Subtotal después de descuentos
 * @property {number} ivaTotal - Total IVA
 * @property {number} total - Total a pagar (bruto)
 */

// ============================================================================
// Helper: Reverse Tax Calculation
// ============================================================================

/**
 * Calcula el desglose de IVA desde precio include
 * @param {number} total - Precio total con IVA incluido
 * @param {number} ivaRate - Tasa IVA (0.19, 0.05, 0)
 * @returns {Object} { subtotal, ivaMonto }
 */
function reverseTax(total, ivaRate = 0.19) {
  const subtotal = total / (1 + ivaRate);
  const ivaMonto = total - subtotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    ivaMonto: Math.round(ivaMonto * 100) / 100
  };
}

/**
 * Calcula IVA para un item
 * @param {number} price - Precio unitario sin IVA
 * @param {number} quantity - Cantidad
 * @param {number} ivaRate - Tasa IVA
 * @returns {Object} { subtotal, iva }
 */
function calculateItemTax(price, quantity, ivaRate) {
  const subtotal = price * quantity;
  const iva = subtotal * ivaRate;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    iva: Math.round(iva * 100) / 100
  };
}

// ============================================================================
// Service Methods
// ============================================================================

const factusService = {
  /**
   * Crea una factura electrónica en Factus
   * @param {number} saleId - ID de la venta en nuestro sistema
   * @returns {Promise<Object>} Resultado con UUID,PDF, XML
   */
  async createInvoice(saleId) {
    const sale = await db.sales.getById(saleId);
    if (!sale) {
      throw new Error('Venta no encontrada');
    }

    const items = sale.items.map(item => {
      const taxInfo = calculateItemTax(item.unitPrice, item.quantity, 0.19);
      return {
        codigo: `PROD-${item.productId}`,
        nombre: item.name,
        cantidad: item.quantity,
        unidad: 'UN',
        precioUnitario: Math.round((item.subtotal / item.quantity) * 100) / 100,
        descuento: 0,
        iva: 19,
        ivaMonto: Math.round(taxInfo.iva * 100) / 100
      };
    });

    const invoiceData = {
      tipoDocumento: '01', // Factura de venta
      prefix: sale.invoicePrefix,
      numero: sale.invoiceNumber,
      fechaEmision: new Date(sale.issueDate || sale.createdAt).toISOString().split('T')[0],
      
      emisor: {
        nit: process.env.COMPANY_NIT || '123456789',
        razonSocial: process.env.COMPANY_NAME || 'Mi Empresa SAS',
        nombreComercial: process.env.COMPANY_NAME || 'Mi Empresa',
        direccion: process.env.COMPANY_ADDRESS || 'Carrera 10 # 20-30',
        ciudad: process.env.COMPANY_CITY || 'Bogotá',
        departamento: process.env.COMPANY_DEPT || 'Cundinamarca',
        telefono: process.env.COMPANY_PHONE || '3001234567',
        email: process.env.COMPANY_EMAIL || 'facturas@miempresa.com',
        regimen: process.env.COMPANY_REGIMEN || 'Común',
        actividadEconomica: process.env.COMPANY_ACTIVITY || '4690'
      },
      
      receptor: {
        nit: '900000000', // Default - implementar lookup de customers
        nombre: 'Cliente General',
        direccion: 'N/A',
        ciudad: 'N/A',
        departamento: 'N/A',
        email: 'cliente@correo.com',
        regimen: 'Responsable de IVA'
      },
      
      items,
      
      totales: {
        subtotal: Math.round(sale.subtotal * 100) / 100,
        descuentoTotal: Math.round(sale.discount * 100) / 100,
        totalBase: Math.round(sale.subtotal * 100) / 100,
        ivaTotal: Math.round(sale.taxAmount * 100) / 100,
        total: Math.round(sale.totalAmount * 100) / 100
      },
      
      metodoPago: sale.paymentMethod === 'cash' ? 'Efectivo' : 
                  sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia',
      medioPago: sale.paymentMethod === 'cash' ? '10' : 
                 sale.paymentMethod === 'card' ? '20' : '30'
    };

    if (FACTUS_CONFIG.testMode) {
      console.log('[Factus] Modo TEST - simulando creación de factura');
      console.log('[Factus] Invoice Data:', JSON.stringify(invoiceData, null, 2));
      
      // Simular respuesta de Factus
      const mockResult = {
        uuid: `test-${Date.now()}`,
        status: 'pending',
        pdfUrl: null,
        xmlUrl: null,
        dianStatus: 'pending',
        message: 'Modo prueba - API key no configurada'
      };
      
      await db.invoices.create({
        saleId,
        factusUuid: mockResult.uuid,
        dianStatus: mockResult.dianStatus,
        pdfUrl: mockResult.pdfUrl,
        xmlUrl: mockResult.xmlUrl
      });
      
      return mockResult;
    }

    try {
      const response = await fetch(`${FACTUS_CONFIG.apiUrl}/facturas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FACTUS_CONFIG.apiKey}`
        },
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en API de Factus');
      }

      const result = await response.json();

      // Guardar en nuestra DB
      await db.invoices.create({
        saleId,
        factusUuid: result.uuid,
        dianStatus: result.status,
        pdfUrl: result.pdf_url,
        xmlUrl: result.xml_url
      });

      return result;
    } catch (error) {
      console.error('[Factus] Error:', error.message);
      throw error;
    }
  },

  /**
   * Consulta el estado de una factura en DIAN
   * @param {string} uuid - UUID de la factura
   * @returns {Promise<Object>} Estado actualizado
   */
  async getInvoiceStatus(uuid) {
    if (FACTUS_CONFIG.testMode) {
      return {
        uuid,
        status: 'validated',
        dianStatus: 'Aceptado',
        message: 'Simulación - modo test'
      };
    }

    const response = await fetch(`${FACTUS_CONFIG.apiUrl}/facturas/${uuid}/estado`, {
      headers: {
        'Authorization': `Bearer ${FACTUS_CONFIG.apiKey}`
      }
    });

    return response.json();
  },

  /**
   * Descarga el PDF de la factura
   * @param {string} uuid - UUID de la factura
   * @returns {Promise<string>} URL del PDF
   */
  async downloadPDF(uuid) {
    if (FACTUS_CONFIG.testMode) {
      return null;
    }

    const response = await fetch(`${FACTUS_CONFIG.apiUrl}/facturas/${uuid}/pdf`, {
      headers: {
        'Authorization': `Bearer ${FACTUS_CONFIG.apiKey}`
      }
    });

    const result = await response.json();
    return result.pdf_url;
  },

  /**
   * Descarga el XML de la factura (para guarda legal)
   * @param {string} uuid - UUID de la factura
   * @returns {Promise<string>} URL del XML
   */
  async downloadXML(uuid) {
    if (FACTUS_CONFIG.testMode) {
      return null;
    }

    const response = await fetch(`${FACTUS_CONFIG.apiUrl}/facturas/${uuid}/xml`, {
      headers: {
        'Authorization': `Bearer ${FACTUS_CONFIG.apiKey}`
      }
    });

    const result = await response.json();
    return result.xml_url;
  },

  /**
   * Obtiene todas las facturas de una venta
   * @param {number} saleId - ID de la venta
   * @returns {Promise<Object|null>}
   */
  async getInvoiceBySaleId(saleId) {
    return db.invoices.getBySaleId(saleId);
  }
};

module.exports = {
  factusService,
  reverseTax,
  calculateItemTax,
  FACTUS_CONFIG
};