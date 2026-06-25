/**
 * ControlPanel.tsx
 *
 * Panel flotante (glassmorphism) con las acciones principales del editor.
 * En escritorio: panel lateral fijo.
 * En móvil/tablet: botón flotante que expande un menú overlay.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkflowStore } from '../../store/workflowStore';
import type { WorkflowExportSchema } from '../../types/workflow.types';
import { PHASES } from '../../types/workflow.types';
import { importFromDrive, exportToDrive, disconnectDrive, isConnected, formatError } from '../../services/googleDrive';
import { ExportModal } from './ExportModal';
import './ControlPanel.css';

interface ControlPanelProps {
  onAddNode: () => void;
  onAddShape: () => void;
  onExportPng: () => void;
}

type DriveStatus = 'idle' | 'loading' | 'success' | 'error';

export function ControlPanel({ onAddNode, onAddShape, onExportPng }: ControlPanelProps) {
  const { exportGraph, importGraph, resetGraph, showPhaseLabels, setShowPhaseLabels, bwMode, setBwMode, fileName, setFileName } = useWorkflowStore(useShallow((s) => ({
    exportGraph: s.exportGraph,
    importGraph: s.importGraph,
    resetGraph: s.resetGraph,
    showPhaseLabels: s.showPhaseLabels,
    setShowPhaseLabels: s.setShowPhaseLabels,
    bwMode: s.bwMode,
    setBwMode: s.setBwMode,
    fileName: s.fileName,
    setFileName: s.setFileName,
  })));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(() => window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [driveStatus, setDriveStatus] = useState<DriveStatus>('idle');
  const [driveMessage, setDriveMessage] = useState('');
  const [driveConnected, setDriveConnected] = useState(() => isConnected());
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalTarget, setExportModalTarget] = useState<'local' | 'drive'>('local');

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const showDriveToast = useCallback((msg: string, status: DriveStatus) => {
    setDriveMessage(msg);
    setDriveStatus(status);
    if (status !== 'loading') {
      setTimeout(() => setDriveStatus('idle'), 4000);
    }
  }, []);

  const handleDriveImport = useCallback(async () => {
    try {
      setDriveStatus('loading');
      setDriveMessage('Conectando con Google Drive...');
      handleClose();

      const result = await importFromDrive();
      if (!result) {
        setDriveStatus('idle');
        return;
      }

      importGraph(result.schema);
      setFileName(result.fileName);
      setDriveConnected(true);
      showDriveToast('Archivo importado desde Drive correctamente', 'success');
    } catch (err) {
      showDriveToast(`Error: ${formatError(err)}`, 'error');
    }
  }, [importGraph, showDriveToast, handleClose, setFileName]);


  const handleDriveDisconnect = useCallback(() => {
    disconnectDrive();
    setDriveConnected(false);
    showDriveToast('Desconectado de Google Drive', 'success');
  }, [showDriveToast]);

  const handleExport = () => {
    setExportModalTarget('local');
    setExportModalOpen(true);
  };

  const handleDriveExportClick = () => {
    setExportModalTarget('drive');
    setExportModalOpen(true);
  };

  const handleExportConfirm = useCallback(async (name: string) => {
    setExportModalOpen(false);
    setFileName(name);

    if (exportModalTarget === 'local') {
      const schema = exportGraph();
      const json = JSON.stringify(schema, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${name}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } else {
      try {
        setDriveStatus('loading');
        setDriveMessage('Subiendo a Google Drive...');
        const schema = exportGraph();
        await exportToDrive(schema, name);
        setDriveConnected(true);
        showDriveToast('Archivo guardado en Drive', 'success');
      } catch (err) {
        showDriveToast(`Error: ${formatError(err)}`, 'error');
      }
    }
  }, [exportModalTarget, exportGraph, setFileName, showDriveToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const schema = JSON.parse(ev.target?.result as string) as WorkflowExportSchema;
        if (!Array.isArray(schema.nodes) || !Array.isArray(schema.edges)) {
          throw new Error('Estructura de JSON inválida');
        }
        importGraph(schema);
        const nameWithoutExt = file.name.replace(/\.json$/i, '');
        setFileName(nameWithoutExt);
      } catch (err) {
        alert(
          `Error al importar el archivo.\n` +
          `Asegúrate de que sea un JSON exportado por esta aplicación.\n\n` +
          `Detalle: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    if (window.confirm('¿Restablecer el lienzo al estado inicial?\nSe perderán todos los cambios no exportados.')) {
      resetGraph();
    }
  };

  return (
    <>
      {/* Botón toggle flotante */}
      <button
        className={`ctrl-fab${isOpen ? ' ctrl-fab--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        <span className="ctrl-fab-icon">{isOpen ? '✕' : '☰'}</span>
      </button>

      {/* Overlay de fondo (solo móvil abierto) */}
      {isMobile && isOpen && (
        <div className="ctrl-overlay" onClick={handleClose} />
      )}

      {/* Panel: solo renderizar cuando está abierto */}
      {isOpen && (
        <div className={`ctrl-panel${isMobile ? ' ctrl-panel--mobile' : ''}`} role="navigation" aria-label="Panel de controles">
        {/* Cabecera */}
        <header className="ctrl-header">
          <div className="ctrl-logo" aria-hidden="true">
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <ellipse cx="11" cy="8" rx="10" ry="7" fill="rgba(10,15,28,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
              <path d="M 11 1 A 10 7 0 0 1 21 8" stroke="#6C8EBF" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              <path d="M 21 8 A 10 7 0 0 1 11 15" stroke="#82B366"  strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              <path d="M 11 15 A 10 7 0 0 1 1 8"  stroke="#D6B656"  strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              <path d="M 1 8 A 10 7 0 0 1 11 1"   stroke="#AE4132"  strokeWidth="2.2" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="ctrl-title">Action Workflow</h1>
            <p className="ctrl-subtitle">Editor de Flujos</p>
          </div>
        </header>

        <div className="ctrl-divider" />

        {/* Botones de acción */}
        <div className="ctrl-actions">
          <button className="ctrl-btn ctrl-btn--primary" onClick={() => { onAddNode(); handleClose(); }}>
            <span className="ctrl-btn-icon">＋</span>
            Nuevo Ciclo
          </button>

          <button className="ctrl-btn ctrl-btn--primary" onClick={() => { onAddShape(); handleClose(); }}>
            <span className="ctrl-btn-icon">○</span>
            Nueva Figura
          </button>

          <button className="ctrl-btn ctrl-btn--secondary" onClick={() => { handleExport(); handleClose(); }}>
            <span className="ctrl-btn-icon">↓</span>
            Exportar JSON
          </button>

          <button className="ctrl-btn ctrl-btn--secondary" onClick={() => { onExportPng(); handleClose(); }}>
            <span className="ctrl-btn-icon">◻</span>
            Exportar PNG
          </button>

          <button className="ctrl-btn ctrl-btn--secondary" onClick={() => { fileInputRef.current?.click(); handleClose(); }}>
            <span className="ctrl-btn-icon">↑</span>
            Importar JSON
          </button>
        </div>

        <div className="ctrl-divider" />

        {/* Google Drive */}
        <div className="ctrl-actions">
          <p className="ctrl-legend-title">Google Drive</p>

          <button
            className="ctrl-btn ctrl-btn--drive"
            onClick={handleDriveImport}
            disabled={driveStatus === 'loading'}
          >
            <span className="ctrl-btn-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </span>
            Importar desde Drive
          </button>

          <button
            className="ctrl-btn ctrl-btn--drive"
            onClick={handleDriveExportClick}
            disabled={driveStatus === 'loading'}
          >
            <span className="ctrl-btn-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </span>
            Exportar a Drive
          </button>

          {driveConnected && (
            <button className="ctrl-btn ctrl-btn--secondary ctrl-btn--small" onClick={handleDriveDisconnect}>
              Desconectar Drive
            </button>
          )}
        </div>

        <div className="ctrl-divider" />

        {/* Restablecer */}
        <div className="ctrl-actions">
          <button className="ctrl-btn ctrl-btn--danger" onClick={() => { handleReset(); handleClose(); }}>
            <span className="ctrl-btn-icon">↺</span>
            Restablecer
          </button>
        </div>

        <div className="ctrl-divider" />

        {/* Leyenda de fases */}
        <div className="ctrl-legend" aria-label="Leyenda de fases">
          <p className="ctrl-legend-title">Fases del Ciclo</p>
          {PHASES.map((phase) => (
            <div key={phase.id} className="ctrl-legend-item">
              <span className="ctrl-legend-dot" style={{ background: phase.color }} aria-hidden="true" />
              <span className="ctrl-legend-label">{phase.label}</span>
            </div>
          ))}
        </div>

        <div className="ctrl-divider" />

        {/* Configuración de vista */}
        <div className="ctrl-settings">
          <p className="ctrl-legend-title">Vista</p>

          <label className="ctrl-checkbox-label">
            <input type="checkbox" checked={showPhaseLabels} onChange={(e) => setShowPhaseLabels(e.target.checked)} />
            Mostrar etiquetas de fase
          </label>

          <label className="ctrl-checkbox-label">
            <input type="checkbox" checked={bwMode} onChange={(e) => setBwMode(e.target.checked)} />
            Modo Blanco y Negro
          </label>
        </div>

        {/* Input oculto para importar */}
        <input
          ref={fileInputRef}
          id="file-import-input"
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Seleccionar archivo JSON para importar"
        />
      </div>
      )}

      {/* Toast de Drive */}
      {driveStatus !== 'idle' && (
        <div className={`drive-toast drive-toast--${driveStatus}`}>
          {driveStatus === 'loading' && <span className="drive-toast-spinner" />}
          {driveStatus === 'success' && <span className="drive-toast-icon">✓</span>}
          {driveStatus === 'error' && <span className="drive-toast-icon">✕</span>}
          <span>{driveMessage}</span>
        </div>
      )}
      {/* Modal de exportación */}
      <ExportModal
        isOpen={exportModalOpen}
        defaultName={fileName || `action-workflow-${new Date().toISOString().slice(0, 10)}`}
        onConfirm={handleExportConfirm}
        onCancel={() => setExportModalOpen(false)}
      />
    </>
  );
}
