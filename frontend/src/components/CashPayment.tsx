import React, { useState, useMemo } from 'react';

export interface CashPaymentProps {
  total: number;
  onPaymentComplete: (data: {
    amountReceived: number;
    change: number;
    isValid: boolean;
  }) => void;
}

const COLOMBIAN_BILLS = [10000, 20000, 50000, 100000];

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function CashPayment({ total, onPaymentComplete }: CashPaymentProps) {
  const [amountReceived, setAmountReceived] = useState<number>(0);

  const change = useMemo(() => {
    return Math.max(0, amountReceived - total);
  }, [amountReceived, total]);

  const isValid = amountReceived >= total;
  const isInsufficient = amountReceived > 0 && !isValid;

  const handlePresetClick = (preset: number) => {
    const newAmount = amountReceived + preset;
    setAmountReceived(newAmount);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setAmountReceived(parseInt(value) || 0);
  };

  const handleComplete = () => {
    if (isValid) {
      onPaymentComplete({
        amountReceived,
        change,
        isValid: true
      });
    }
  };

  return (
    <div className="cash-payment">
      <div className="cash-payment__summary">
        <div className="cash-payment__row">
          <span>Total a pagar:</span>
          <span className="cash-payment__total">{formatCOP(total)}</span>
        </div>
      </div>

      <div className="cash-payment__presets">
        <label className="cash-payment__label">Billetes rápidos:</label>
        <div className="cash-payment__buttons">
          {COLOMBIAN_BILLS.map(bill => (
            <button
              key={bill}
              type="button"
              className="cash-payment__preset-btn"
              onClick={() => handlePresetClick(bill)}
            >
              +{formatCOP(bill)}
            </button>
          ))}
        </div>
      </div>

      <div className="cash-payment__input-section">
        <label className="cash-payment__label">Monto recibido:</label>
        <input
          type="text"
          className="cash-payment__input"
          value={amountReceived > 0 ? formatCOP(amountReceived) : ''}
          onChange={handleAmountChange}
          placeholder="Ingrese el monto..."
          inputMode="numeric"
        />
      </div>

      <div className="cash-payment__change-section">
        <div className="cash-payment__row">
          <span>Cambio:</span>
          <span className={`cash-payment__change ${isValid ? 'cash-payment__change--valid' : ''}`}>
            {formatCOP(change)}
          </span>
        </div>
        
        {isInsufficient && (
          <div className="cash-payment__warning">
            Pago insuficiente
          </div>
        )}
      </div>

      <button
        type="button"
        className="cash-payment__complete-btn"
        disabled={!isValid}
        onClick={handleComplete}
      >
        Completar Pago
      </button>

      <style>{`
        .cash-payment {
          background: var(--color-surface);
          border-radius: var(--radius);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .cash-payment__summary {
          padding-bottom: 1rem;
          border-bottom: 2px solid var(--color-border);
        }

        .cash-payment__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1.125rem;
        }

        .cash-payment__total {
          font-weight: 700;
          font-size: 1.5rem;
          color: var(--color-text);
        }

        .cash-payment__label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-muted);
          margin-bottom: 0.5rem;
        }

        .cash-payment__buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .cash-payment__preset-btn {
          padding: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          background: var(--color-bg);
          border: 2px solid var(--color-border);
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.2s;
          color: var(--color-text);
        }

        .cash-payment__preset-btn:hover {
          border-color: var(--color-primary);
          background: rgb(99 102 241 / 0.05);
        }

        .cash-payment__preset-btn:active {
          transform: scale(0.98);
        }

        .cash-payment__input-section {
          margin-top: 0.5rem;
        }

        .cash-payment__input {
          width: 100%;
          padding: 1rem;
          font-size: 1.5rem;
          font-weight: 600;
          text-align: right;
          border: 2px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
        }

        .cash-payment__input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgb(99 102 241 / 0.1);
        }

        .cash-payment__change-section {
          padding: 1rem;
          background: var(--color-bg);
          border-radius: var(--radius);
        }

        .cash-payment__change {
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-text-muted);
        }

        .cash-payment__change--valid {
          color: var(--color-success);
        }

        .cash-payment__warning {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: rgb(239 68 68 / 0.1);
          color: var(--color-error);
          border-radius: 4px;
          text-align: center;
          font-weight: 500;
        }

        .cash-payment__complete-btn {
          width: 100%;
          padding: 1rem;
          font-size: 1.125rem;
          font-weight: 600;
          background: var(--color-success);
          color: white;
          border: none;
          border-radius: var(--radius);
          cursor: pointer;
          transition: all 0.2s;
        }

        .cash-payment__complete-btn:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
        }

        .cash-payment__complete-btn:disabled {
          background: var(--color-border);
          color: var(--color-text-muted);
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default CashPayment;
