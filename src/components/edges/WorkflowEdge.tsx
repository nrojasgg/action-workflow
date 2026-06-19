import { useState, useRef } from 'react';
import { EdgeLabelRenderer, type EdgeProps, type Edge } from '@xyflow/react';
import { useWorkflowStore } from '../../store/workflowStore';
import type { WorkflowEdgeData } from '../../types/workflow.types';
import './WorkflowEdge.css';

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  data,
  selected,
}: EdgeProps<Edge<WorkflowEdgeData>>) {
  const updateEdgeData = useWorkflowStore((s) => s.updateEdgeData);
  const bwMode = useWorkflowStore((s) => s.bwMode);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0, mx: 0, my: 0 });

  const arrowDirection = data?.arrowDirection || 'none';
  const strokeStyle = data?.strokeStyle || 'solid';
  const midOffsetX = data?.midOffsetX || 0;
  const midOffsetY = data?.midOffsetY || 0;

  // Centro geométrico base entre origen y destino
  const baseMidX = (sourceX + targetX) / 2;
  const baseMidY = (sourceY + targetY) / 2;

  // El punto de control actual, considerando el offset
  const controlX = baseMidX + midOffsetX;
  const controlY = baseMidY + midOffsetY;

  // Calculamos el path de la curva cuadrática (Q) manualmente o usando un SVG path
  // M origen Q punto_control destino
  const edgePath = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;

  // Para dibujar las flechas orientadas a la curva, calculamos las derivadas en los extremos (t=0 y t=1)
  // En t=0 (inicio): la derivada es 2*(control - source)
  const angleStart = Math.atan2(controlY - sourceY, controlX - sourceX) * (180 / Math.PI);
  // En t=1 (fin): la derivada es 2*(target - control)
  const angleEnd = Math.atan2(targetY - controlY, targetX - controlX) * (180 / Math.PI);

  // Manejo de drag del punto de control
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      mx: midOffsetX,
      my: midOffsetY,
    };
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    
    // Zoom factor correction for correct drag feeling (approximation)
    const zoomContainer = document.querySelector('.react-flow__viewport') as HTMLElement;
    let zoom = 1;
    if (zoomContainer) {
      const match = zoomContainer.style.transform.match(/scale\(([^)]+)\)/);
      if (match && match[1]) {
        zoom = parseFloat(match[1]) || 1;
      }
    }

    updateEdgeData(id, {
      midOffsetX: startPosRef.current.mx + (dx / zoom),
      midOffsetY: startPosRef.current.my + (dy / zoom),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
  };

  // Flechas SVG 
  const showStartArrow = arrowDirection === 'backward' || arrowDirection === 'both';
  const showEndArrow = arrowDirection === 'forward' || arrowDirection === 'both';

  const strokeColor = bwMode ? '#000000' : (style.stroke as string || '#6C8EBF');
  const actualStrokeWidth = (style.strokeWidth as number || 2);

  const finalStyle = {
    ...style,
    stroke: strokeColor,
    strokeWidth: selected ? actualStrokeWidth * 1.5 : actualStrokeWidth,
    strokeDasharray: strokeStyle === 'dashed' ? '8 6' : 'none',
  };

  return (
    <>
      {/* Path invisible más ancho para facilitar click/hover y selección */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />

      {/* La línea principal visible */}
      <path
        id={id}
        d={edgePath}
        style={finalStyle}
        fill="none"
        className="react-flow__edge-path"
      />

      {/* Flechas dibujadas como polígonos explícitos */}
      {showStartArrow && (
        <polygon
          points="0,0 -12,-6 -12,6"
          fill={strokeColor}
          transform={`translate(${sourceX}, ${sourceY}) rotate(${angleStart + 180})`}
        />
      )}
      {showEndArrow && (
        <polygon
          points="0,0 -12,-6 -12,6"
          fill={strokeColor}
          transform={`translate(${targetX}, ${targetY}) rotate(${angleEnd})`}
        />
      )}

      {/* Punto de control modificable (visible solo al seleccionar el edge) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${controlX}px, ${controlY}px)`,
            pointerEvents: 'all',
            zIndex: isDragging ? 100 : 10,
          }}
          className={`edge-control-point nodrag nopan ${selected ? 'visible' : ''} ${isDragging ? 'dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Arrastra para curvar la línea"
        >
          <div className="control-point-inner" style={{ borderColor: strokeColor, backgroundColor: bwMode ? '#fff' : '#0A0F1C' }} />

          {/* Etiqueta de texto de la arista */}
          {data?.label && (
            <div
              className="edge-label-text nodrag"
              style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                color: bwMode ? '#000000' : 'rgba(255, 255, 255, 0.9)',
                background: bwMode ? 'rgba(255, 255, 255, 0.85)' : 'rgba(10, 15, 28, 0.85)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 600,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {data.label}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
