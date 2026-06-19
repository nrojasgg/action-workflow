/**
 * ActionWorkflowNode.tsx — Custom Node para React Flow
 *
 * Cambios vs versión anterior:
 *  - Flechas: polígonos SVG explícitos con rotación por tangente (eliminado marker-end)
 *  - El trazo del arco termina antes del extremo para dejar visible la punta de flecha
 *  - 36 handles perimetrales (cada 10°) para conectar desde cualquier punto de los arcos
 *  - Campo "código" (data.code) visible en la esquina superior izquierda del SVG
 */
import { memo, useMemo, useEffect } from "react";
import { Handle, Position, type NodeProps, useConnection, useNodeConnections, useUpdateNodeInternals } from "@xyflow/react";
import type { WorkflowNode } from "../../types/workflow.types";
import { PHASES } from "../../types/workflow.types";
import { useWorkflowStore } from "../../store/workflowStore";
import "./ActionWorkflowNode.css";

// ─── Constantes geométricas ───────────────────────────────────────────────────

const SVG_W = 220;
const SVG_H = 160;
const CX = SVG_W / 2; // 110
const CY = SVG_H / 2; // 80
const RX = 95;
const RY = 60;

/** Separación en grados entre fases adyacentes (mitad por cada lado) */
const PHASE_GAP = 5;

/**
 * Grados adicionales antes del extremo del arco dejados libres para la punta de flecha.
 * Esto evita que el trazo del arco tape el polígono de la flecha.
 */
const ARROW_SPACE = 7;

/** Factor radial para las etiquetas de fase */
const LABEL_R = 0.6;

/** Ancho de cada caja de actor */
const ACTOR_W = 100;

/** Dimensiones totales del nodo */
export const NODE_W = SVG_W; // 220
export const NODE_H = SVG_H; // 160

// ─── Helpers geométricos ──────────────────────────────────────────────────────

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Punto en el perímetro de la elipse para ángulo deg (grados, SVG coords) */
const ept = (deg: number) => ({
  x: CX + RX * Math.cos(toRad(deg)),
  y: CY + RY * Math.sin(toRad(deg)),
});

/**
 * Path SVG del arco entre startDeg y endDeg (sentido horario).
 * El arco termina ARROW_SPACE grados antes del extremo real para
 * no solapar el polígono de la flecha.
 */
