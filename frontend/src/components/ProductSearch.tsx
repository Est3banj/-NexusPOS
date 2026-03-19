import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Search } from 'lucide-react';
import type { Product } from '../types';

interface ProductSearchProps {
  products: Product[];
  onSelect: (product: Product) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function ProductSearch({ products, onSelect, placeholder = 'Buscar por nombre o escanear código...', autoFocus = true }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      const filtered = products.filter(p => {
        if (p.deleted || p.stock <= 0) return false;
        return (
          p.name.toLowerCase().includes(lowerQuery) ||
          p.barcode?.toLowerCase().includes(lowerQuery) ||
          p.category.toLowerCase().includes(lowerQuery)
        );
      });
      setResults(filtered);
      setSelectedIndex(0);
    } else {
      setResults(products.filter(p => !p.deleted && p.stock > 0));
    }
  }, [query, products]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (showScanner) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [showScanner]);

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('scanner-container');
      scannerRef.current = scanner;
      
      scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777
        },
        (decodedText) => {
          setQuery(decodedText);
          setShowScanner(false);
          stopScanner();
          const found = products.find(p => p.barcode === decodedText && !p.deleted && p.stock > 0);
          if (found) {
            onSelect(found);
          }
        },
        () => {}
      ).catch((err: Error) => {
        setScannerError('No se pudo acceder a la cámara. Verifica los permisos.');
        console.error('Scanner error:', err);
      });
    } catch (err) {
      setScannerError('No se pudo acceder a la cámara. Verifica los permisos.');
      console.error('Scanner error:', err);
    }
  };

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelect(results[selectedIndex]);
      setQuery('');
    }
  };

  const handleSelectProduct = (product: Product) => {
    onSelect(product);
    setQuery('');
  };

  return (
    <div className="product-search">
      <div className="product-search__input-row">
        <input
          ref={inputRef}
          type="text"
          className="input product-search__input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={`btn btn-sm product-search__scan-btn ${showScanner ? 'product-search__scan-btn--active' : ''}`}
          onClick={() => {
            setShowScanner(!showScanner);
            setScannerError(null);
          }}
          aria-label="Escanear código de barras"
        >
          <Camera size={18} />
        </button>
      </div>

      {showScanner && (
        <div className="product-search__scanner">
          <div id="scanner-container" className="product-search__scanner-view" />
          {scannerError && (
            <p className="product-search__scanner-error">{scannerError}</p>
          )}
          <button
            type="button"
            className="btn btn-sm product-search__scanner-close"
            onClick={() => {
              setShowScanner(false);
              stopScanner();
            }}
          >
            <X size={16} />
            <span>Cerrar</span>
          </button>
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <p className="product-search__no-results">No se encontraron productos</p>
      )}
    </div>
  );
}

interface ProductSearchWithDropdownProps extends ProductSearchProps {
  onClose?: () => void;
}

export function ProductSearchWithDropdown({ products, onSelect, onClose }: ProductSearchWithDropdownProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      const filtered = products.filter(p => {
        if (p.deleted || p.stock <= 0) return false;
        return (
          p.name.toLowerCase().includes(lowerQuery) ||
          p.barcode?.toLowerCase().includes(lowerQuery) ||
          p.category.toLowerCase().includes(lowerQuery)
        );
      });
      setResults(filtered);
      setSelectedIndex(0);
    } else {
      setResults(products.filter(p => !p.deleted && p.stock > 0));
    }
  }, [query, products]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (showScanner) {
      startDropdownScanner();
    } else {
      stopScanner();
    }
  }, [showScanner]);

  const startDropdownScanner = async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('scanner-container-dropdown');
      scannerRef.current = scanner;
      
      scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 200, height: 100 },
          aspectRatio: 1.777
        },
        (decodedText) => {
          setQuery(decodedText);
          setShowScanner(false);
          stopScanner();
          const found = products.find(p => p.barcode === decodedText && !p.deleted && p.stock > 0);
          if (found) {
            onSelect(found);
          }
        },
        () => {}
      ).catch((err: Error) => {
        setScannerError('No se pudo acceder a la cámara');
        console.error('Scanner error:', err);
      });
    } catch (err) {
      setScannerError('No se pudo acceder a la cámara');
      console.error('Scanner error:', err);
    }
  };

  const handleSelectProduct = (product: Product) => {
    onSelect(product);
    setQuery('');
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelectProduct(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose?.();
    }
  };

  return (
    <div className="product-search-dropdown" ref={dropdownRef}>
      <div className="product-search-dropdown__input-row">
        <input
          ref={inputRef}
          type="text"
          className="input product-search-dropdown__input"
          placeholder="Buscar o escanear..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          type="button"
          className={`btn btn-sm ${showScanner ? 'btn-primary' : ''} product-search-dropdown__scan-btn`}
          onClick={() => {
            if (showScanner) {
              setShowScanner(false);
              stopScanner();
            } else {
              setShowScanner(true);
              setScannerError(null);
            }
          }}
          aria-label="Escanear código"
        >
          <Camera size={18} />
        </button>
      </div>

      {showScanner && (
        <div className="product-search-dropdown__scanner-wrapper">
          <div id="scanner-container-dropdown" className="product-search-dropdown__scanner" />
          {scannerError && (
            <p className="product-search-dropdown__error">{scannerError}</p>
          )}
        </div>
      )}

      <div className="product-search-dropdown__results">
        {results.slice(0, 8).map((product, index) => (
          <button
            key={product.id}
            type="button"
            className={`product-search-dropdown__item ${index === selectedIndex ? 'product-search-dropdown__item--selected' : ''}`}
            onClick={() => handleSelectProduct(product)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt=""
                className="product-search-dropdown__item-img"
              />
            )}
            <div className="product-search-dropdown__item-info">
              <span className="product-search-dropdown__item-name">{product.name}</span>
              {product.barcode && (
                <span className="product-search-dropdown__item-barcode">{product.barcode}</span>
              )}
            </div>
            <span className="product-search-dropdown__item-price">${product.price.toFixed(2)}</span>
          </button>
        ))}
        {query.trim() && results.length === 0 && (
          <div className="product-search-dropdown__empty">No encontrado</div>
        )}
        {results.length > 8 && (
          <div className="product-search-dropdown__more">
            +{results.length - 8} más resultados
          </div>
        )}
      </div>
    </div>
  );
}
