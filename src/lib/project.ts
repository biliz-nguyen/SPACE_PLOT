import { useSyncExternalStore } from "react";
import { store as legacyStore, catalog as legacyCatalog } from "../store.js";
import {
  analyze as legacyAnalyze,
  validate as legacyValidate,
} from "../engineering.js";
export type Vector3 = [number, number, number];
export type StudioTab = "import" | "local" | "ai" | "community";
export interface Part {
  id: string;
  name: string;
  category: string;
  subtitle: string;
  massG: number | null;
  dimensionsMm: Vector3;
  assetId?: string;
  origin?: string;
  ports?: { id: string; direction: string }[];
}
export interface Instance {
  id: string;
  componentId: string;
  positionMm: Vector3;
}
export interface Wire {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
  kind: string;
  label: string;
}
export interface Project {
  projectName: string;
  instances: Instance[];
  connections: Wire[];
}
export interface ProjectStore {
  project: Project;
  selectedId: string | null;
  mode: string;
  tool: string;
  explode: number;
  showLabels: boolean;
  showClearance: boolean;
  highlightedWire: string;
  subscribe: (callback: () => void) => () => void;
  changed: (save?: boolean) => void;
  select: (id: string | null) => void;
  move: (id: string, position: Vector3) => void;
  remove: (id: string | null) => void;
  add: (id: string, initialPosition?: Vector3 | null) => Instance | null;
  getDefaultPosition: (componentId: string) => Vector3;
  reset: () => void;
  import: (project: unknown) => void;
  addWire: (from: string, fromPort: string, to: string, toPort: string) => void;
  removeWire: (id: string) => void;
}
export const store = legacyStore as unknown as ProjectStore;
export const catalog = legacyCatalog as Part[];
let revision = 0;
const listeners = new Set<() => void>();
const unsubscribe = store.subscribe(() => {
  revision++;
  listeners.forEach((listener) => listener());
});
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    unsubscribe();
    listeners.clear();
  });
export function useProject() {
  useSyncExternalStore(subscribe, () => revision);
  return store;
}
export function partOf(instance: Instance) {
  return catalog.find((part) => part.id === instance.componentId);
}
export const analyze = legacyAnalyze as unknown as (
  project: Project,
  parts: Part[],
) => {
  massG: number;
  cgMm: Vector3;
  cgOffsetMm: number;
  twr: number | null;
  hoverMin: number | null;
  incompleteMass: boolean;
};
export const validate = legacyValidate as unknown as (
  project: Project,
  parts: Part[],
) => {
  summary: { fail: number; warning: number; unknown: number; pass: number };
  issues: { level: string; code: string; message: string }[];
};
export const number = (value: number | null, decimals = 1) =>
  value !== null && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: decimals })
    : "—";
export function downloadJSON(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
