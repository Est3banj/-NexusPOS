import React, { useState, useEffect } from 'react';
import { useProducts } from './hooks/useProducts';
import { useSales } from './hooks/useSales';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useAuth } from './hooks/useAuth';
import { AuthProvider } from './contexts/AuthContext';
import { NetworkStatus } from './components/NetworkStatus';
import { SyncIndicator } from './components/SyncIndicator';
import { CashPayment } from './components/CashPayment';
import { Login } from './components/Login';
import { InitialSetup } from './components/InitialSetup';
import { ProductImageUpload } from './components/ProductImageUpload';
import { ProductSearchWithDropdown } from './components/ProductSearch';
import { UserManagement } from './components/UserManagement';
import Reports from './pages/Reports';
import CashClosing from './pages/CashClosing';
import {
  Package,
  ShoppingCart,
  History,
  BarChart3,
  Wallet,
  Users,
  LogOut,
  Search,
  AlertTriangle
} from 'lucide-react';
import type { Product, Sale, SaleItem } from './types';

type View = 'products' | 'new-sale' | 'sales' | 'reports' | 'cash-session' | 'users';

/**
 * Main App wrapper with AuthProvider
 */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

/**
 * Main application content - requires AuthProvider
 */
function AppContent() {
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const [currentView, setCurrentView] = useState<View>('products');
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const { isOnline } = useNetworkStatus();
  const {
    products,
    loading: productsLoading,
    createProduct,
    updateProduct,
    deleteProduct
  } = useProducts();
  const {
    sales,
    loading: salesLoading,
    createSale
  } = useSales();

  useEffect(() => {
    const checkUsers = async () => {
      const { userRepository } = await import('./db/repositories/userRepository');
      const users = await userRepository.getAll();
      setNeedsSetup(users.length === 0);
    };
    checkUsers();
  }, []);

  if (needsSetup === null) {
    return null;
  }

  if (needsSetup) {
    return <InitialSetup onSetupComplete={() => setNeedsSetup(false)} />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header__left">
          <h1>NexusPOS</h1>
          <span className="header__user">
            {user?.username} · {user?.role === 'ADMIN' ? 'Administrador' : 'Empleado'}
          </span>
        </div>
        <div className="header__right">
          <NetworkStatus />
          <SyncIndicator />
          <button className="btn btn-sm btn-ghost" onClick={logout} title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <nav className="nav-tabs mb-4">
        {/* Admin: Productos | Reportes | Cierre | Usuarios */}
        {/* Empleado: Productos | Venta | Ventas */}
        {hasRole('ADMIN') && (
          <>
            <button
              className={`nav-tab ${currentView === 'products' ? 'nav-tab--active' : ''}`}
              onClick={() => setCurrentView('products')}
            >
              <Package className="nav-tab__icon" size={20} />
              <span className="nav-tab__label">Productos</span>
            </button>
            <button
              className={`nav-tab ${currentView === 'reports' ? 'nav-tab--active' : ''}`}
              onClick={() => setCurrentView('reports')}
            >
              <BarChart3 className="nav-tab__icon" size={20} />
              <span className="nav-tab__label">Reportes</span>
            </button>
            <button
              className={`nav-tab ${currentView === 'cash-session' ? 'nav-tab--active' : ''}`}
              onClick={() => setCurrentView('cash-session')}
            >
              <Wallet className="nav-tab__icon" size={20} />
              <span className="nav-tab__label">Cierre</span>
            </button>
            <button
              className={`nav-tab ${currentView === 'users' ? 'nav-tab--active' : ''}`}
              onClick={() => setCurrentView('users')}
            >
              <Users className="nav-tab__icon" size={20} />
              <span className="nav-tab__label">Usuarios</span>
            </button>
          </>
        )}

        {/* Empleado: Productos | Venta | Ventas */}
        {hasRole('EMPLOYEE') && (
          <>
            <button
              className={`nav-tab ${currentView === 'products' ? 'nav-tab--active' : ''}`}
              onClick={() => setCurrentView('products')}
            >
              <Package className="nav-tab__icon" size={20} />
              <span className="nav-tab__label">Productos</span>
            </button>
            <button
              className={`nav-tab ${currentView === 'new-sale' ? 'nav-tab--active' : ''}`}
              onClick={() => setCurrentView('new-sale')}
            >
              <ShoppingCart className="nav-tab__icon" size={20} />
              <span className="nav-tab__label">Venta</span>
            </button>
            <button
              className={`nav-tab ${currentView === 'sales' ? 'nav-tab--active' : ''}`}
              onClick={() => setCurrentView('sales')}
            >
              <History className="nav-tab__icon" size={20} />
              <span className="nav-tab__label">Ventas</span>
            </button>
          </>
        )}
      </nav>

      {/* Products - Admin only can edit/delete */}
      {currentView === 'products' && (
        <ProductsView
          products={products}
          loading={productsLoading}
          onAdd={createProduct}
          onUpdate={updateProduct}
          onDelete={deleteProduct}
          canEdit={hasRole('ADMIN')}
          canSeeProfit={hasRole('ADMIN')}
        />
      )}

      {currentView === 'new-sale' && hasRole('EMPLOYEE') && (
        <NewSaleView
          products={products}
          onSale={createSale}
        />
      )}

      {currentView === 'sales' && hasRole('EMPLOYEE') && (
        <SalesView sales={sales} loading={salesLoading} />
      )}

      {/* Admin-only views */}
      {currentView === 'reports' && hasRole('ADMIN') && (
        <Reports />
      )}

      {currentView === 'cash-session' && hasRole('ADMIN') && (
        <CashClosing />
      )}

      {currentView === 'users' && hasRole('ADMIN') && (
        <UserManagement currentUserId={user?.id} />
      )}
    </div>
  );
}

