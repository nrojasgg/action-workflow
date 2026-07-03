/**
 * App.tsx — Componente raíz de la aplicación
 *
 * Estructura:
 *  ReactFlowProvider
 *    └─ WorkflowCanvas
 *         ├─ ReactFlow (lienzo completo)
 *         │    ├─ Background (patrón de puntos)
 *         │    ├─ Controls (zoom / fit)
 *         │    ├─ MiniMap
 *         │    └─ Panel (top-left) → ControlPanel
 *         └─ PropertiesPanel (panel lateral derecho)
 *
 * El estado del grafo vive en Zustand (workflowStore) con
 * persistencia automática en localStorage.
 */
import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  BackgroundVariant,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';

import { useShallow } from 'zustand/react/shallow';
import { useWorkflowStore } from './store/workflowStore';
import { ActionWorkflowNode } from './components/nodes/ActionWorkflowNode';
import { ShapeNode } from './components/nodes/ShapeNode';
import { WorkflowEdge } from './components/edges/WorkflowEdge';
import { ControlPanel } from './components/panels/ControlPanel';
import { PropertiesPanel } from './components/panels/PropertiesPanel';

import './App.css';

// ─── Registro de tipos de nodo y arista personalizados ────────────────────────
const nodeTypes = {
  actionWorkflow: ActionWorkflowNode,
  shapeNode: ShapeNode,
} as const;

const edgeTypes = {
  workflow: WorkflowEdge,
} as const;

// ─── Opciones por defecto para nuevas aristas ─────────────────────────────────
const defaultEdgeOptions = {
  type: 'workflow',
  animated: false,
  style: { stroke: '#6C8EBF', strokeWidth: 2 },
};

// ─── Estilo de la línea de conexión en progreso ───────────────────────────────
const connectionLineStyle: React.CSSProperties = {
  stroke: '#6C8EBF',
  strokeWidth: 2,
  strokeDasharray: '6 4',
};

