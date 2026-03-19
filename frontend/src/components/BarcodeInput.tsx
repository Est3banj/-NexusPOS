import React from 'react';
import { Scanner } from './Scanner';

interface BarcodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BarcodeInput({ value, onChange, disabled = false }: BarcodeInputProps) {
  return (
    <div className="barcode-input">
      <input
        type="text"
        className="input"
        placeholder="Código de barras"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <Scanner
        onScan={(code) => onChange(code)}
        title="Escanear código"
      />
    </div>
  );
}
