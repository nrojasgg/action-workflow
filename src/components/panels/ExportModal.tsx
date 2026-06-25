import { useState, useEffect, useRef } from 'react';
import './ExportModal.css';

interface ExportModalProps {
  isOpen: boolean;
  defaultName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function ExportModal({ isOpen, defaultName, onConfirm, onCancel }: ExportModalProps) {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="export-modal-overlay" onClick={onCancel}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="export-modal-title">Nombre del archivo</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="export-modal-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nombre-archivo"
            maxLength={100}
            autoFocus
          />
          <div className="export-modal-actions">
            <button type="button" className="export-modal-btn export-modal-btn--cancel" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="export-modal-btn export-modal-btn--confirm">
              Exportar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