interface ProductsViewProps {
  products: Product[];
  loading: boolean;
  onAdd: (product: Omit<Product, 'id' | 'localId' | 'createdAt' | 'updatedAt' | 'synced' | 'serverUpdatedAt' | 'pendingSync' | 'deleted'>) => Promise<number>;
  onUpdate: (id: number, updates: Partial<Product>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  canEdit?: boolean;
  canSeeProfit?: boolean;
}

function ProductsView({ products, loading, onAdd, onUpdate, onDelete, canEdit = true, canSeeProfit = true }: ProductsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: 0,
    cost: 0,
    stock: 0,
    barcode: '',
    imageUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAdd({
      name: formData.name,
      category: formData.category,
      price: formData.price,
      cost: formData.cost,
      stock: formData.stock,
      barcode: formData.barcode || undefined,
      imageUrl: formData.imageUrl || undefined
    });
    setFormData({ name: '', category: '', price: 0, cost: 0, stock: 0, barcode: '', imageUrl: '' });
    setShowForm(false);
  };

  // Calculate profit margin
  const calculateProfitMargin = (price: number, cost: number): number => {
    if (price <= 0) return 0;
    return ((price - cost) / price) * 100;
  };

  if (loading) return <div>Cargando productos...</div>;

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2>Productos</h2>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : '+ Agregar'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="product-form mb-4">
          <div className="product-form__grid">
            <input
              type="text"
              className="input"
              placeholder="Nombre"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <input
              type="text"
              className="input"
              placeholder="Categoría"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              required
            />
            <input
              type="number"
              className="input"
              placeholder="Precio"
              value={formData.price || ''}
              onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              required
              min="0"
              step="0.01"
            />
            <input
              type="number"
              className="input"
              placeholder="Costo"
              value={formData.cost || ''}
              onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
            />
            <input
              type="number"
              className="input"
              placeholder="Stock"
              value={formData.stock || ''}
              onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
              required
              min="0"
            />
            <input
              type="text"
              className="input"
              placeholder="Código de barras"
              value={formData.barcode}
              onChange={e => setFormData({ ...formData, barcode: e.target.value })}
            />
            <div className="product-image-upload-wrapper">
              <ProductImageUpload
                value={formData.imageUrl}
                onChange={(base64) => setFormData({ ...formData, imageUrl: base64 || '' })}
                disabled={!canEdit}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-success mt-2">Guardar</button>
        </form>
      )}

      {products.length === 0 ? (
        <p className="text-muted">No hay productos. Agrega uno para comenzar.</p>
      ) : (
        <div className="product-list">
          {products.map(product => (
            <div key={product.id} className="product-card">
              {product.imageUrl && (
                <div className="product-card__image">
                  <img src={product.imageUrl} alt={product.name} />
                </div>
              )}
              <div className="product-card__info">
                <div className="product-card__name">{product.name}</div>
                <div className="product-card__category">{product.category}</div>
                {product.barcode && (
                  <div className="product-card__barcode">{product.barcode}</div>
                )}
              </div>
              <div className="product-card__details">
                <div className="product-card__price">${product.price.toFixed(2)}</div>
                {canSeeProfit && product.cost > 0 && (
                  <div className="product-card__profit">
                    Ganancia: {calculateProfitMargin(product.price, product.cost).toFixed(1)}%
                  </div>
                )}
                <div className={`product-card__stock ${product.stock <= 5 ? 'product-card__stock--low' : ''}`}>
                  Stock: {product.stock}
                </div>
              </div>
              {canEdit && (
                <button
                  className="btn btn-sm product-card__delete"
                  onClick={() => product.id && onDelete(product.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface NewSaleViewProps {
  products: Product[];
  onSale: (data: { items: SaleItem[]; subtotal: number; tax: number; total: number; paymentMethod: Sale['paymentMethod'] }) => Promise<number>;
}

function NewSaleView({ products, onSale }: NewSaleViewProps) {
  const [cart, setCart] = useState<(Product & { quantity: number })[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('cash');
  const [cashSessionWarning, setCashSessionWarning] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  React.useEffect(() => {
    if (paymentMethod === 'cash') {
      checkCashSession();
    } else {
      setCashSessionWarning(null);
    }
  }, [paymentMethod]);

  const checkCashSession = async () => {
    try {
      const { cashSessionRepository } = await import('./db/repositories/cashSessionRepository');
      const hasOpen = await cashSessionRepository.hasOpenSession();
      if (!hasOpen) {
        setCashSessionWarning('No hay caja abierta. Las ventas en efectivo no se registrarán correctamente.');
      } else {
        setCashSessionWarning(null);
      }
    } catch {
      // Ignore errors during check
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(p => p.id === product.id);
    if (existing) {
      setCart(cart.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setShowSearch(false);
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(p => p.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(p => p.id === productId ? { ...p, quantity } : p));
    }
  };

  const subtotal = cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const handleSale = async () => {
    if (cart.length === 0) return;

    await onSale({
      items: cart.map(p => ({
        productId: p.id!,
        name: p.name,
        quantity: p.quantity,
        unitPrice: p.price,
        subtotal: p.price * p.quantity
      })),
      subtotal,
      tax,
      total,
      paymentMethod
    });

    setCart([]);
  };

  return (
    <div className="sale-layout">
      <div className="card sale-products">
        <div className="sale-products__header">
          <h2 className="mb-2">Productos</h2>
          <button
            type="button"
            className="btn btn-sm sale-products__search-btn"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={16} />
            <span>Buscar</span>
          </button>
        </div>

        {showSearch && (
          <div className="sale-products__search-wrapper">
            <ProductSearchWithDropdown
              products={products}
              onSelect={addToCart}
              onClose={() => setShowSearch(false)}
            />
          </div>
        )}

        {products.filter(p => p.stock > 0).length === 0 ? (
          <p className="text-muted">No hay productos disponibles</p>
        ) : (
          <div className="grid-products">
            {products.filter(p => p.stock > 0).map(product => (
              <button
                key={product.id}
                className="product-btn"
                onClick={() => addToCart(product)}
              >
                {product.imageUrl && (
                  <div className="product-btn__thumb">
                    <img src={product.imageUrl} alt="" />
                  </div>
                )}
                <span className="product-btn__name">{product.name}</span>
                <span className="product-btn__price">${product.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card sale-cart">
        <h2 className="mb-4">Carrito</h2>
        {cart.length === 0 ? (
          <p className="text-muted">El carrito está vacío</p>
        ) : (
          <>
            <div className="cart-items">
              {cart.map(item => (
                <div key={item.id} className="cart-item">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="cart-item__img" />
                  )}
                  <div className="cart-item__info">
                    <div className="cart-item__name">{item.name}</div>
                    <div className="cart-item__details">
                      ${item.price.toFixed(2)} x {item.quantity}
                    </div>
                  </div>
                  <div className="cart-item__actions">
                    <button
                      className="btn btn-sm"
                      onClick={() => updateQuantity(item.id!, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="cart-item__qty">{item.quantity}</span>
                    <button
                      className="btn btn-sm"
                      onClick={() => updateQuantity(item.id!, item.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => removeFromCart(item.id!)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-totals">
              <div className="flex justify-between mb-2">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>IVA (10%):</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="cart-total">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <div className="mb-4">
                <label className="mb-2" style={{ display: 'block' }}>Método de pago:</label>
                <select
                  className="input"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as Sale['paymentMethod'])}
                >
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
                </select>
                {cashSessionWarning && paymentMethod === 'cash' && (
                  <div className="alert alert-warning mt-2" style={{ fontSize: '0.875rem' }}>
                    {cashSessionWarning}
                  </div>
                )}
              </div>

              {paymentMethod === 'cash' ? (
                <CashPayment
                  total={total}
                  onPaymentComplete={() => handleSale()}
                />
              ) : (
                <button className="btn btn-success" style={{ width: '100%' }} onClick={handleSale}>
                  Completar Venta
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SalesViewProps {
  sales: Sale[];
  loading: boolean;
}

function SalesView({ sales, loading }: SalesViewProps) {
  if (loading) return <div>Cargando ventas...</div>;

  return (
    <div className="card">
      <h2 className="mb-4">Historial de Ventas</h2>
      {sales.length === 0 ? (
        <p className="text-muted">No hay ventas registradas</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="text-right">Total</th>
              <th>Método</th>
              <th>Items</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {sales.map(sale => (
              <tr key={sale.id}>
                <td>{new Date(sale.createdAt).toLocaleString()}</td>
                <td className="text-right">${sale.total.toFixed(2)}</td>
                <td>{sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}</td>
                <td>{sale.items.length} productos</td>
                <td>
                  <span className={`badge ${sale.synced ? 'badge-success' : 'badge-warning'}`}>
                    {sale.synced ? 'Sincronizado' : 'Pendiente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;
