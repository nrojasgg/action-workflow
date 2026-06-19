import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
} from '@xyflow/react';
import type { XYPosition } from '@xyflow/react';
import type {
  WorkflowState,
  WorkflowNode,
  AppNode,
  ShapeNodeData,
  WorkflowEdge,
  ActionWorkflowNodeData,
  WorkflowEdgeData,
  WorkflowExportSchema,
} from '../types/workflow.types';
import { SCHEMA_VERSION } from '../types/workflow.types';

// ─── Nodos iniciales de ejemplo ───────────────────────────────────────────────

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: 'node-1',
    type: 'actionWorkflow',
    position: { x: 120, y: 150 },
    data: {
      code: 'C-001',
      label: 'Ciclo Inicial',
      client: 'Cliente A',
      performer: 'Realizador A',
    },
  },
  {
    id: 'node-2',
    type: 'actionWorkflow',
    position: { x: 650, y: 150 },
    data: {
      code: 'C-002',
      label: 'Sub-ciclo',
      client: 'Cliente B',
      performer: 'Realizador B',
    },
  },
];

const INITIAL_EDGES: WorkflowEdge[] = [
  {
    id: 'edge-1-2',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 's-0',
    targetHandle: 't-180',
    type: 'workflow',
    animated: true,
    style: { stroke: '#6C8EBF', strokeWidth: 2 },
    data: {
      arrowDirection: 'forward',
      strokeStyle: 'solid',
    },
  },
];

/** Contador inicial (los 2 nodos de ejemplo ya usan C-001 y C-002) */
const INITIAL_NODE_COUNT = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateId = (): string =>
  `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const centeredPosition = (override?: XYPosition): XYPosition => {
  if (override) return override;
  return {
    x: 200 + Math.random() * 400,
    y: 100 + Math.random() * 300,
  };
};

const formatCode = (n: number) => `C-${String(n).padStart(3, '0')}`;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      // ── Estado inicial ──
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      nodeCount: INITIAL_NODE_COUNT,
      showPhaseLabels: true,
      bwMode: false,
      selectedNodeId: null,
      selectedEdgeId: null,

      // ── Handlers de React Flow ──
      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },

      onConnect: (connection) => {
        const newEdge: WorkflowEdge = {
          ...connection,
          id: `edge-${Date.now()}`,
          type: 'workflow',
          animated: true,
          style: { stroke: '#6C8EBF', strokeWidth: 2 },
          data: {
            arrowDirection: 'none',
            strokeStyle: 'solid',
          },
        };
        set({ edges: rfAddEdge(newEdge, get().edges) });
      },

      // ── CRUD de nodos ──
      addNode: (position?: XYPosition) => {
        const count = (get().nodeCount ?? INITIAL_NODE_COUNT) + 1;
        const newNode: WorkflowNode = {
          id: generateId(),
          type: 'actionWorkflow',
          position: centeredPosition(position),
          data: {
            code: formatCode(count),
            label: 'Nuevo Ciclo',
            client: 'Cliente',
            performer: 'Realizador',
          },
        };
        set({ nodes: [...get().nodes, newNode], nodeCount: count });
      },

      addShape: (position: XYPosition) => {
        const newShape: any = {
          id: `shape-${Date.now()}`,
          type: 'shapeNode',
          position,
          data: {
            shapeType: 'circle',
            label: 'Nueva Figura',
          },
        };
        set({ nodes: [...get().nodes, newShape] });
      },

      updateNodeData: (id: string, data: Partial<ActionWorkflowNodeData> | Partial<ShapeNodeData>) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n
          ) as AppNode[],
        });
      },

      deleteNode: (id: string) => {
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter(
            (e) => e.source !== id && e.target !== id
          ),
          selectedNodeId:
            get().selectedNodeId === id ? null : get().selectedNodeId,
        });
      },

      setSelectedNodeId: (id: string | null) => {
        set({ selectedNodeId: id });
      },

      setSelectedEdgeId: (id: string | null) => {
        set({ selectedEdgeId: id });
      },

      updateEdgeData: (id: string, data: Partial<WorkflowEdgeData>) => {
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, ...data } as WorkflowEdgeData } : e
          ),
        });
      },

      deleteEdge: (id: string) => {
        set({
          edges: get().edges.filter((e) => e.id !== id),
          selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
        });
      },

      setShowPhaseLabels: (show: boolean) => {
        set({ showPhaseLabels: show });
      },

      setBwMode: (bw: boolean) => {
        set({ bwMode: bw });
      },

      // ── E/S ──
      exportGraph: (): WorkflowExportSchema => ({
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        nodes: get().nodes,
        edges: get().edges,
      }),

      importGraph: (schema: WorkflowExportSchema) => {
        if (schema.schemaVersion !== SCHEMA_VERSION) {
          console.warn(
            `[WorkflowStore] Versión de esquema desconocida: ${schema.schemaVersion}.`
          );
        }
        // Calcular el nodeCount máximo del archivo importado
        const maxCode = schema.nodes.reduce((max, n) => {
          const match = String(n.data.code ?? '').match(/\d+$/);
          return match ? Math.max(max, parseInt(match[0], 10)) : max;
        }, INITIAL_NODE_COUNT);

        set({
          nodes: schema.nodes,
          edges: schema.edges,
          selectedNodeId: null,
          nodeCount: maxCode,
        });
      },

      resetGraph: () => {
        set({
          nodes: INITIAL_NODES,
          edges: INITIAL_EDGES,
          selectedNodeId: null,
          selectedEdgeId: null,
          nodeCount: INITIAL_NODE_COUNT,
          showPhaseLabels: true,
          bwMode: false,
        });
      },
    }),
    {
      name: 'action-workflow-v2',
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (e) {
            console.warn('[WorkflowStore] No se pudo guardar en localStorage (cuota excedida). Los cambios solo persisten en memoria.');
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            // ignore
          }
        },
      })),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<WorkflowState>;
        // Migrar edges que no tengan sourceHandle/targetHandle
        if (persisted.edges) {
          const needsMigration = persisted.edges.some(
            (e) => !e.sourceHandle || !e.targetHandle
          );
          if (needsMigration) {
            console.info('[WorkflowStore] Migrando edges sin handles, usando estado inicial.');
            return currentState;
          }
        }
        return { ...currentState, ...persisted };
      },
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        nodeCount: state.nodeCount,
        showPhaseLabels: state.showPhaseLabels,
        bwMode: state.bwMode,
      }),
    }
  )
);
