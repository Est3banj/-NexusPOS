import React, { useState, useRef, useCallback } from 'react';
import { Camera, X, Scan } from 'lucide-react';

interface ScannerProps {
  onScan: (code: string) => void;
  onClose?: () => void;
  title?: string;
}

export function Scanner({ onScan, onClose, title = 'Escanear código' }: ScannerProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const scannerRef = useRef<{ stop: () => void } | null>(null);

  const playBeep = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 1200;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } catch {}
  };

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
    setScanned(false);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('nexus-barcode-scanner');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 100 }, aspectRatio: 2.8 },
        (decodedText) => {
          if (!scanned) {
            setScanned(true);
            playBeep();
            onScan(decodedText);
            setTimeout(() => {
              setShowScanner(false);
              stopScanner();
            }, 500);
          }
        },
        () => {}
      );
    } catch (err) {
      setScannerError('No se pudo acceder a la cámara');
      setShowScanner(false);
    }
  };

  const handleClose = () => {
    setShowScanner(false);
    stopScanner();
    onClose?.();
  };

  return (
    <div className="scanner-modal">
      <button
        type="button"
        className={`btn ${showScanner ? 'btn-primary' : ''}`}
        onClick={showScanner ? handleClose : startScanner}
        title={title}
      >
        <Camera size={18} />
        <span>{title}</span>
      </button>

      {showScanner && (
        <div className="scanner-overlay">
          <div className="scanner-modal__content">
            <div className="scanner-modal__header">
              <Scan size={20} />
              <span>{title}</span>
              <button
                type="button"
                className="scanner-modal__close"
                onClick={handleClose}
              >
                <X size={20} />
              </button>
            </div>

            <div className="scanner-modal__view">
              <div id="nexus-barcode-scanner" className="scanner-modal__video" />
              <div className="scanner-overlay__guide">
                <div className="scanner-overlay__corner scanner-overlay__corner--tl" />
                <div className="scanner-overlay__corner scanner-overlay__corner--tr" />
                <div className="scanner-overlay__corner scanner-overlay__corner--bl" />
                <div className="scanner-overlay__corner scanner-overlay__corner--br" />
                <div className="scanner-overlay__line" />
              </div>
            </div>

            <p className="scanner-modal__hint">
              Centrá el código de barras dentro del recuadro
            </p>

            {scannerError && (
              <p className="scanner-modal__error">{scannerError}</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        .scanner-modal {
          position: relative;
        }

        .scanner-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .scanner-modal__content {
          background: var(--color-surface);
          border-radius: 16px;
          width: 100%;
          max-width: 400px;
          overflow: hidden;
        }

        .scanner-modal__header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          background: var(--color-primary);
          color: white;
          font-weight: 600;
        }

        .scanner-modal__close {
          position: absolute;
          right: 1rem;
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0.25rem;
        }

        .scanner-modal__view {
          position: relative;
          background: #000;
          aspect-ratio: 4/3;
        }

        .scanner-modal__video {
          width: 100%;
          height: 100%;
        }

        .scanner-modal__video video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .scanner-overlay__guide {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 280px;
          height: 100px;
          pointer-events: none;
        }

        .scanner-overlay__corner {
          position: absolute;
          width: 24px;
          height: 24px;
          border-color: var(--color-primary);
          border-style: solid;
          border-width: 0;
        }

        .scanner-overlay__corner--tl {
          top: 0;
          left: 0;
          border-top-width: 3px;
          border-left-width: 3px;
          border-top-left-radius: 8px;
        }

        .scanner-overlay__corner--tr {
          top: 0;
          right: 0;
          border-top-width: 3px;
          border-right-width: 3px;
          border-top-right-radius: 8px;
        }

        .scanner-overlay__corner--bl {
          bottom: 0;
          left: 0;
          border-bottom-width: 3px;
          border-left-width: 3px;
          border-bottom-left-radius: 8px;
        }

        .scanner-overlay__corner--br {
          bottom: 0;
          right: 0;
          border-bottom-width: 3px;
          border-right-width: 3px;
          border-bottom-right-radius: 8px;
        }

        .scanner-overlay__line {
          position: absolute;
          top: 50%;
          left: 10%;
          right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
          animation: scan-line 2s ease-in-out infinite;
        }

        @keyframes scan-line {
          0%, 100% { top: 20%; opacity: 0.5; }
          50% { top: 80%; opacity: 1; }
        }

        .scanner-modal__hint {
          text-align: center;
          padding: 1rem;
          font-size: 0.875rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        .scanner-modal__error {
          text-align: center;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          color: var(--color-error);
          margin: 0;
        }
      `}</style>
    </div>
  );
}
