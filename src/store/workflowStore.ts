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
    animated: false,
    style: { stroke: '#6C8EBF', strokeWidth: 2 },
    data: {
      arrowDirection: 'forward',
      strokeStyle: 'solid',
    },
  },
];

/** Contador inicial (los 2 nodos de ejemplo ya usan C-001 y C-002) */
const INITIAL_NODE_COUNT = 2;
const INITIAL_SHAPE_COUNT = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateId = (): string =>
  `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const formatCode = (n: number) => `C-${String(n).padStart(3, '0')}`;
const formatShapeCode = (n: number) => `F-${String(n).padStart(3, '0')}`;

// ─── Helper para historial ──────────────────────────────────────────────────

const MAX_HISTORY = 50;

function pushToUndoStack(get: () => WorkflowState, set: (partial: Partial<WorkflowState>) => void) {
  const { nodes, edges, undoStack } = get();
  const snapshot = { nodes: [...nodes], edges: [...edges] };
  const newStack = [...undoStack, snapshot].slice(-MAX_HISTORY);
  set({ undoStack: newStack, redoStack: [] });
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      // ── Estado inicial ──
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      nodeCount: INITIAL_NODE_COUNT,
      shapeCount: INITIAL_SHAPE_COUNT,
      showPhaseLabels: true,
      bwMode: false,
      fileName: '',
      selectedNodeId: null,
      selectedEdgeId: null,
      graphVersion: 0,
      undoStack: [],
      redoStack: [],
      copiedNode: null,

      // ── Handlers de React Flow ──
      onNodesChange: (changes) => {
        pushToUndoStack(get, set);
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes) => {
        pushToUndoStack(get, set);
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },

      onConnect: (connection) => {
        pushToUndoStack(get, set);
        const newEdge: WorkflowEdge = {
          ...connection,
          id: `edge-${Date.now()}`,
          type: 'workflow',
          animated: false,
          style: { stroke: '#6C8EBF', strokeWidth: 2 },
          data: {
            arrowDirection: 'none',
            strokeStyle: 'solid',
          },
        };
        set({ edges: rfAddEdge(newEdge, get().edges) });
      },

      // ── CRUD de nodos ──
      addNode: (position: XYPosition) => {
        pushToUndoStack(get, set);
        const count = (get().nodeCount ?? INITIAL_NODE_COUNT) + 1;
        const newNode: WorkflowNode = {
          id: generateId(),
          type: 'actionWorkflow',
          position,
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
        pushToUndoStack(get, set);
        const count = (get().shapeCount ?? INITIAL_SHAPE_COUNT) + 1;
        const newShape: any = {
          id: `shape-${Date.now()}`,
          type: 'shapeNode',
          position,
          data: {
            code: formatShapeCode(count),
            shapeType: 'circle',
            label: 'Nueva Figura',
          },
        };
        set({ nodes: [...get().nodes, newShape], shapeCount: count });
      },

      updateNodeData: (id: string, data: Partial<ActionWorkflowNodeData> | Partial<ShapeNodeData>) => {
        pushToUndoStack(get, set);
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n
          ) as AppNode[],
        });
      },

      deleteNode: (id: string) => {
        pushToUndoStack(get, set);
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
        pushToUndoStack(get, set);
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { ...e.data, ...data } as WorkflowEdgeData } : e
          ),
        });
      },

      deleteEdge: (id: string) => {
        pushToUndoStack(get, set);
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

      setFileName: (name: string) => {
        set({ fileName: name });
      },

      // ── Undo/Redo ──
      undo: () => {
        const { undoStack, nodes, edges } = get();
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        set({
          undoStack: undoStack.slice(0, -1),
          redoStack: [...get().redoStack, { nodes: [...nodes], edges: [...edges] }],
          nodes: prev.nodes,
          edges: prev.edges,
        });
      },

      redo: () => {
        const { redoStack, nodes, edges } = get();
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        set({
          redoStack: redoStack.slice(0, -1),
          undoStack: [...get().undoStack, { nodes: [...nodes], edges: [...edges] }],
          nodes: next.nodes,
          edges: next.edges,
        });
      },

      // ── Copiar/Pegar ──
      copyNode: (id: string) => {
        const node = get().nodes.find((n) => n.id === id);
        if (node) set({ copiedNode: { ...node } });
      },

      pasteNode: () => {
        const { copiedNode, nodes, shapeCount, nodeCount } = get();
        if (!copiedNode) return;

        pushToUndoStack(get, set);

        const isShape = copiedNode.type === 'shapeNode';
        const newId = isShape ? `shape-${Date.now()}` : generateId();

        let newCode: string;
        let newNodeCount = nodeCount;
        let newShapeCount = shapeCount;

        if (isShape) {
          newShapeCount = (shapeCount ?? 0) + 1;
          newCode = formatShapeCode(newShapeCount);
        } else {
          newNodeCount = (nodeCount ?? INITIAL_NODE_COUNT) + 1;
          newCode = formatCode(newNodeCount);
        }

        const newNode: AppNode = {
          ...copiedNode,
          id: newId,
          position: {
            x: copiedNode.position.x + 30,
            y: copiedNode.position.y + 30,
          },
          data: { ...copiedNode.data, code: newCode },
        } as AppNode;

        set({
          nodes: [...nodes, newNode],
          selectedNodeId: newId,
          nodeCount: newNodeCount,
          shapeCount: newShapeCount,
        });
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

        const maxShapeCode = schema.nodes.reduce((max, n) => {
          if (n.type !== 'shapeNode') return max;
          const match = String(n.data.code ?? '').match(/\d+$/);
          return match ? Math.max(max, parseInt(match[0], 10)) : max;
        }, INITIAL_SHAPE_COUNT);

        set({
          nodes: schema.nodes,
          edges: schema.edges,
          selectedNodeId: null,
          nodeCount: maxCode,
          shapeCount: maxShapeCode,
          graphVersion: get().graphVersion + 1,
        });
      },

      resetGraph: () => {
        set({
          nodes: INITIAL_NODES,
          edges: INITIAL_EDGES,
          selectedNodeId: null,
          selectedEdgeId: null,
          nodeCount: INITIAL_NODE_COUNT,
          shapeCount: INITIAL_SHAPE_COUNT,
          showPhaseLabels: true,
          bwMode: false,
          fileName: '',
          graphVersion: get().graphVersion + 1,
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
        shapeCount: state.shapeCount,
        showPhaseLabels: state.showPhaseLabels,
        bwMode: state.bwMode,
        fileName: state.fileName,
        graphVersion: state.graphVersion,
      }),
    }
  )
);
