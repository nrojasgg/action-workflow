/**
 * PropertiesPanel.tsx
 *
 * Panel lateral deslizante (derecha) que aparece cuando hay un nodo seleccionado.
 * Permite editar en tiempo real:
 *  - Nombre del ciclo (label)
 *  - Actor Cliente
 *  - Actor Realizador
 *
 * También muestra el ID del nodo y la descripción de las 4 fases.
 * Incluye botón para eliminar el nodo seleccionado.
 */
import { useCallback, useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkflowStore } from '../../store/workflowStore';
import type { AppNode, WorkflowEdge, ActionWorkflowNodeData, WorkflowEdgeData } from '../../types/workflow.types';
import { PHASES } from '../../types/workflow.types';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  /** Nodo actualmente seleccionado, o null si no hay selección */
  node: AppNode | null;
  /** Arista actualmente seleccionada, o null si no hay selección */
  edge?: WorkflowEdge | null;
}

export function PropertiesPanel({ node, edge }: PropertiesPanelProps) {
  const { updateNodeData, deleteNode, setSelectedNodeId, updateEdgeData, deleteEdge, setSelectedEdgeId } = useWorkflowStore(useShallow((s) => ({
    updateNodeData: s.updateNodeData,
    deleteNode: s.deleteNode,
    setSelectedNodeId: s.setSelectedNodeId,
    updateEdgeData: s.updateEdgeData,
    deleteEdge: s.deleteEdge,
    setSelectedEdgeId: s.setSelectedEdgeId,
  })));

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Actualización en tiempo real de un campo del nodo
  const handleChange = useCallback(
    (field: keyof ActionWorkflowNodeData, value: string) => {
      if (node) updateNodeData(node.id, { [field]: value });
    },
    [node, updateNodeData]
  );

  // Eliminar el nodo seleccionado
  const handleDelete = useCallback(() => {
    if (!node) return;
    if (window.confirm(`¿Eliminar el ciclo "${node.data.label}"?\nTambién se eliminarán las conexiones asociadas.`)) {
      deleteNode(node.id);
    }
  }, [node, deleteNode]);

  const handleEdgeChange = useCallback(
    (field: keyof WorkflowEdgeData, value: string | number) => {
      if (edge) updateEdgeData(edge.id, { [field]: value });
    },
    [edge, updateEdgeData]
  );

  // Cerrar panel
  const handleClose = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  const isOpen = node !== null || (edge !== undefined && edge !== null);

  return (
    <>
      {/* Overlay de fondo en móvil */}
      {isMobile && isOpen && (
        <div className="props-overlay" onClick={handleClose} />
      )}

      <aside
        className={`props-panel${isOpen ? ' props-panel--open' : ''}${isMobile ? ' props-panel--mobile' : ''}`}
        aria-label="Panel de propiedades del ciclo"
        aria-hidden={!isOpen}
      >
        {/* Drag handle visual (solo móvil) */}
        {isMobile && (
          <div className="props-drag-handle" aria-hidden="true">
            <div className="props-drag-bar" />
          </div>
        )}
      {/* ── Cabecera ─────────────────────────────────────── */}
      <div className="props-header">
        <div>
          <h2 className="props-title">Propiedades</h2>
          <p className="props-subtitle">{node ? 'Ciclo seleccionado' : 'Conexión seleccionada'}</p>
        </div>
        <button
          className="props-close"
          onClick={handleClose}
          aria-label="Cerrar panel de propiedades"
          title="Cerrar (también puedes hacer clic en el lienzo)"
        >
          ✕
        </button>
      </div>

      <div className="props-body">
        {node ? (
          node.type === 'actionWorkflow' ? (
            <>
              {/* ID del nodo (solo lectura) */}
              <div className="props-field">
                <label className="props-label">ID del Nodo</label>
                <div className="props-id" title="Identificador único del nodo">
                  {node?.id ?? '—'}
                </div>
              </div>

              <div className="props-divider" />

              {/* Código del ciclo */}
              <div className="props-field">
                <label className="props-label" htmlFor="prop-code">
                  Código del Ciclo
                </label>
                <input
                  id="prop-code"
                  className="props-input"
                  type="text"
                  value={node?.data.code ?? ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  placeholder="Ej: C-001"
                  maxLength={20}
                  disabled={!node}
                  style={{ fontFamily: "'Consolas', monospace", fontWeight: 700, letterSpacing: '0.05em' }}
                />
              </div>

              {/* Nombre del ciclo */}
              <div className="props-field">
                <label className="props-label" htmlFor="prop-label">
                  Nombre del Ciclo
                </label>
                <input
                  id="prop-label"
                  className="props-input"
                  type="text"
                  value={node?.data.label ?? ''}
                  onChange={(e) => handleChange('label', e.target.value)}
                  placeholder="Ej: Ciclo de Entrega"
                  maxLength={150}
                  disabled={!node}
                />
              </div>

              {/* Actor: Cliente */}
              <div className="props-field">
                <label className="props-label" htmlFor="prop-client">
                  <span
                    className="props-label-dot"
                    style={{ background: 'var(--color-prep)' }}
                  />
                  Cliente
                  <span style={{ color: 'rgba(255,255,255,0.20)', fontWeight: 400 }}>
                    (actor izquierdo)
                  </span>
                </label>
                <input
                  id="prop-client"
                  className="props-input"
                  type="text"
                  value={node?.data.client ?? ''}
                  onChange={(e) => handleChange('client', e.target.value)}
                  placeholder="Ej: Departamento de TI"
                  maxLength={40}
                  disabled={!node}
                />
              </div>

              {/* Actor: Realizador */}
              <div className="props-field">
                <label className="props-label" htmlFor="prop-performer">
                  <span
                    className="props-label-dot"
                    style={{ background: 'var(--color-neg)' }}
                  />
                  Realizador
                  <span style={{ color: 'rgba(255,255,255,0.20)', fontWeight: 400 }}>
                    (actor derecho)
                  </span>
                </label>
                <input
                  id="prop-performer"
                  className="props-input"
                  type="text"
                  value={node?.data.performer ?? ''}
                  onChange={(e) => handleChange('performer', e.target.value)}
                  placeholder="Ej: Equipo de Desarrollo"
                  maxLength={40}
                  disabled={!node}
                />
              </div>

              <div className="props-divider" />

              {/* Descripción de las 4 fases */}
              <div className="props-field">
                <label className="props-label">Fases del Ciclo</label>
                <div className="props-phases">
                  {PHASES.map((phase, idx) => (
                    <div key={phase.id} className="props-phase-item">
                      <div
                        className="props-phase-num"
                        style={{ background: phase.color }}
                        aria-label={`Fase ${idx + 1}`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="props-phase-name">{phase.label}</div>
                        <div className="props-phase-range">
                          {phase.startDeg}° → {phase.endDeg}°
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Propiedades de ShapeNode */}
              <div className="props-field">
                <label className="props-label">ID del Nodo</label>
                <div className="props-id" title="Identificador único del nodo">
                  {node?.id ?? '—'}
                </div>
              </div>

              <div className="props-divider" />

              <div className="props-field">
                <label className="props-label" htmlFor="prop-shape-code">
                  Código de Figura
                </label>
                <input
                  id="prop-shape-code"
                  className="props-input"
                  type="text"
                  value={(node?.data as any).code ?? ''}
                  onChange={(e) => handleChange('code' as any, e.target.value)}
                  placeholder="Ej: F-001"
                  maxLength={20}
                  disabled={!node}
                  style={{ fontFamily: "'Consolas', monospace", fontWeight: 700, letterSpacing: '0.05em' }}
                />
              </div>

              <div className="props-field">
                <label className="props-label" htmlFor="prop-shapeType">
                  Tipo de Figura
                </label>
                <select
                  id="prop-shapeType"
                  className="props-select"
                  value={(node?.data as any).shapeType ?? 'circle'}
                  onChange={(e) => handleChange('shapeType' as any, e.target.value)}
                  disabled={!node}
                >
                  <option value="circle">Círculo con cruz (+)</option>
                  <option value="rhombus">Rombo</option>
                </select>
              </div>

              <div className="props-field">
                <label className="props-label" htmlFor="prop-label">
                  Etiqueta inferior (opcional)
                </label>
                <input
                  id="prop-label"
                  className="props-input"
                  type="text"
                  value={(node?.data as any).label ?? ''}
                  onChange={(e) => handleChange('label' as any, e.target.value)}
                  placeholder="Ej: Inicio"
                  maxLength={150}
                  disabled={!node}
                />
              </div>
            </>
          )
        ) : edge ? (
          <>
            {/* Propiedades de la conexión (Edge) */}
            <div className="props-field">
              <label className="props-label">ID de la Conexión</label>
              <div className="props-id" title="Identificador único">
                {edge.id}
              </div>
            </div>

            <div className="props-divider" />

            <div className="props-field">
              <label className="props-label">Dirección de las flechas</label>
              <select
                className="props-input"
                value={(edge.data as WorkflowEdgeData)?.arrowDirection ?? 'forward'}
                onChange={(e) => handleEdgeChange('arrowDirection', e.target.value)}
              >
                <option value="forward">Hacia adelante (Destino)</option>
                <option value="backward">Hacia atrás (Origen)</option>
                <option value="both">Ambas direcciones</option>
                <option value="none">Sin flechas</option>
              </select>
            </div>

            <div className="props-field">
              <label className="props-label">Estilo de línea</label>
              <select
                className="props-input"
                value={(edge.data as WorkflowEdgeData)?.strokeStyle ?? 'solid'}
                onChange={(e) => handleEdgeChange('strokeStyle', e.target.value)}
              >
                <option value="solid">Línea continua</option>
                <option value="dashed">Línea punteada</option>
              </select>
            </div>

            <div className="props-field">
              <label className="props-label">Texto de la flecha</label>
              <input
                className="props-input"
                type="text"
                placeholder="Ej: Autoriza"
                value={(edge.data as WorkflowEdgeData)?.label ?? ''}
                onChange={(e) => handleEdgeChange('label', e.target.value)}
                maxLength={40}
              />
            </div>

            <div className="props-divider" />

            <div className="props-field">
              <label className="props-label">Ajuste manual de la curva</label>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px', marginBottom: '8px' }}>
                Arrastra el punto de control central en el lienzo para curvar la línea. No se autoajustará.
              </p>
              <button
                className="props-btn props-btn--secondary"
                onClick={() => {
                  handleEdgeChange('midOffsetX', 0);
                  handleEdgeChange('midOffsetY', 0);
                }}
              >
                Resetear Curva (Recta)
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Footer: eliminar ─────────────────────── */}
      <div className="props-footer">
        {node && (
          <button
            id="btn-delete-node"
            className="props-btn props-btn--danger"
            onClick={handleDelete}
            title="Eliminar este ciclo y sus conexiones"
          >
            <span aria-hidden="true">🗑</span>
            Eliminar Ciclo
          </button>
        )}
        {edge && (
          <button
            id="btn-delete-edge"
            className="props-btn props-btn--danger"
            onClick={() => deleteEdge(edge.id)}
            title="Eliminar esta conexión"
          >
            <span aria-hidden="true">🗑</span>
            Eliminar Conexión
          </button>
        )}
      </div>
      </aside>
    </>
  );
}
