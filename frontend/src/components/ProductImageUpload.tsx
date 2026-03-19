/**
 * ProductImageUpload Component
 * 
 * Handles image upload for products using FileReader API.
 * Converts images to base64 for storage in IndexedDB.
 */

import React, { useRef, useState } from 'react';

interface ProductImageUploadProps {
  /** Current image URL (base64) */
  value?: string;
  /** Callback when image is selected and processed */
  onChange: (base64Image: string | undefined) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/** Maximum image size in bytes (2MB) */
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

/** Allowed MIME types */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ProductImageUpload({ value, onChange, disabled = false }: ProductImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Formato no válido. Usa JPG, PNG o WebP.');
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      setError('La imagen es muy grande. Máximo 2MB.');
      return;
    }

    // Convert to base64
    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      onChange(base64);
      setIsLoading(false);
    };

    reader.onerror = () => {
      setError('Error al leer la imagen.');
      setIsLoading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange(undefined);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="product-image-upload">
      {value ? (
        <div className="product-image-upload__preview">
          <img src={value} alt="Producto" className="product-image-upload__image" />
          {!disabled && (
            <button
              type="button"
              className="btn btn-sm btn-danger product-image-upload__remove"
              onClick={handleRemove}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <div className="product-image-upload__placeholder">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={disabled || isLoading}
            className="product-image-upload__input"
            id="product-image"
          />
          <label htmlFor="product-image" className="product-image-upload__label">
            {isLoading ? 'Cargando...' : '+ Imagen'}
          </label>
        </div>
      )}
      
      {error && (
        <p className="product-image-upload__error">{error}</p>
      )}
    </div>
  );
}

export default ProductImageUpload;