// ─── Componente interno que usa los hooks de React Flow ───────────────────────
function WorkflowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    addNode,
    addShape,
    bwMode,
    graphVersion,
    undo,
    redo,
    copyNode,
    pasteNode,
  } = useWorkflowStore(useShallow((s) => ({
    nodes: s.nodes,
    edges: s.edges,
    onNodesChange: s.onNodesChange,
    onEdgesChange: s.onEdgesChange,
    onConnect: s.onConnect,
    selectedNodeId: s.selectedNodeId,
    setSelectedNodeId: s.setSelectedNodeId,
    selectedEdgeId: s.selectedEdgeId,
    setSelectedEdgeId: s.setSelectedEdgeId,
    addNode: s.addNode,
    addShape: s.addShape,
    bwMode: s.bwMode,
    graphVersion: s.graphVersion,
    undo: s.undo,
    redo: s.redo,
    copyNode: s.copyNode,
    pasteNode: s.pasteNode,
  })));

  const { screenToFlowPosition, getNodes, getViewport, setViewport } = useReactFlow();

  // Añadir nodo centrado en el viewport visible
  const handleAddNode = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 80,
    });
    addNode(position);
  }, [screenToFlowPosition, addNode]);

  // Añadir nueva figura centrada en el viewport visible
  const handleAddShape = useCallback(() => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight / 2 + (Math.random() - 0.5) * 80,
    });
    addShape(position);
  }, [screenToFlowPosition, addShape]);

  // Exportar el diagrama completo como PNG
  const handleExportPng = useCallback(async () => {
    const wrapper = document.querySelector('.canvas-wrapper') as HTMLElement;
    if (!wrapper) return;

    try {
      const allNodes = getNodes();
      if (allNodes.length === 0) {
        alert('El lienzo está vacío. Añade al menos un ciclo o figura antes de exportar.');
        return;
      }

      // Guardamos el viewport y dimensiones originales
      const originalViewport = getViewport();
      const originalWidth = wrapper.style.width;
      const originalHeight = wrapper.style.height;
      const originalOverflow = wrapper.style.overflow;

      // Margen lateral para actores (cada actor ocupa 100px fuera del nodo)
      const ACTOR_MARGIN = 120;
      const VERT_MARGIN = 30;

      // Bounding box en coordenadas del flujo, incluyendo actores y texto
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of allNodes) {
        const w = node.measured?.width ?? node.width ?? 220;
        const h = node.measured?.height ?? node.height ?? 160;
        minX = Math.min(minX, node.position.x - ACTOR_MARGIN);
        minY = Math.min(minY, node.position.y - VERT_MARGIN);
        maxX = Math.max(maxX, node.position.x + w + ACTOR_MARGIN);
        maxY = Math.max(maxY, node.position.y + h + VERT_MARGIN);
      }

      const boxW = maxX - minX;
      const boxH = maxY - minY;
      const edgePad = 50;

      // Dimensiones del wrapper
      const wrapperW = boxW + edgePad * 2;
      const wrapperH = boxH + edgePad * 2;
      wrapper.style.width = `${wrapperW}px`;
      wrapper.style.height = `${wrapperH}px`;
      wrapper.style.overflow = 'visible';

      await new Promise((r) => requestAnimationFrame(r));

      // Calcular viewport manualmente (sin fitView) para incluir actores
      const zoom = Math.min(wrapperW / boxW, wrapperH / boxH) * 0.90;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const tx = wrapperW / 2 - centerX * zoom;
      const ty = wrapperH / 2 - centerY * zoom;
      setViewport({ x: tx, y: ty, zoom }, { duration: 0 });

      // Esperar a que React Flow aplique el viewport transform
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      wrapper.classList.add('is-exporting');

      const dataUrl = await toPng(wrapper, {
        pixelRatio: 3,
        filter: (node: any) => {
          if (!node.classList) return true;
          const classesToExclude = [
            'react-flow__controls',
            'react-flow__minimap',
            'react-flow__panel',
            'react-flow__attribution',
            'props-panel'
          ];
          return !classesToExclude.some((cls) => node.classList.contains(cls));
        },
      });

      // Restauramos todo
      wrapper.classList.remove('is-exporting');
      wrapper.style.width = originalWidth;
      wrapper.style.height = originalHeight;
      wrapper.style.overflow = originalOverflow;
      setViewport(originalViewport);

      // Descargar
      const a = document.createElement('a');
      a.href = dataUrl;
      const modeStr = bwMode ? '-bw' : '';
      a.download = `action-workflow${modeStr}-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('[ExportPNG]', err);
      wrapper.classList.remove('is-exporting');
      wrapper.style.width = '';
      wrapper.style.height = '';
      wrapper.style.overflow = '';
      alert('Error al exportar la imagen. Por favor intenta de nuevo.');
    }
  }, [getNodes, getViewport, setViewport, bwMode]);

  // Seleccionar nodo al hacer clic
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  // Seleccionar arista al hacer clic
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: any) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(edge.id);
    },
    [setSelectedEdgeId, setSelectedNodeId]
  );

  // Deseleccionar al hacer clic en el lienzo vacío
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setSelectedNodeId, setSelectedEdgeId]);

  // Limpiar selección cuando se borra algo
  const handleNodesDelete = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleEdgesDelete = useCallback(() => {
    setSelectedEdgeId(null);
  }, [setSelectedEdgeId]);

  // Elementos actualmente seleccionados (para el panel de propiedades)
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  // ── Atajos de teclado ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el foco está en un input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === 'c') {
        if (selectedNodeId) {
          e.preventDefault();
          copyNode(selectedNodeId);
        }
      } else if (ctrl && e.key === 'v') {
        e.preventDefault();
        pasteNode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copyNode, pasteNode, selectedNodeId]);

  // Limpiar markerEnd/markerStart de aristas guardadas para evitar que React Flow acorte la línea
  const cleanEdges = useMemo(() => {
    let changed = false;
    const cleaned = edges.map(e => {
      if ('markerEnd' in e || 'markerStart' in e) {
        const { markerEnd, markerStart, ...rest } = e as any;
        changed = true;
        return rest;
      }
      return e;
    });
    return changed ? cleaned : edges;
  }, [edges]);

  return (
    <div className={`canvas-wrapper ${bwMode ? 'bw-mode' : ''}`}>
      {/* ── Lienzo de React Flow ───────────────────────────────── */}
      <ReactFlow
        key={graphVersion}
        nodes={nodes}
        edges={cleanEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineStyle={connectionLineStyle}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        minZoom={0.15}
        maxZoom={3}
        snapToGrid={false}
        attributionPosition="bottom-left"
      >
        {/* Fondo de puntos */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="rgba(255, 255, 255, 0.055)"
        />

        {/* Controles de zoom y fit */}
        <Controls
          showInteractive={false}
          position="bottom-left"
        />

        {/* MiniMapa */}
        <MiniMap
          nodeColor={() => 'rgba(108, 142, 191, 0.35)'}
          nodeStrokeColor={() => 'rgba(108, 142, 191, 0.8)'}
          nodeStrokeWidth={2}
          maskColor="rgba(0, 0, 0, 0.65)"
          pannable
          zoomable
          position="bottom-right"
        />

        {/* Panel de controles (top-left) */}
        <Panel position="top-left">
          <ControlPanel onAddNode={handleAddNode} onAddShape={handleAddShape} onExportPng={handleExportPng} />
        </Panel>
      </ReactFlow>

      {/* ── Panel lateral de propiedades ──────────────────────── */}
      <PropertiesPanel node={selectedNode} edge={selectedEdge as any} />
    </div>
  );
}

// ─── Componente raíz con el Provider de React Flow ───────────────────────────
export default function App() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