function buildArcPath(startDeg: number, endDeg: number): string {
  const s = ept(startDeg + PHASE_GAP / 2);
  const e = ept(endDeg - PHASE_GAP / 2 - ARROW_SPACE);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${RX} ${RY} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/**
 * Posición y ángulo de rotación del polígono de flecha en el extremo real del arco.
 * La punta del triángulo se coloca en el extremo sin ARROW_SPACE,
 * y la rotación sigue la tangente de la elipse en ese punto.
 *
 * Tangente en ángulo θ (SVG, y-crece-abajo):
 *   dx/dθ = -RX · sin(θ)
 *   dy/dθ =  RY · cos(θ)
 */
function getArrowTransform(endDeg: number): {
  tx: number;
  ty: number;
  rot: number;
} {
  const tipDeg = endDeg - PHASE_GAP / 2;
  const tip = ept(tipDeg);
  const tanX = -RX * Math.sin(toRad(tipDeg));
  const tanY = RY * Math.cos(toRad(tipDeg));
  const rot = Math.atan2(tanY, tanX) * (180 / Math.PI);
  return { tx: tip.x, ty: tip.y, rot };
}

/** Centro de la etiqueta de fase en un cuadrante */
function phaseLabelPos(startDeg: number, endDeg: number) {
  const mid = (startDeg + endDeg) / 2;
  return {
    x: CX + RX * LABEL_R * Math.cos(toRad(mid)),
    y: CY + RY * LABEL_R * Math.sin(toRad(mid)),
  };
}

/**
 * Determina el Position de React Flow más apropiado para un ángulo dado
 * (sirve para que el enrutamiento de aristas smoothstep sea coherente).
 */
function rfPositionFor(deg: number): Position {
  const n = ((deg % 360) + 360) % 360;
  if (n >= 315 || n < 45) return Position.Right;
  if (n >= 45 && n < 135) return Position.Bottom;
  if (n >= 135 && n < 225) return Position.Left;
  return Position.Top;
}

// ─── 36 handles perimetrales (cada 10°) ──────────────────────────────────────

const NEW_HANDLE_DEGREES: number[] = [];
PHASES.forEach((phase) => {
  const start = phase.startDeg + PHASE_GAP / 2;
  const end = phase.endDeg - PHASE_GAP / 2 - ARROW_SPACE;
  const step = (end - start) / 9; // 10 puntos = 9 intervalos
  for (let i = 0; i < 10; i++) {
    const rawDeg = start + i * step;
    const deg = Number(((rawDeg % 360 + 360) % 360).toFixed(2));
    NEW_HANDLE_DEGREES.push(deg);
  }
});

// ─── Componente ───────────────────────────────────────────────────────────────

function ActionWorkflowNodeInner({ id, data, selected }: NodeProps<WorkflowNode>) {
  const showPhaseLabels = useWorkflowStore((s) => s.showPhaseLabels);
  const bwMode = useWorkflowStore((s) => s.bwMode);
  const connection = useConnection();
  const isConnecting = connection?.inProgress ?? false;
  const connections = useNodeConnections({ id });
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, isConnecting, updateNodeInternals]);

  const connectedHandles = useMemo(() => {
    const handles = new Set<string>();
    connections.forEach((conn) => {
      if (conn.source === id && conn.sourceHandle) handles.add(conn.sourceHandle);
      if (conn.target === id && conn.targetHandle) handles.add(conn.targetHandle);
    });
    return handles;
  }, [connections, id]);

  const allHandleDegrees = useMemo(() => {
    const degrees = new Set(NEW_HANDLE_DEGREES);
    connectedHandles.forEach(h => {
      const match = h.match(/^[st]-(.+)$/);
      if (match) {
        const deg = parseFloat(match[1]);
        if (!isNaN(deg)) degrees.add(deg);
      }
    });
    return Array.from(degrees);
  }, [connectedHandles]);

  const perimeterHandles = useMemo(
    () =>
      allHandleDegrees.map((deg) => {
        const p = ept(deg);
        return {
          deg,
          nodeX: p.x,
          nodeY: p.y,
          rfPos: rfPositionFor(deg),
        };
      }),
    [allHandleDegrees]
  );

  return (
    <div
      className={`awn-container${selected ? " awn-selected" : ""}${isConnecting ? " awn-connecting" : ""}`}
      style={{ width: NODE_W, height: NODE_H, position: "relative" }}
    >
      {/* ══ Actor: Cliente (izquierda) ══ */}
      <div
        className="awn-actor awn-actor--client nodrag"
        style={{
          position: "absolute",
          left: -ACTOR_W,
          top: "50%",
          transform: "translateY(-50%)",
          width: ACTOR_W,
          alignItems: "flex-end",
          textAlign: "right",
          paddingRight: "5px",
          pointerEvents: "none",
        }}
      >
        {showPhaseLabels && <span className="awn-actor-role">Cliente</span>}
        <span className="awn-actor-name" title={data.client}>
          {data.client}
        </span>
      </div>

      {/* ══ Centro: SVG + Handles ══ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SVG_W,
          height: SVG_H,
        }}
      >
        <svg
          className="awn-svg"
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          aria-label={`Ciclo ${data.code}: ${data.label}`}
          overflow="visible"
          style={{ pointerEvents: 'none' }}
        >
          {/* ── Fondo de la elipse (invisible para conservar el hitbox) ── */}
          <ellipse
            cx={CX}
            cy={CY}
            rx={RX}
            ry={RY}
            fill="transparent"
            stroke="transparent"
          />

          {/* ── Líneas divisoras (centro → 4 puntos cardinales) ── */}
          {showPhaseLabels &&
            ([0, 90, 180, 270] as const).map((deg) => {
              const p = ept(deg);
              return (
                <line
                  key={deg}
                  x1={CX}
                  y1={CY}
                  x2={p.x}
                  y2={p.y}
                  stroke={bwMode ? "#999999" : "rgba(255,255,255,0.09)"}
                  strokeWidth={0.8}
                  strokeDasharray="3 4"
                />
              );
            })}

          {/* ── 4 Arcos direccionales (trazo que termina antes de la flecha) ── */}
          {PHASES.map((phase) => (
            <path
              key={`arc-${phase.id}`}
              d={buildArcPath(phase.startDeg, phase.endDeg)}
              fill="none"
              stroke={bwMode ? "#000000" : phase.color}
              strokeWidth={bwMode ? 4 : 6}
              strokeLinecap="butt"
            />
          ))}

          {/*
           * ── Flechas (polígonos SVG explícitos) ────────────────────
           *
           * Cada flecha es un triángulo con la punta en (0,0) del sistema
           * local, base a la izquierda (puntos en x negativo).
           * Se traslada a la posición del extremo real del arco y se rota
           * según la tangente de la elipse en ese punto.
           *
           * Al ser elementos SVG independientes del trazo del arco,
           * no pueden ser tapados por dicho trazo.
           */}
          {PHASES.map((phase) => {
            const { tx, ty, rot } = getArrowTransform(phase.endDeg);
            return (
              <g
                key={`arrow-${phase.id}`}
                transform={`translate(${tx.toFixed(2)},${ty.toFixed(2)}) rotate(${rot.toFixed(2)})`}
              >
                <polygon
                  points="-10,-4.5 0,0 -10,4.5"
                  fill={bwMode ? "#000000" : phase.color}
                />
              </g>
            );
          })}

          {/* ── Etiquetas de fase ─────────────────────────────────── */}
          {showPhaseLabels &&
            PHASES.map((phase) => {
              const pos = phaseLabelPos(phase.startDeg, phase.endDeg);
              return (
                <text
                  key={`lbl-${phase.id}`}
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="8"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="600"
                  letterSpacing="0.02em"
                  fill={bwMode ? "#333333" : phase.textColor}
                  opacity={0.88}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {phase.label}
                </text>
              );
            })}

          {/* (La etiqueta central fue movida fuera del SVG) */}

          {/*
           * ── Código del ciclo (esquina superior izquierda) ────────
           *
           * Posicionado en la esquina superior-izquierda del SVG (x=8, y=14),
           * fuera del perímetro de la elipse (que empieza en x≈15, y≈20).
           * Visible gracias a overflow="visible" del elemento <svg>.
           */}
          {data.code && (
            <text
              x="18"
              y="25"
              textAnchor="start"
              dominantBaseline="central"
              fontSize="10"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="800"
              letterSpacing="-0.01em"
              fill={bwMode ? "#000000" : "rgba(255,255,255,0.85)"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {data.code}
            </text>
          )}
        </svg>

        {/* ── Etiqueta central (nombre del ciclo) movida FUERA del SVG para exportación confiable ── */}
        <div
          style={{
            position: "absolute",
            left: CX - 65,
            top: CY - 35,
            width: 130,
            height: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize:
              data.label.length > 90
                ? "8px"
                : data.label.length > 60
                  ? "9px"
                  : data.label.length > 35
                    ? "10px"
                    : "12px",
            fontWeight: 700,
            color: bwMode ? "#000000" : "rgba(255,255,255,0.93)",
            fontFamily: "Inter, system-ui, sans-serif",
            lineHeight: 1.2,
            wordWrap: "break-word",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {data.label}
        </div>
      </div>

      {/* ══ Actor: Realizador (derecha) ══ */}
      <div
        className="awn-actor awn-actor--performer nodrag"
        style={{
          position: "absolute",
          left: SVG_W,
          top: "50%",
          transform: "translateY(-50%)",
          width: ACTOR_W,
          alignItems: "flex-start",
          textAlign: "left",
          paddingLeft: "5px",
          pointerEvents: "none",
        }}
      >
        {showPhaseLabels && <span className="awn-actor-role">Realizador</span>}
        <span className="awn-actor-name" title={data.performer}>
          {data.performer}
        </span>
      </div>

      {perimeterHandles.map(({ deg, nodeX, nodeY, rfPos }) => {
        const sourceId = `s-${deg}`;
        const targetId = `t-${deg}`;

        // Compensamos los transforms por defecto de React Flow para centrar los handles en (nodeX, nodeY)
        // sin romper la alineación de sus hitboxes internos con su representación visual.
        // - Position.Right aplica transform: translate(50%, -50%) -> restamos 8px a left
        // - Position.Bottom aplica transform: translate(-50%, 50%) -> restamos 8px a top
        const handleLeft = rfPos === Position.Right ? nodeX - 8 : nodeX;
        const handleTop = rfPos === Position.Bottom ? nodeY - 8 : nodeY;

        return [
          <Handle
            key={`s-${deg}`}
            id={sourceId}
            type="source"
            position={rfPos}
            style={{ left: handleLeft, top: handleTop }}
          />,
          <Handle
            key={`t-${deg}`}
            id={targetId}
            type="target"
            position={rfPos}
            style={{ left: handleLeft, top: handleTop }}
          />,
        ];
      })}
    </div>
  );
}

export const ActionWorkflowNode = memo(ActionWorkflowNodeInner);
