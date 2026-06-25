import { memo, useEffect } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  useConnection,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { useWorkflowStore } from "../../store/workflowStore";
import type { ShapeNode as ShapeNodeType } from "../../types/workflow.types";
import "./ShapeNode.css";

const SHAPE_SIZE = 40; // Size of the shape container (50% smaller than previous 80px)

function ShapeNodeInner({ id, data, selected }: NodeProps<ShapeNodeType>) {
  const bwMode = useWorkflowStore((s) => s.bwMode);
  const connection = useConnection();
  const isConnecting = connection?.inProgress ?? false;
  const activeNodeId = connection?.fromNode?.id ?? null;
  const activeHandleId = connection?.fromHandle?.id ?? null;
  const isCircle = data.shapeType === "circle";
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, isConnecting, updateNodeInternals]);

  const getSourceStyle = (handleId: string) => {
    const isActive =
      isConnecting && activeNodeId === id && activeHandleId === handleId;
    return {
      pointerEvents: isConnecting ? (isActive ? "auto" : "none") : "auto",
    } as React.CSSProperties;
  };

  // Base colors
  const strokeColor = bwMode ? "#000000" : "rgba(255, 255, 255, 0.9)";
  const fillColor = bwMode ? "#ffffff" : "rgba(108, 142, 191, 0.15)";
  const selectedStroke = bwMode ? "#333333" : "#a2b9f7";

  const strokeW = selected ? 4 : 2;
  const currentStrokeColor = selected ? selectedStroke : strokeColor;

  return (
    <div className={`shape-node-container ${selected ? "shape-selected" : ""}`}>
      <div
        className="shape-svg-wrapper"
        style={{ width: SHAPE_SIZE, height: SHAPE_SIZE }}
      >
        <svg
          width={SHAPE_SIZE}
          height={SHAPE_SIZE}
          viewBox={`0 0 ${SHAPE_SIZE} ${SHAPE_SIZE}`}
          overflow="visible"
        >
          {isCircle ? (
            <>
              <circle
                cx={SHAPE_SIZE / 2}
                cy={SHAPE_SIZE / 2}
                r={SHAPE_SIZE / 2 - 4}
                fill={fillColor}
                stroke={currentStrokeColor}
                strokeWidth={strokeW}
              />
              {/* Plus sign in the center */}
              <path
                d={`M ${SHAPE_SIZE / 2 - 12} ${SHAPE_SIZE / 2} L ${SHAPE_SIZE / 2 + 12} ${SHAPE_SIZE / 2} M ${SHAPE_SIZE / 2} ${SHAPE_SIZE / 2 - 12} L ${SHAPE_SIZE / 2} ${SHAPE_SIZE / 2 + 12}`}
                stroke={currentStrokeColor}
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            </>
          ) : (
            <polygon
              points={`${SHAPE_SIZE / 2},4 ${SHAPE_SIZE - 4},${SHAPE_SIZE / 2} ${SHAPE_SIZE / 2},${SHAPE_SIZE - 4} 4,${SHAPE_SIZE / 2}`}
              fill={fillColor}
              stroke={currentStrokeColor}
              strokeWidth={strokeW}
              strokeLinejoin="round"
            />
          )}

          {/* Código de la figura */}
          {data.code && (
            <text
              x="0"
              y="1"
              textAnchor="start"
              dominantBaseline="central"
              fontSize="8"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="800"
              fill={bwMode ? "#000000" : "rgba(255,255,255,0.85)"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {data.code}
            </text>
          )}
        </svg>

        {/* Handles en los 4 puntos cardinales */}
        <Handle type="source" id="top-source" position={Position.Top} style={getSourceStyle("top-source")} />
        <Handle type="target" id="top-target" position={Position.Top} style={{ pointerEvents: isConnecting ? "auto" : "none" }} />

        <Handle type="source" id="right-source" position={Position.Right} style={getSourceStyle("right-source")} />
        <Handle type="target" id="right-target" position={Position.Right} style={{ pointerEvents: isConnecting ? "auto" : "none" }} />

        <Handle type="source" id="bottom-source" position={Position.Bottom} style={getSourceStyle("bottom-source")} />
        <Handle type="target" id="bottom-target" position={Position.Bottom} style={{ pointerEvents: isConnecting ? "auto" : "none" }} />

        <Handle type="source" id="left-source" position={Position.Left} style={getSourceStyle("left-source")} />
        <Handle type="target" id="left-target" position={Position.Left} style={{ pointerEvents: isConnecting ? "auto" : "none" }} />
      </div>

      {data.label && (
        <div
          className="shape-node-label"
          style={{ color: bwMode ? "#000" : "#fff" }}
        >
          {data.label}
        </div>
      )}
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeInner);
