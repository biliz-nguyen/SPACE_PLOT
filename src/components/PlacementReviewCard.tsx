import { useState, useRef, type ChangeEvent, type PointerEvent } from "react";
import {
  Box,
  Check,
  X,
  Crosshair,
  RotateCcw,
  MapPin,
  Target,
  Minus,
  Plus,
  Info,
  GripHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { catalog, store, number, type Vector3 } from "@/lib/project";
import { Button } from "./ui/button";
import { CATEGORY_IMAGE_MAP } from "../catalog.js";

export interface StagingPart {
  componentId: string;
  position: Vector3;
  dropPosition: Vector3;
}

interface PlacementReviewCardProps {
  staging: StagingPart;
  onPositionChange: (newPos: Vector3) => void;
  onAccept: () => void;
  onCancel: () => void;
}

export function PlacementReviewCard({
  staging,
  onPositionChange,
  onAccept,
  onCancel,
}: PlacementReviewCardProps) {
  const part = catalog.find((c) => c.id === staging.componentId);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  if (!part) return null;

  const defaultAnchor = store.getDefaultPosition(part.id);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't drag if clicking buttons, inputs, labels, selects
    if (target.closest("button, input, select, label, a, [role='button']")) {
      return;
    }
    const currentTarget = e.currentTarget;
    try {
      currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: offset.x,
      initialY: offset.y,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setOffset({
      x: Math.round(dragStartRef.current.initialX + deltaX),
      y: Math.round(dragStartRef.current.initialY + deltaY),
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleAxisChange = (axisIndex: number, value: number) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(-5000, Math.min(5000, Math.round(value)));
    const next = [...staging.position] as Vector3;
    next[axisIndex] = clamped;
    onPositionChange(next);
  };

  const handleStep = (axisIndex: number, delta: number) => {
    const current = staging.position[axisIndex] ?? 0;
    handleAxisChange(axisIndex, current + delta);
  };

  const axes = [
    { label: "X · Forward", color: "var(--danger)", id: "review-pos-x" },
    { label: "Y · Right", color: "var(--success)", id: "review-pos-y" },
    { label: "Z · Up", color: "var(--technical)", id: "review-pos-z" },
  ];

  return (
    <div
      id="placement-review-card"
      className={`placement-review-card blurred-glass-card ${isDragging ? "dragging" : ""} ${isCollapsed ? "collapsed" : ""}`}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
      role="region"
      aria-label="Component placement review"
    >
      {/* Blurred border glow halo */}
      <div className="card-border-glow" aria-hidden="true" />

      {/* Drag handle header bar */}
      <div
        className="review-drag-handle-bar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        title="Drag to move · Double-click to reset"
      >
        <div className="drag-handle-dots" aria-hidden="true">
          <GripHorizontal size={13} />
          <span>DRAG TO MOVE</span>
        </div>
      </div>

      <div
        className="review-header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="review-header-left">
          <div className="review-title-row">
            <span className="review-pulse-dot" />
            <h3 className="review-title">Place Component</h3>
          </div>
        </div>
        <div className="review-header-actions">
          <button
            type="button"
            className="review-icon-btn"
            aria-label={isCollapsed ? "Expand panel" : "Collapse panel"}
            title={isCollapsed ? "Expand" : "Collapse"}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            type="button"
            className="review-close-btn"
            aria-label="Cancel placement"
            title="Cancel (Esc)"
            onClick={onCancel}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Part Hero */}
      <div className="review-part-hero">
        <div className="review-part-icon">
          {part.category && CATEGORY_IMAGE_MAP[part.category] ? (
            <img
              src={CATEGORY_IMAGE_MAP[part.category]}
              alt=""
              className="part-icon-img"
            />
          ) : (
            <Box size={18} />
          )}
        </div>
        <div className="review-part-info">
          <div className="review-part-name">{part.name}</div>
          <div className="review-badges">
            <span className="review-pill category">{part.category.toUpperCase()}</span>
            <span className="review-pill mass">
              {part.massG === null ? "Unknown mass" : `${number(part.massG, 0)} g`}
            </span>
            <span className="review-pill dims">
              {part.dimensionsMm.map((n) => number(n, 0)).join(" × ")} mm
            </span>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="review-coords-section">
          <div className="review-section-caption">
            <Crosshair size={13} className="text-emerald-400" />
            <span>COORDINATES (mm)</span>
          </div>

          <div className="review-coords-grid">
            {axes.map((axis, idx) => (
              <div className="review-axis-control" key={axis.label}>
                <div className="axis-label-row">
                  <span className="axis-bullet" style={{ background: axis.color }} />
                  <label htmlFor={axis.id} className="axis-name">
                    {axis.label}
                  </label>
                </div>
                <div className="axis-input-stepper">
                  <button
                    type="button"
                    className="step-btn"
                    aria-label={`Decrease ${axis.label}`}
                    onClick={() => handleStep(idx, -5)}
                    title="Decrease 5 mm"
                  >
                    <Minus size={11} />
                  </button>
                  <input
                    id={axis.id}
                    data-pos={idx}
                    type="number"
                    step="1"
                    min="-5000"
                    max="5000"
                    value={staging.position[idx]}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleAxisChange(idx, e.target.valueAsNumber)
                    }
                  />
                  <button
                    type="button"
                    className="step-btn"
                    aria-label={`Increase ${axis.label}`}
                    onClick={() => handleStep(idx, 5)}
                    title="Increase 5 mm"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="review-presets-row">
            <button
              type="button"
              className="preset-btn"
              title="Reset to origin [0, 0, 0]"
              onClick={() => onPositionChange([0, 0, 0])}
            >
              <RotateCcw size={11} />
              <span>[0, 0, 0] Origin</span>
            </button>
            <button
              type="button"
              className="preset-btn"
              title={`Drop point [${staging.dropPosition.join(", ")}]`}
              onClick={() => onPositionChange(staging.dropPosition)}
            >
              <MapPin size={11} />
              <span>Drop Point</span>
            </button>
            <button
              type="button"
              className="preset-btn"
              title={`Default anchor [${defaultAnchor.join(", ")}]`}
              onClick={() => onPositionChange(defaultAnchor)}
            >
              <Target size={11} />
              <span>Default Anchor</span>
            </button>
          </div>
        </div>
      )}

      <div className="review-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          id="cancel-placement-btn"
          onClick={onCancel}
        >
          <X size={14} />
          <span>Cancel</span>
        </Button>
        <Button
          type="button"
          size="sm"
          id="accept-placement-btn"
          className="cyber-accept-btn"
          onClick={onAccept}
        >
          <Check size={14} />
          <span>Accept</span>
        </Button>
      </div>
    </div>
  );
}
