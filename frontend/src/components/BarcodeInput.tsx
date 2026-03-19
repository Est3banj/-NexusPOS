import React, { useState, useRef, useCallback } from 'react';
import { Camera, X } from 'lucide-react';

interface BarcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BarcodeInput({ value, onChange, disabled = false }: BarcodeInputProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
  }, []);

  const startScanner = async () => {
    setScannerError(null);
    setShowScanner(true);
    
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('admin-barcode-scanner');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 100 }, aspectRatio: 2.8 },
        (decodedText) => {
          onChange(decodedText);
          setShowScanner(false);
          stopScanner();
        },
        () => {}
      );
    } catch (err) {
      setScannerError('No se pudo acceder a la cámara');
      setShowScanner(false);
      console.error('Scanner error:', err);
    }
  };

  const handleClose = () => {
    setShowScanner(false);
    stopScanner();
  };

  return (
    <div className="barcode-input">
      <div className="barcode-input__row">
        <input
          type="text"
          className="input"
          placeholder="Código de barras"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          className={`btn btn-sm ${showScanner ? 'btn-primary' : ''}`}
          onClick={showScanner ? handleClose : startScanner}
          disabled={disabled}
          title="Escanear código de barras"
        >
          <Camera size={18} />
        </button>
      </div>

      {showScanner && (
        <div className="barcode-input__scanner">
          <div id="admin-barcode-scanner" className="barcode-input__scanner-view" />
          {scannerError && (
            <p className="barcode-input__error">{scannerError}</p>
          )}
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleClose}
          >
            <X size={16} />
            <span>Cerrar</span>
          </button>
        </div>
      )}
    </div>
  );
}
