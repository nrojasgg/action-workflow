/**
 * ControlPanel.tsx
 *
 * Panel flotante (glassmorphism) con las acciones principales del editor:
 *  - Agregar nuevo ciclo al centro del viewport
 *  - Exportar el grafo como JSON
 *  - Importar un JSON previamente exportado
 *  - Restablecer el lienzo al estado inicial
 *  - Leyenda de colores de las 4 fases
 */
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkflowStore } from '../../store/workflowStore';
import type { WorkflowExportSchema } from '../../types/workflow.types';
import { PHASES } from '../../types/workflow.types';
import './ControlPanel.css';

interface ControlPanelProps {
  /** Callback para añadir un nodo en el centro del viewport actual */
  onAddNode: () => void;
  /** Callback para añadir una nueva figura en el centro del viewport */
  onAddShape: () => void;
  /** Callback para exportar el diagrama como PNG en blanco y negro */
  onExportPng: () => void;
}

export function ControlPanel({ onAddNode, onAddShape, onExportPng }: ControlPanelProps) {
  const { exportGraph, importGraph, resetGraph, showPhaseLabels, setShowPhaseLabels, bwMode, setBwMode } = useWorkflowStore(useShallow((s) => ({
    exportGraph: s.exportGraph,
    importGraph: s.importGraph,
    resetGraph: s.resetGraph,
    showPhaseLabels: s.showPhaseLabels,
    setShowPhaseLabels: s.setShowPhaseLabels,
    bwMode: s.bwMode,
    setBwMode: s.setBwMode,
  })));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Exportar ─────────────────────────────────────────────────
  const handleExport = () => {
    const schema = exportGraph();
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `action-workflow-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  // ── Importar ─────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const schema = JSON.parse(ev.target?.result as string) as WorkflowExportSchema;
        // Validación mínima
        if (!Array.isArray(schema.nodes) || !Array.isArray(schema.edges)) {
          throw new Error('Estructura de JSON inválida');
        }
        importGraph(schema);
      } catch (err) {
        alert(
          `Error al importar el archivo.\n` +
          `Asegúrate de que sea un JSON exportado por esta aplicación.\n\n` +
          `Detalle: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    };
    reader.readAsText(file);
    // Resetear el input para permitir reimportar el mismo archivo
    e.target.value = '';
  };

  // ── Restablecer ──────────────────────────────────────────────
  const handleReset = () => {
    if (window.confirm('¿Restablecer el lienzo al estado inicial?\nSe perderán todos los cambios no exportados.')) {
      resetGraph();
    }
  };

  return (
    <div className="ctrl-panel" role="navigation" aria-label="Panel de controles">
      {/* ── Logo + Título ──────────────────────────────── */}
      <header className="ctrl-header">
        <div className="ctrl-logo" aria-hidden="true">
          {/* Miniatura del ícono: elipse con 4 arcos de colores */}
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

      {/* ── Botones de acción ──────────────────────────── */}
      <div className="ctrl-actions">
        <button
          id="btn-add-node"
          className="ctrl-btn ctrl-btn--primary"
          onClick={onAddNode}
          title="Añadir nuevo ciclo al centro del lienzo"
        >
          <span className="ctrl-btn-icon">＋</span>
          Nuevo Ciclo
        </button>

        <button
          id="btn-add-shape"
          className="ctrl-btn ctrl-btn--primary"
          onClick={onAddShape}
          title="Añadir nueva figura geométrica (Círculo/Rombo) al centro del lienzo"
          style={{ marginTop: '6px' }}
        >
          <span className="ctrl-btn-icon">○</span>
          Nueva Figura
        </button>

        <button
          id="btn-export"
          className="ctrl-btn ctrl-btn--secondary"
          onClick={handleExport}
          title="Descargar el lienzo como archivo JSON"
        >
          <span className="ctrl-btn-icon">↓</span>
          Exportar JSON
        </button>

        <button
          id="btn-export-png"
          className="ctrl-btn ctrl-btn--secondary"
          onClick={onExportPng}
          title="Descargar el diagrama completo como PNG"
        >
          <span className="ctrl-btn-icon">◻</span>
          Exportar PNG
        </button>

        <button
          id="btn-import"
          className="ctrl-btn ctrl-btn--secondary"
          onClick={() => fileInputRef.current?.click()}
          title="Cargar un archivo JSON exportado previamente"
        >
          <span className="ctrl-btn-icon">↑</span>
          Importar JSON
        </button>

        <button
          id="btn-reset"
          className="ctrl-btn ctrl-btn--danger"
          onClick={handleReset}
          title="Volver al estado inicial del lienzo"
        >
          <span className="ctrl-btn-icon">↺</span>
          Restablecer
        </button>
      </div>

      <div className="ctrl-divider" />

      {/* ── Leyenda de fases ───────────────────────────── */}
      <div className="ctrl-legend" aria-label="Leyenda de fases">
        <p className="ctrl-legend-title">Fases del Ciclo</p>
        {PHASES.map((phase) => (
          <div key={phase.id} className="ctrl-legend-item">
            <span
              className="ctrl-legend-dot"
              style={{ background: phase.color }}
              aria-hidden="true"
            />
            <span className="ctrl-legend-label">{phase.label}</span>
          </div>
        ))}
      </div>

      {/* ── Configuración de vista ──────────────────────── */}
      <div className="ctrl-divider" />
      <div className="ctrl-settings" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p className="ctrl-legend-title">Vista</p>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showPhaseLabels}
            onChange={(e) => setShowPhaseLabels(e.target.checked)}
          />
          Mostrar etiquetas de fase
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={bwMode}
            onChange={(e) => setBwMode(e.target.checked)}
          />
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
  );
}
