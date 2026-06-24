import type {
  Edge,
  Node,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  XYPosition,
} from '@xyflow/react';

// ─── Constantes de Fase ───────────────────────────────────────────────────────

export type PhaseId =
  | 'preparation'
  | 'negotiation'
  | 'execution'
  | 'acceptance';

export interface PhaseDefinition {
  id: PhaseId;
  label: string;        // etiqueta visible en el arco
  color: string;        // color de trazo del arco
  textColor: string;    // color del texto interno
  /** Ángulo de inicio del arco en grados (0° = derecha, sentido horario) */
  startDeg: number;
  /** Ángulo de fin del arco en grados */
  endDeg: number;
}

/**
 * Definición canónica de las 4 fases en sentido horario.
 * Arranca en la parte superior (270°) y gira en sentido horario.
 *
 *   Preparación  : 270° → 0°   (cuadrante superior-derecho → izquierdo)
 *   Negociación  :   0° → 90°
 *   Ejecución    :  90° → 180°
 *   Aceptación   : 180° → 270°
 */
export const PHASES: PhaseDefinition[] = [
  {
    id: 'preparation',
    label: 'Preparación',
    color: '#6C8EBF',
    textColor: '#d0e4ff',
    startDeg: 270,
    endDeg: 360,
  },
  {
    id: 'negotiation',
    label: 'Negociación',
    color: '#82B366',
    textColor: '#d4f5c4',
    startDeg: 0,
    endDeg: 90,
  },
  {
    id: 'execution',
    label: 'Ejecución',
    color: '#D6B656',
    textColor: '#fff3c4',
    startDeg: 90,
    endDeg: 180,
  },
  {
    id: 'acceptance',
    label: 'Aceptación',
    color: '#AE4132',
    textColor: '#ffd5cf',
    startDeg: 180,
    endDeg: 270,
  },
];

// ─── Datos del Nodo ───────────────────────────────────────────────────────────

export interface ActionWorkflowNodeData extends Record<string, unknown> {
  /** Código identificador del ciclo (p.ej. "C-001"), mostrado en la esquina superior izquierda */
  code: string;
  /** Nombre del ciclo / compromiso */
  label: string;
  /** Actor situado a la izquierda de la elipse */
  client: string;
  /** Actor situado a la derecha de la elipse */
  performer: string;

}

export type WorkflowNode = Node<ActionWorkflowNodeData, 'actionWorkflow'>;

export interface ShapeNodeData extends Record<string, unknown> {
  shapeType: 'circle' | 'rhombus';
  label: string;
}

export type ShapeNode = Node<ShapeNodeData, 'shapeNode'>;

export type AppNode = WorkflowNode | ShapeNode;

export interface WorkflowEdgeData extends Record<string, unknown> {
  arrowDirection: 'forward' | 'backward' | 'both' | 'none';
  strokeStyle: 'solid' | 'dashed';
  midOffsetX?: number; // Offset from default midpoint for custom curving
  midOffsetY?: number;
  label?: string; // Optional text label on the edge
}

export type WorkflowEdge = Edge<WorkflowEdgeData, 'workflow'>;

// ─── Esquema de Exportación / Importación ────────────────────────────────────

export const SCHEMA_VERSION = 1 as const;

export interface WorkflowExportSchema {
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;  // ISO 8601
  nodes: AppNode[];
  edges: WorkflowEdge[];
}

// ─── Forma del Store Zustand ──────────────────────────────────────────────────

export interface WorkflowState {
  // ── Datos del grafo ──
  nodes: AppNode[];
  edges: WorkflowEdge[];

  // ── Contador de nodos (para generar códigos únicos como C-001) ──
  nodeCount: number;

  // ── Configuraciones Globales ──
  showPhaseLabels: boolean;
  bwMode: boolean;

  // ── Selección ──
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  graphVersion: number;

  // ── Handlers de React Flow (deltas de cambio) ──
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange<WorkflowEdge>;
  onConnect: OnConnect;

  // ── Acciones CRUD ──
  addNode: (position: XYPosition) => void;
  addShape: (position: XYPosition) => void;
  updateNodeData: (id: string, data: Partial<ActionWorkflowNodeData> | Partial<ShapeNodeData>) => void;
  deleteNode: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  updateEdgeData: (id: string, data: Partial<WorkflowEdgeData>) => void;
  deleteEdge: (id: string) => void;

  // ── Acciones de Configuración ──
  setShowPhaseLabels: (show: boolean) => void;
  setBwMode: (bw: boolean) => void;

  // ── Persistencia / E/S ──
  importGraph: (schema: WorkflowExportSchema) => void;
  exportGraph: () => WorkflowExportSchema;
  resetGraph: () => void;
}
