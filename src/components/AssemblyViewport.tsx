import { useState, type RefObject } from "react";
import {
  Box,
  GitBranch,
  House,
  Maximize2,
  MousePointer2,
  Move,
  Grid2X2,
  ScanLine,
  Layers,
  ArrowUpRight,
  Weight,
  Crosshair,
  Gauge,
  Clock3,
} from "lucide-react";
import { store, useProject, analyze, catalog, number, type Vector3 } from "@/lib/project";
import { DroneScene } from "../scene.js";
import { Button } from "./ui/button";
import {
  PlacementReviewCard,
  type StagingPart,
} from "./PlacementReviewCard";

export function AssemblyViewport({
  model,
  staging,
  onPositionChange,
  onAcceptPlacement,
  onCancelPlacement,
  onStartStaging,
}: {
  model: RefObject<DroneScene | null>;
  staging?: StagingPart | null;
  onPositionChange?: (newPos: Vector3) => void;
  onAcceptPlacement?: () => void;
  onCancelPlacement?: () => void;
  onStartStaging?: (componentId: string, initialPosition?: Vector3) => void;
}) {
  useProject();
  const [isDragOver, setIsDragOver] = useState(false);
  const data = analyze(store.project, catalog);
  function mode(value: string) {
    store.mode = value;
    if (value === "wiring") store.explode = 0;
    store.changed(false);
  }
  function tool(value: string) {
    store.tool = value;
    if (value === "move") store.explode = 0;
    store.changed(false);
  }
  const metrics = [
    {
      label: "Total mass",
      value: `${number(data.massG, 0)}${data.incompleteMass ? " + ?" : ""}`,
      unit: "g",
      note: "Assembled components",
      id: "mass-value",
      Icon: Weight,
    },
    {
      label: "CG offset",
      value: data.incompleteMass ? "Unknown" : number(data.cgOffsetMm),
      unit: data.incompleteMass ? "" : "mm",
      note: "XY from frame origin",
      id: "cg-value",
      Icon: Crosshair,
    },
    {
      label: "Thrust / weight",
      value: data.twr === null ? "N/A" : `${number(data.twr, 2)} : 1`,
      unit: "",
      note: "Demo 3S + 1045 data",
      id: "twr-value",
      Icon: Gauge,
    },
    {
      label: "Hover estimate",
      value: data.hoverMin === null ? "N/A" : number(data.hoverMin),
      unit: data.hoverMin === null ? "" : "min",
      note: "Approximate · unverified",
      id: "time-value",
      Icon: Clock3,
    },
  ];
  return (
    <>
      <div className="viewport-heading">
        <div className="viewport-title-group">
          <h1 className="viewport-title">
            Assembly studio<span className="title-dot">.</span>
          </h1>
          <div className="collection-breadcrumb" aria-label="Collection: DRONE">
            <span className="breadcrumb-label">COLLECTION</span>
            <span className="breadcrumb-arrow" aria-hidden="true">→</span>
            <span className="breadcrumb-target" title="Collection: Drone (Robotic arm, Humanoid & other hardware systems coming soon)">
              DRONE
            </span>
          </div>
        </div>
        <div className="mode-toggle" role="group" aria-label="Workspace mode">
          <button
            className={`mode ${store.mode === "assembly" ? "active" : ""}`}
            data-mode="assembly"
            aria-pressed={store.mode === "assembly"}
            onClick={() => mode("assembly")}
          >
            <Box size={15} />
            <span>Assembly</span>
          </button>
          <button
            className={`mode ${store.mode === "wiring" ? "active" : ""}`}
            data-mode="wiring"
            aria-pressed={store.mode === "wiring"}
            onClick={() => mode("wiring")}
          >
            <GitBranch size={15} />
            <span>Wiring</span>
          </button>
        </div>
      </div>
      <div
        className={`viewport-frame ${isDragOver ? "drag-over" : ""}`}
        id="viewport-frame"
        onDragOver={(e) => {
          if (
            e.dataTransfer.types.includes("application/x-space-lot-part") ||
            e.dataTransfer.types.includes("text/plain")
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            if (!isDragOver) setIsDragOver(true);
          }
        }}
        onDragEnter={(e) => {
          if (
            e.dataTransfer.types.includes("application/x-space-lot-part") ||
            e.dataTransfer.types.includes("text/plain")
          ) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          setIsDragOver(false);
          const partId =
            e.dataTransfer.getData("application/x-space-lot-part") ||
            e.dataTransfer.getData("text/plain");
          if (!partId) return;

          const comp = catalog.find((c) => c.id === partId);
          if (!comp) return;

          e.preventDefault();
          let dropPos: Vector3 = [0, 0, 0];
          if (model.current) {
            try {
              const calculated = model.current.dropPosition(e.nativeEvent);
              if (calculated && calculated.length === 3) {
                const defaultHeight = store.getDefaultPosition(comp.id)[2] ?? 0;
                dropPos = [calculated[0], calculated[1], defaultHeight];
              }
            } catch {
              dropPos = store.getDefaultPosition(comp.id);
            }
          } else {
            dropPos = store.getDefaultPosition(comp.id);
          }

          onStartStaging?.(comp.id, dropPos);
        }}
      >
        <div
          id="three-container"
          role="img"
          aria-label="Interactive 3D drone viewport"
        />
        {isDragOver && (
          <div className="viewport-drag-target-indicator" aria-hidden="true">
            <Box size={32} className="drag-indicator-icon" />
            <span>DROP COMPONENT TO PLACE & REVIEW</span>
          </div>
        )}
        <div className="overlay top-left">
          <span className="view-chip">
            <span className="status-led" />
            <span>{store.mode === "assembly" ? "3D ASSEMBLY" : "3D WIRING"}</span>
          </span>
        </div>
        <div className="overlay top-right camera-controls">
          <Button
            variant="outline"
            size="icon"
            id="camera-home"
            title="Reset camera"
            aria-label="Reset camera"
            onClick={() => model.current?.cameraHome()}
          >
            <House />
          </Button>
          <Button
            variant="outline"
            size="icon"
            id="camera-top"
            title="Top view"
            aria-label="Top view"
            onClick={() => model.current?.cameraTop()}
          >
            <Grid2X2 />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Toggle grid"
            aria-label="Toggle grid"
            onClick={() => {
              if (model.current)
                model.current.grid.visible = !model.current.grid.visible;
            }}
          >
            <ScanLine />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Fit workspace"
            aria-label="Fit workspace"
            onClick={() => model.current?.cameraFit()}
          >
            <Maximize2 />
          </Button>
        </div>
        <div className="overlay bottom-left">
          <div className="axis-legend">
            <span className="axis-x">X</span> Forward{" "}
            <span className="axis-y">Y</span> Right{" "}
            <span className="axis-z">Z</span> Up
          </div>
          <p id="drag-hint">
            {store.tool === "move"
              ? "Drag part on XY plane · preserve Z height"
              : "Drag to orbit · Scroll to zoom · Click to select"}
          </p>
        </div>
        <div className="overlay bottom-right toolstack">
          <button
            className={`tool ${store.tool === "select" ? "active" : ""}`}
            data-tool="select"
            aria-label="Select tool"
            aria-pressed={store.tool === "select"}
            onClick={() => tool("select")}
          >
            <MousePointer2 size={17} />
            <span>Select</span>
          </button>
          <button
            className={`tool ${store.tool === "move" ? "active" : ""}`}
            data-tool="move"
            aria-label="Move tool"
            aria-pressed={store.tool === "move"}
            onClick={() => tool("move")}
          >
            <Move size={17} />
            <span>Move</span>
          </button>
        </div>
        {staging && onPositionChange && onAcceptPlacement && onCancelPlacement && (
          <div className="overlay placement-review-overlay">
            <PlacementReviewCard
              staging={staging}
              onPositionChange={onPositionChange}
              onAccept={onAcceptPlacement}
              onCancel={onCancelPlacement}
            />
          </div>
        )}
        <div id="viewport-error" role="status" />
      </div>
      <div className="viewport-status">
        <span className="status-led" />
        <span id="scene-status">
          {store.project.instances.length} parts ·{" "}
          {data.incompleteMass
            ? "CG unknown (missing mass)"
            : `CG (${data.cgMm.map((n) => number(n)).join(", ")}) mm`}
        </span>
        <span className="pipeline-status">LOCAL WORKSPACE</span>
      </div>
      <div className="under-viewport">
        <div className="explosion">
          <Layers size={16} />
          <label htmlFor="explode-slider">
            Exploded view<small>Visual only</small>
          </label>
          <input
            id="explode-slider"
            type="range"
            min="0"
            max="100"
            value={store.explode}
            onChange={(e) => {
              store.explode = Number(e.target.value);
              if (store.explode) {
                store.tool = "select";
                store.highlightedWire = "all";
              }
              store.changed(false);
            }}
          />
          <output id="explode-value">{store.explode}%</output>
        </div>
        <div className="visibility-controls">
          <label>
            <input
              id="show-labels"
              type="checkbox"
              checked={store.showLabels}
              onChange={(e) => {
                store.showLabels = e.target.checked;
                store.changed(false);
              }}
            />
            Labels
          </label>
          <label>
            <input
              id="show-clearance"
              type="checkbox"
              checked={store.showClearance}
              onChange={(e) => {
                store.showClearance = e.target.checked;
                store.changed(false);
              }}
            />
            Prop discs
          </label>
        </div>
      </div>
      <div className="metrics-strip" role="region" aria-label="Assembly metrics">
        {metrics.map(({ label, value, unit, note, id, Icon }) => (
          <div className="metric-cell" key={id} title={`${label}: ${note}`}>
            <div className="metric-header">
              <Icon size={13} />
              <span>{label}</span>
            </div>
            <div className="metric-data">
              <span className="metric-num" id={id}>
                {value}
              </span>
              {unit ? <span className="metric-unit">{unit}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <button id="manifest-btn" className="manifest-link">
        <span>
          <Layers size={16} />
          Assembly manifest
        </span>
        <span>
          Specifications & component data
          <ArrowUpRight size={16} />
        </span>
      </button>
    </>
  );
}
