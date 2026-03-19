import React, { useState, useRef, useEffect } from 'react';
import { Search, Camera } from 'lucide-react';
import { Scanner } from './Scanner';
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="product-search">
      <div className="product-search__input-row">
        <Search size={20} className="product-search__icon" />
        <input
          ref={inputRef}
          type="text"
          className="input product-search__input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Scanner
          onScan={(code) => {
            const product = products.find(p => p.barcode === code && !p.deleted && p.stock > 0);
            if (product) {
              onSelect(product);
            } else {
              setQuery(code);
            }
          }}
          title="Escanear"
        />
      </div>

      {query.trim() && results.length === 0 && (
        <p className="product-search__no-results">No se encontraron productos</p>
      )}
    </div>
  );
}

interface ProductSearchDropdownProps {
  products: Product[];
  onSelect: (product: Product) => void;
  onClose?: () => void;
}

export function ProductSearchDropdown({ products, onSelect, onClose }: ProductSearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        <Search size={18} className="product-search-dropdown__icon" />
        <input
          ref={inputRef}
          type="text"
          className="product-search-dropdown__input"
          placeholder="Buscar o escanear..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <Scanner
          onScan={(code) => {
            const product = products.find(p => p.barcode === code && !p.deleted && p.stock > 0);
            if (product) {
              handleSelectProduct(product);
            } else {
              setQuery(code);
            }
          }}
          title="Escanear"
        />
      </div>

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
