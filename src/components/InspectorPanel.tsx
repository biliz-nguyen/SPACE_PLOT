import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Box,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Trash2,
  Download,
  Unplug,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import {
  catalog,
  store,
  useProject,
  partOf,
  number,
  validate,
  analyze,
  downloadJSON,
  type Vector3,
} from "@/lib/project";
import { Button } from "./ui/button";
import { CATEGORY_IMAGE_MAP } from "../catalog.js";
export function InspectorPanel({
  notify,
  openImport,
}: {
  notify: (message: string) => void;
  openImport: () => void;
}) {
  useProject();
  const [tab, setTab] = useState("inspect"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  useEffect(() => {
    if (store.mode === "wiring") setTab("wiring");
  }, [store.mode]);
  useEffect(() => {
    if (store.selectedId) setTab("inspect");
  }, [store.selectedId]);
  const selected = store.project.instances.find(
      (i) => i.id === store.selectedId,
    ),
    part = selected ? partOf(selected) : undefined,
    result = validate(store.project, catalog);
  const ports = store.project.instances.flatMap((instance) =>
    (partOf(instance)?.ports || []).map((port) => ({
      value: `${instance.id}|${port.id}`,
      label: `${instance.id} · ${port.id}`,
      direction: port.direction,
    })),
  );
  const sources = ports.filter((p) => p.direction === "out"),
    targets = ports.filter((p) => p.direction === "in");
  function report() {
    downloadJSON("space-lot-validation-report.json", {
      generatedAt: new Date().toISOString(),
      title: "SPACE_PLOT prototype validation report",
      disclaimer: "ILLUSTRATIVE DATA ONLY — DOES NOT APPROVE REAL HARDWARE",
      projectName: store.project.projectName,
      summary: analyze(store.project, catalog),
      validation: result,
      instances: store.project.instances.map((i) => ({
        id: i.id,
        name: partOf(i)?.name,
        positionMm: i.positionMm,
      })),
    });
    notify("Đã xuất báo cáo JSON.");
  }
  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ENGINEERING DESK</span>
          <h2>Inspector</h2>
        </div>
      </div>
      <Tabs.Root value={tab} onValueChange={setTab} className="inspector-tabs">
        <Tabs.List aria-label="Inspector views" className="segmented">
          <Tabs.Trigger value="inspect">Inspect</Tabs.Trigger>
          <Tabs.Trigger value="wiring">Wiring</Tabs.Trigger>
          <Tabs.Trigger value="checks">
            Checks{" "}
            <span
              className={
                result.summary.fail
                  ? "issue-count"
                  : result.summary.unknown
                    ? "unknown-count"
                    : "check-count"
              }
            >
              {result.summary.fail ||
                result.summary.warning ||
                result.summary.unknown ||
                "✓"}
            </span>
          </Tabs.Trigger>
        </Tabs.List>
        <div className="inspector-content">
          <Tabs.Content value="inspect" className="inspector-tab">
            <section id="selected-panel" className="inspector-section">
              <div className="section-caption">
                COMPONENT DETAILS <span className="technical">mm / g</span>
              </div>
              <div id="selected-content">
                {part && selected ? (
                  <>
                    <div className="selection-hero">
                      <span className="selected-symbol">
                        {part.category && CATEGORY_IMAGE_MAP[part.category] ? (
                          <img
                            src={CATEGORY_IMAGE_MAP[part.category]}
                            alt=""
                            className="inspector-icon-img"
                          />
                        ) : (
                          <Box size={20} />
                        )}
                      </span>
                      <div>
                        <strong>{part.name}</strong>
                        <small>{selected.id}</small>
                      </div>
                    </div>
                    <span className="data-badge">
                      {part.assetId
                        ? part.origin === "ai"
                          ? "AI VISUAL"
                          : "IMPORTED MESH"
                        : "DEMO SPECIFICATION"}
                    </span>
                    <dl className="spec-list">
                      <div>
                        <dt>Dimensions</dt>
                        <dd>
                          {part.dimensionsMm
                            .map((n) => number(n, 0))
                            .join(" × ")}{" "}
                          <span>mm</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Mass</dt>
                        <dd>
                          {part.massG === null
                            ? "Unknown"
                            : `${number(part.massG)} g`}
                        </dd>
                      </div>
                    </dl>
                    <div className="section-caption position-title">
                      POSITION <span>Engineering axes</span>
                    </div>
                    <div className="position-grid">
                      {["X · forward", "Y · right", "Z · up"].map(
                        (axis, index) => (
                          <label key={axis}>
                            {axis}
                            <input
                              type="number"
                              data-pos={index}
                              value={selected.positionMm[index]}
                              step="1"
                              min="-5000"
                              max="5000"
                              onChange={(e) => {
                                if (!Number.isFinite(e.target.valueAsNumber))
                                  return;
                                const position = [
                                  ...selected.positionMm,
                                ] as Vector3;
                                position[index] = e.target.valueAsNumber;
                                store.move(selected.id, position);
                              }}
                            />
                          </label>
                        ),
                      )}
                    </div>
                    <div className="selection-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        id="load-model-btn"
                        onClick={openImport}
                      >
                        <Plus />
                        Import model
                      </Button>
                      <Button
                        variant="danger"
                        size="icon"
                        id="delete-selected"
                        aria-label="Remove selected component"
                        onClick={() => {
                          store.remove(store.selectedId);
                          notify("Đã xóa linh kiện và các kết nối liên quan.");
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <p className="helper">
                      {part.assetId
                        ? "Geometry imported. Engineering specifications remain unverified."
                        : "Illustrative specifications. Confirm with a manufacturer datasheet."}
                    </p>
                  </>
                ) : (
                  <div className="empty-state">
                    <Box size={24} />
                    <strong>Select a component</strong>
                    <p>
                      Chọn trên mô hình 3D hoặc trong assembly tree để kiểm tra
                      và chỉnh tọa độ.
                    </p>
                  </div>
                )}
              </div>
            </section>
            <details open className="inspector-disclosure">
              <summary className="section-caption disclosure-summary">
                <span>ASSEMBLY TREE</span>
                <span className="disclosure-badge">
                  <span id="instance-count">
                    {store.project.instances.length} PARTS
                  </span>
                  <ChevronDown size={14} className="disclosure-chevron" />
                </span>
              </summary>
              <div className="assembly-tree" id="assembly-tree">
                {store.project.instances.map((instance) => {
                  const component = partOf(instance);
                  return (
                    <button
                      key={instance.id}
                      data-select={instance.id}
                      className={`tree-item ${selected?.id === instance.id ? "active" : ""}`}
                      onClick={() => store.select(instance.id)}
                    >
                      {component?.category && CATEGORY_IMAGE_MAP[component.category] ? (
                        <img
                          src={CATEGORY_IMAGE_MAP[component.category]}
                          alt=""
                          className="tree-icon-img"
                        />
                      ) : (
                        <Box size={14} />
                      )}
                      <span>{component?.name || "Unknown component"}</span>
                      <ChevronRight size={13} />
                    </button>
                  );
                })}
                {store.project.instances.length === 0 ? (
                  <div className="empty-state">
                    Thêm linh kiện từ Parts catalog để bắt đầu.
                  </div>
                ) : null}
              </div>
            </details>
          </Tabs.Content>
          <Tabs.Content value="wiring" className="inspector-tab">
            <section id="wiring-panel" className="inspector-section">
              <div className="section-caption">
                CONNECTIONS{" "}
                <span id="wire-count">
                  {store.project.connections.length} LINKS
                </span>
              </div>
              <p className="helper">
                Demo connections. Verify power, ground and pinouts before wiring
                real hardware.
              </p>
              <label className="field-label">
                Highlight link
                <select
                  id="wire-focus"
                  value={store.highlightedWire}
                  onChange={(e) => {
                    store.highlightedWire = e.target.value;
                    store.changed(false);
                  }}
                >
                  <option value="all">All links</option>
                  {store.project.connections.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label || w.id}
                    </option>
                  ))}
                </select>
              </label>
              <div id="wire-list">
                {store.project.connections.map((w) => (
                  <div className="wire-row" key={w.id}>
                    <Unplug size={16} />
                    <div>
                      <strong>{w.label || w.id}</strong>
                      <small>
                        {w.fromPort} → {w.toPort}
                      </small>
                    </div>
                    <button
                      aria-label={`Xóa ${w.label}`}
                      data-remove-wire={w.id}
                      onClick={() => store.removeWire(w.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="wire-creator">
                <label className="field-label">
                  Output
                  <select
                    id="wire-from"
                    value={from || sources[0]?.value || ""}
                    onChange={(e) => setFrom(e.target.value)}
                  >
                    {sources.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Input
                  <select
                    id="wire-to"
                    value={to || targets[0]?.value || ""}
                    onChange={(e) => setTo(e.target.value)}
                  >
                    {targets.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="outline"
                  className="w-full"
                  id="add-wire-btn"
                  disabled={!sources.length || !targets.length}
                  onClick={() => {
                    const [a, ap] = (from || sources[0]?.value || "").split(
                        "|",
                      ),
                      [b, bp] = (to || targets[0]?.value || "").split("|");
                    if (!a || !b) return;
                    store.addWire(a, ap, b, bp);
                    store.highlightedWire = "all";
                    store.changed(false);
                    notify("Đã thêm demo link. Xem Checks để kiểm tra.");
                  }}
                >
                  <Plus />
                  Add demo link
                </Button>
              </div>
            </section>
          </Tabs.Content>
          <Tabs.Content value="checks" className="inspector-tab">
            <section className="inspector-section">
              <div className="validation-summary">
                <span
                  id="health-dot"
                  className={`status-led ${result.summary.fail ? "bad" : ""}`}
                />
                <strong>
                  {result.summary.fail
                    ? "Review required"
                    : result.summary.unknown
                      ? "Specifications incomplete"
                      : "Demo checks complete"}
                </strong>
              </div>
              <p id="checks-summary" className="helper">
                {result.summary.fail} errors · {result.summary.warning} warnings
                · {result.summary.unknown} unknown
              </p>
              <div id="diagnostics">
                {result.issues.map((issue, index) => (
                  <div
                    className={`diagnostic ${issue.level}`}
                    key={`${issue.code}-${index}`}
                  >
                    {issue.level === "pass" ? (
                      <CheckCircle2 size={17} />
                    ) : issue.level === "unknown" ? (
                      <HelpCircle size={17} />
                    ) : (
                      <AlertTriangle size={17} />
                    )}
                    <div>
                      <strong>{issue.code.replaceAll("_", " ")}</strong>
                      <p>{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="scope-note">
                PASS = qua quy tắc demo. Không xác nhận an toàn bay, nhiệt ESC,
                rung động hoặc pinout thực tế.
              </p>
            </section>
          </Tabs.Content>
        </div>
      </Tabs.Root>
      <div className="inspector-footer">
        <Button
          variant="outline"
          id="report-btn"
          className="w-full"
          onClick={report}
        >
          <Download />
          Validation report
        </Button>
        <span>Engineering insights · illustrative data</span>
      </div>
    </>
  );
}
