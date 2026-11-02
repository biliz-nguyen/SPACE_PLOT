import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import {
  Box,
  PackageOpen,
  Sparkles,
  Globe2,
  Upload,
  Download,
  FolderOpen,
  RotateCcw,
  Settings2,
  ChevronRight,
  PanelLeft,
  SlidersHorizontal,
  X,
  ShieldCheck,
  CloudOff,
  Maximize2,
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
} from "lucide-react";
import { PartsCatalog } from "@/components/PartsCatalog";
import { AssemblyViewport } from "@/components/AssemblyViewport";
import { InspectorPanel } from "@/components/InspectorPanel";
import { LogoConstellation } from "@/components/LogoConstellation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  store,
  catalog,
  useProject,
  downloadJSON,
  type StudioTab,
  type Vector3,
} from "@/lib/project";
import { type StagingPart } from "@/components/PlacementReviewCard";
import { DroneScene } from "./scene.js";
import { setupStudio } from "./assets/studio.js";
import { setupManifest } from "./manifest.js";
import { cloud } from "./assets/cloud.js";
type Studio = ReturnType<typeof setupStudio>;
export default function App() {
  useProject();
  const model = useRef<DroneScene | null>(null),
    studio = useRef<Studio | null>(null),
    file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState(""),
    [ready, setReady] = useState(false),
    [panel, setPanel] = useState<"parts" | "inspector" | null>(null),
    [resetOpen, setResetOpen] = useState(false),
    [collapseLeft, setCollapseLeft] = useState(false),
    [collapseRight, setCollapseRight] = useState(false);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return 256;
    try {
      const saved = localStorage.getItem("space_plot_panel_width") || localStorage.getItem("space_lot_panel_width");
      return saved ? Math.max(220, Math.min(500, Number(saved))) : 256;
    } catch {
      return 256;
    }
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  const [rightWidth, setRightWidth] = useState(() => {
    if (typeof window === "undefined") return 300;
    try {
      const saved = localStorage.getItem("space_plot_inspector_width") || localStorage.getItem("space_lot_inspector_width");
      return saved ? Math.max(240, Math.min(520, Number(saved))) : 300;
    } catch {
      return 300;
    }
  });
  const [isResizingRight, setIsResizingRight] = useState(false);

  const handleLeftResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
    setIsResizingLeft(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onPointerMove = (moveEv: PointerEvent) => {
      const delta = moveEv.clientX - startX;
      const nextWidth = Math.max(200, Math.min(550, Math.round(startWidth + delta)));
      setLeftWidth(nextWidth);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      try {
        target.releasePointerCapture(upEv.pointerId);
      } catch {}
      setIsResizingLeft(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.getSelection()?.removeAllRanges();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      try {
        const delta = upEv.clientX - startX;
        const finalWidth = Math.max(200, Math.min(550, Math.round(startWidth + delta)));
        localStorage.setItem("space_plot_panel_width", String(finalWidth));
      } catch {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const handleRightResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
    setIsResizingRight(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const startX = e.clientX;
    const startWidth = rightWidth;

    const onPointerMove = (moveEv: PointerEvent) => {
      // Pulling left increases inspector width; pushing right decreases it
      const delta = startX - moveEv.clientX;
      const nextWidth = Math.max(240, Math.min(520, Math.round(startWidth + delta)));
      setRightWidth(nextWidth);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      try {
        target.releasePointerCapture(upEv.pointerId);
      } catch {}
      setIsResizingRight(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.getSelection()?.removeAllRanges();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      try {
        const delta = startX - upEv.clientX;
        const finalWidth = Math.max(240, Math.min(520, Math.round(startWidth + delta)));
        localStorage.setItem("space_plot_inspector_width", String(finalWidth));
      } catch {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };
  const isAutomated = typeof window !== "undefined" && Boolean(window.navigator.webdriver);
  const [taskbarOpen, setTaskbarOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.innerWidth <= 700) return false;
    return Boolean(window.navigator.webdriver);
  });
  const taskbarRef = useRef<HTMLDivElement>(null);
  const closeTaskbar = useCallback(() => {
    setTaskbarOpen(false);
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 4000);
  }, []);

  const [stagingPart, setStagingPart] = useState<StagingPart | null>(null);

  const startStaging = useCallback((componentId: string, initialPosition?: Vector3) => {
    const comp = catalog.find((c) => c.id === componentId);
    if (!comp) return;
    if (store.project.instances.length >= 80) {
      notify("Scene đạt giới hạn 80 linh kiện.");
      return;
    }
    const defaultPos = initialPosition ?? store.getDefaultPosition(componentId);
    const staging: StagingPart = {
      componentId,
      position: defaultPos,
      dropPosition: defaultPos,
    };
    setStagingPart(staging);
    model.current?.setPreviewPart({
      componentId,
      positionMm: defaultPos,
    });
  }, [notify]);

  const handleStagingPositionChange = useCallback((newPos: Vector3) => {
    setStagingPart((prev) => {
      if (!prev) return null;
      return { ...prev, position: newPos };
    });
    model.current?.updatePreviewPosition(newPos);
  }, []);

  const handleAcceptPlacement = useCallback(() => {
    if (!stagingPart) return;
    const comp = catalog.find((c) => c.id === stagingPart.componentId);
    const added = store.add(stagingPart.componentId, stagingPart.position);
    if (added) {
      store.select(added.id);
      notify(
        `Đã thêm ${comp?.name || "linh kiện"} tại [${stagingPart.position.join(", ")}] mm.`,
      );
    } else {
      notify("Scene đạt giới hạn 80 linh kiện.");
    }
    setStagingPart(null);
    model.current?.setPreviewPart(null);
  }, [stagingPart, notify]);

  const handleCancelPlacement = useCallback(() => {
    setStagingPart(null);
    model.current?.setPreviewPart(null);
    notify("Đã hủy đặt linh kiện.");
  }, [notify]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stagingPart) {
        handleCancelPlacement();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [stagingPart, handleCancelPlacement]);
  useEffect(() => {
    const container = document.getElementById("three-container")!;
    let scene: DroneScene | null = null;
    try {
      scene = new DroneScene(
        container,
        (id: string | null) => store.select(id),
        (id: string, pos: [number, number, number]) => store.move(id, pos),
      );
    } catch {
      document.getElementById("viewport-error")!.textContent =
        "3D preview unavailable. Enable WebGL or try a supported browser. Your project and tools remain available.";
    }
    model.current = scene;
    // Keep the initial studio composition clear; labels remain an explicit view option.
    store.showLabels = false;
    const update = () =>
      scene?.setData(store.project, catalog, {
        selectedId: store.selectedId,
        mode: store.mode,
        tool: store.tool,
        explode: store.explode,
        showLabels: store.showLabels,
        showClearance: store.showClearance,
        highlightedWire: store.highlightedWire,
      });
    const unsubscribe = store.subscribe(update);
    update();
    studio.current = setupStudio({
      store,
      catalog,
      model: scene || {
        dropPosition() {
          throw Error(
            "3D unavailable. Use Add in My Hangar to insert at the default position.",
          );
        },
      },
      toast: notify,
    });
    const manifest = setupManifest({ store, catalog });
    const assetError = (event: Event) =>
      notify((event as CustomEvent<string>).detail);
    container.addEventListener("asset-error", assetError);
    setReady(true);
    return () => {
      clearTimeout(timer.current);
      unsubscribe();
      container.removeEventListener("asset-error", assetError);
      studio.current?.destroy();
      manifest.destroy();
      scene?.dispose();
      model.current = null;
      studio.current = null;
    };
  }, [notify]);
  function open(tab: StudioTab) {
    studio.current?.open(tab);
  }
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 700) {
        setTaskbarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest("#cyber-taskbar")) return;
      if (target.closest(".actions-toggle-handle")) return;
      setTaskbarOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && taskbarOpen) {
        const isInsideTaskbar = taskbarRef.current?.contains(document.activeElement);
        const isToggle = document.querySelector(".actions-toggle-handle")?.contains(document.activeElement);
        if (isInsideTaskbar || isToggle) {
          setTaskbarOpen(false);
          (document.querySelector(".actions-toggle-handle") as HTMLElement)?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [taskbarOpen]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        (event.key === "/" ||
          ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) &&
        !target.closest("input,textarea,select,[contenteditable]") &&
        !document.querySelector('dialog[open],[role="dialog"]')
      ) {
        event.preventDefault();
        setCollapseLeft(false);
        setPanel("parts");
        document.getElementById("catalog-search")?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <div className="premium-shell">
        <a className="skip-link" href="#workspace-main">
          Skip to 3D workspace
        </a>
        <header className="app-header">
          <div className="header-left">
            <a className="brand cyber-skew" href="/" aria-label="SPACE_PLOT home">
              <div className="unskew-content brand-inner">
                <div className="brand-logo-frame">
                  <LogoConstellation />
                  <img src="/logo.png" alt="" />
                </div>
                <div className="brand-text">
                  <span className="brand-name">SPACE_PLOT</span>
                  <span className="brand-sub">SYS // 3D AERO</span>
                </div>
              </div>
            </a>
            <div className="project-inline-identity cyber-skew">
              <div className="unskew-content">
                <span className="project-prefix" aria-hidden="true">PRJ //</span>
                <input
                  id="project-name"
                  aria-label="Project name"
                  maxLength={72}
                  value={store.project.projectName}
                  onChange={(e) => {
                    store.project.projectName = e.target.value;
                    store.changed();
                  }}
                />
                <span className="local-badge" title="Local browser storage">
                  <span className="status-led" />
                  <span>ONLINE</span>
                </span>
              </div>
            </div>
          </div>

          <nav aria-label="Main navigation" className="main-nav cyber-skew">
            <div className="unskew-content">
              <button
                className="active"
                aria-label="Builder"
                aria-current="page"
                onClick={() => setPanel(null)}
              >
                <Box size={15} />
                <span>Builder</span>
              </button>
              <button
                id="open-hangar"
                aria-label="My Hangar"
                disabled={!ready}
                onClick={() => open("local")}
              >
                <PackageOpen size={15} />
                <span>My Hangar</span>
              </button>
              <button
                id="open-ai"
                aria-label="AI Workshop"
                disabled={!ready}
                onClick={() => open("ai")}
              >
                <Sparkles size={15} />
                <span>AI Workshop</span>
              </button>
              <button
                id="open-community"
                aria-label="Community"
                disabled={!ready}
                onClick={() => open("community")}
              >
                <Globe2 size={15} />
                <span>Community</span>
              </button>
            </div>
          </nav>

          <div className="header-right">
            <div
              className="project-actions cyber-skew"
              role="region"
              aria-label="Project toolbar"
            >
              <div className="unskew-content actions-compact-content">
                <button
                  type="button"
                  className={`actions-toggle-handle ${taskbarOpen ? "active" : ""}`}
                  aria-label={taskbarOpen ? "Collapse taskbar" : "Expand taskbar"}
                  aria-expanded={taskbarOpen}
                  aria-haspopup="true"
                  title="Workspace Quick Actions"
                  onClick={() => setTaskbarOpen(!taskbarOpen)}
                >
                  <span className="wavy-dots" aria-hidden="true">
                    <span className="dot dot-1" />
                    <span className="dot dot-2" />
                    <span className="dot dot-3" />
                  </span>
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  id="import-btn"
                  aria-label="Import model"
                  title="Import 3D CAD model"
                  disabled={!ready}
                  onClick={() => open("import")}
                >
                  <Upload size={14} />
                  <span>Import model</span>
                </Button>
              </div>

              {/* Vertical Dropdown Taskbar */}
              <div
                ref={taskbarRef}
                id="cyber-taskbar"
                role="region"
                aria-label="Workspace tools"
                className={`cyber-taskbar-dropdown ${taskbarOpen ? "taskbar-open" : "taskbar-closed"}`}
              >
                <div className="taskbar-header">
                  <span className="taskbar-title">SYSTEM TASKBAR</span>
                  <span className="taskbar-status">READY</span>
                </div>

                <button
                  type="button"
                  id="import-project-btn"
                  className="taskbar-item"
                  title="Import assembly JSON"
                  aria-label="Import assembly JSON"
                  onClick={() => {
                    file.current?.click();
                    closeTaskbar();
                  }}
                >
                  <FolderOpen size={15} />
                  <div className="taskbar-item-text">
                    <span className="taskbar-item-title">Open Project</span>
                    <span className="taskbar-item-desc">Load assembly JSON</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="reset-btn"
                  className="taskbar-item"
                  aria-label="Reset demo assembly"
                  title="Reset demo assembly"
                  onClick={() => {
                    setResetOpen(true);
                    closeTaskbar();
                  }}
                >
                  <RotateCcw size={15} />
                  <div className="taskbar-item-text">
                    <span className="taskbar-item-title">Reset Assembly</span>
                    <span className="taskbar-item-desc">Restore demo quadcopter</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="export-btn"
                  className="taskbar-item"
                  aria-label="Export project"
                  title="Export assembly JSON"
                  onClick={() => {
                    downloadJSON("space-lot-assembly.json", store.project);
                    notify("Project JSON exported.");
                    closeTaskbar();
                  }}
                >
                  <Download size={15} />
                  <div className="taskbar-item-text">
                    <span className="taskbar-item-title">Export Project</span>
                    <span className="taskbar-item-desc">Save assembly JSON</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="zen-canvas-btn"
                  className="taskbar-item zen-canvas-item"
                  aria-label={
                    collapseLeft && collapseRight
                      ? "Restore side panels"
                      : "Fullscreen 3D (Zen Viewport)"
                  }
                  title={
                    collapseLeft && collapseRight
                      ? "Restore side panels"
                      : "Fullscreen 3D (Zen Viewport)"
                  }
                  onClick={() => {
                    const isZen = collapseLeft && collapseRight;
                    setCollapseLeft(!isZen);
                    setCollapseRight(!isZen);
                    closeTaskbar();
                  }}
                >
                  <Maximize2 size={15} />
                  <div className="taskbar-item-text">
                    <span className="taskbar-item-title">
                      {collapseLeft && collapseRight ? "Exit Zen" : "Fullscreen 3D"}
                    </span>
                    <span className="taskbar-item-desc">Toggle side panels</span>
                  </div>
                </button>

                <div className="taskbar-divider" />

                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="taskbar-item"
                      aria-label="Workspace settings"
                      title="Workspace settings"
                    >
                      <Settings2 size={15} />
                      <div className="taskbar-item-text">
                        <span className="taskbar-item-title">Workspace Settings</span>
                        <span className="taskbar-item-desc">Connection & storage</span>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <span className="eyebrow">WORKSPACE SETTINGS</span>
                    <DialogTitle>Connection & storage</DialogTitle>
                    <DialogDescription>
                      Your local workspace is always available. Cloud services are optional.
                    </DialogDescription>
                    <div className="connection-card">
                      {cloud ? <ShieldCheck /> : <CloudOff />}
                      <div>
                        <strong>
                          {cloud ? "Cloud configuration found" : "Local workspace"}
                        </strong>
                        <p>
                          {cloud
                            ? "Sign in through Community to use cloud services. The connection has not been verified."
                            : "Import, assemble and export models on this browser. Connect Supabase in the project environment to enable Community and AI."}
                        </p>
                      </div>
                    </div>
                    <p className="helper">
                      GLB files stay in this browser until you explicitly contribute. Export a
                      backup before clearing browser data. Provider credentials belong on the server.
                    </p>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <input
              ref={file}
              hidden
              type="file"
              id="import-file"
              accept=".json,application/json"
              onChange={async (e) => {
                const input = e.currentTarget,
                  f = input.files?.[0];
                if (!f) return;
                try {
                  store.import(JSON.parse(await f.text()));
                  notify("Project imported.");
                } catch (error) {
                  notify(
                    `Import failed: ${error instanceof Error ? error.message : "Invalid project"}`,
                  );
                }
                input.value = "";
              }}
            />
          </div>
        </header>
        <div className="mobile-panels">
          <Button
            variant={panel === "parts" ? "default" : "outline"}
            size="sm"
            aria-controls="parts-panel"
            aria-expanded={panel === "parts"}
            onClick={() => setPanel(panel === "parts" ? null : "parts")}
          >
            <PanelLeft />
            Parts catalog
          </Button>
          <Button
            variant={panel === "inspector" ? "default" : "outline"}
            size="sm"
            aria-controls="inspector-panel"
            aria-expanded={panel === "inspector"}
            onClick={() => setPanel(panel === "inspector" ? null : "inspector")}
          >
            <SlidersHorizontal />
            Inspector
          </Button>
        </div>
        <div
          className={`premium-workspace ${panel ? `show-${panel}` : ""} ${collapseLeft ? "collapse-left" : ""} ${collapseRight ? "collapse-right" : ""} ${isResizingLeft || isResizingRight ? "resizing" : ""}`}
          style={
            {
              gridTemplateColumns: collapseLeft
                ? (collapseRight ? "0px minmax(0, 1fr) 0px" : `0px minmax(0, 1fr) ${rightWidth}px`)
                : (collapseRight ? `${leftWidth}px minmax(0, 1fr) 0px` : `${leftWidth}px minmax(0, 1fr) ${rightWidth}px`),
              "--left-panel-width": `${leftWidth}px`,
              "--right-panel-width": `${rightWidth}px`,
            } as React.CSSProperties
          }
        >
          <aside id="parts-panel" className="parts-panel">
            <button
              className="mobile-close"
              aria-label="Đóng parts catalog"
              onClick={() => setPanel(null)}
            >
              <X size={19} />
            </button>
            <button
              className="desktop-panel-toggle left"
              aria-label="Thu gọn parts catalog"
              title="Thu gọn panel"
              onClick={() => setCollapseLeft(true)}
            >
              <PanelLeftClose size={15} />
            </button>
            <PartsCatalog notify={notify} onStartStaging={startStaging} />
            {!collapseLeft && (
              <div
                className={`panel-resize-handle left ${isResizingLeft ? "active" : ""}`}
                onPointerDown={handleLeftResizeStart}
                title="Kéo để chỉnh độ rộng panel"
                aria-label="Resize parts panel"
                role="separator"
                aria-orientation="vertical"
              />
            )}
          </aside>
          <main id="workspace-main" className="workspace-main" tabIndex={-1}>
            {collapseLeft && (
              <button
                className="floating-dock-pill left"
                title="Open Parts Catalog [Ctrl+K / /]"
                onClick={() => setCollapseLeft(false)}
              >
                <PanelLeftOpen size={15} />
                <span>Parts</span>
              </button>
            )}
            {collapseRight && (
              <button
                className="floating-dock-pill right"
                title="Open Inspector Panel"
                onClick={() => setCollapseRight(false)}
              >
                <SlidersHorizontal size={15} />
                <span>Inspector</span>
              </button>
            )}
            <AssemblyViewport
              model={model}
              staging={stagingPart}
              onPositionChange={handleStagingPositionChange}
              onAcceptPlacement={handleAcceptPlacement}
              onCancelPlacement={handleCancelPlacement}
              onStartStaging={startStaging}
            />
          </main>
          <aside id="inspector-panel" className="inspector-panel">
            {!collapseRight && (
              <div
                className={`panel-resize-handle right ${isResizingRight ? "active" : ""}`}
                onPointerDown={handleRightResizeStart}
                title="Kéo để chỉnh độ rộng inspector"
                aria-label="Resize inspector panel"
                role="separator"
                aria-orientation="vertical"
              />
            )}
            <button
              className="mobile-close"
              aria-label="Đóng inspector"
              onClick={() => setPanel(null)}
            >
              <X size={19} />
            </button>
            <button
              className="desktop-panel-toggle right"
              aria-label="Thu gọn inspector"
              title="Collapse panel"
              onClick={() => setCollapseRight(true)}
            >
              <PanelRightClose size={15} />
            </button>
            <InspectorPanel notify={notify} openImport={() => open("import")} />
          </aside>
        </div>
        
        {message ? (
          <motion.div
            key={message}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="toast visible"
            id="toast"
            role="status"
            aria-live="polite"
          >
            {message}
          </motion.div>
        ) : null}
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogTitle>Restore demo assembly?</DialogTitle>
            <DialogDescription>
              Unsaved changes will be lost. Models saved in My Hangar remain safe.
            </DialogDescription>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  store.reset();
                  setResetOpen(false);
                  notify("Demo project restored.");
                }}
              >
                Restore demo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MotionConfig>
  );
}
