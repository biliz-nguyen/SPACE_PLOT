import { useState, useRef, useEffect } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import {
  Search,
  GripVertical,
  ChevronDown,
  ChevronsUpDown,
  Box,
  Layers,
  PackageOpen,
  X,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import {
  CATALOG_FAMILIES,
  CATALOG_CATEGORIES,
  filterCatalog,
  CATEGORY_IMAGE_MAP,
} from "../catalog.js";
import { catalog, store, useProject, number, type Part } from "@/lib/project";
import { Button } from "./ui/button";
export function PartsCatalog({
  notify,
  onStartStaging,
}: {
  notify: (message: string) => void;
  onStartStaging?: (componentId: string, initialPosition?: [number, number, number]) => void;
}) {
  useProject();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [expanded, setExpanded] = useState<string[]>([]),
    [filterOpen, setFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handleOutsideClick = (e: PointerEvent | MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterOpen]);
  const matches = filterCatalog(catalog, category, search) as Part[];
  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">COMPONENT LIBRARY</span>
          <h2>Parts catalog</h2>
        </div>
        <span className="sr-only" id="part-count" aria-hidden="true">
          {catalog.length}
        </span>
      </div>
      <div className="catalog-toolbar">
        <div className="catalog-search">
          <Search size={15} />
          <input
            id="catalog-search"
            aria-label="Tìm linh kiện"
            placeholder="Find a component…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>

        <label className="sr-only" htmlFor="catalog-filter">
          Lọc theo nhóm linh kiện
        </label>
        <select
          id="catalog-filter"
          className="sr-only"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        >
          <option value="all">All component types</option>
          {CATALOG_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Space Cyber Component Filter Dropdown (Condensed 3-lines icon button) */}
        <div className="cyber-filter-container" ref={filterDropdownRef}>
          <button
            type="button"
            className={`cyber-filter-trigger icon-only ${filterOpen ? "active" : ""} ${category !== "all" ? "filtered" : ""}`}
            onClick={() => setFilterOpen((prev) => !prev)}
            aria-expanded={filterOpen}
            aria-haspopup="listbox"
            aria-label="Filter by component type"
            title={
              category === "all"
                ? "Filter component types"
                : `Filter: ${CATALOG_CATEGORIES.find((c) => c.id === category)?.label || category}`
            }
          >
            <SlidersHorizontal size={16} className="cyber-filter-icon-svg" />
            {category !== "all" && <span className="filter-active-dot" aria-hidden="true" />}
          </button>

        {filterOpen && (
          <div className="cyber-filter-menu" role="listbox">
            <div className="cyber-filter-menu-header">
              <span>SUBSYSTEM FILTER</span>
              <span className="status-dot good" />
            </div>

            <button
              type="button"
              role="option"
              aria-selected={category === "all"}
              className={`cyber-filter-option ${category === "all" ? "selected" : ""}`}
              onClick={() => {
                setCategory("all");
                setFilterOpen(false);
              }}
            >
              <div className="option-main">
                <SlidersHorizontal size={15} className="option-icon-svg" />
                <div className="option-text">
                  <strong>All component types</strong>
                  <small>Full aerospace component catalog</small>
                </div>
              </div>
              <div className="option-meta">
                <span className="option-count">{catalog.length}</span>
                {category === "all" && <Check size={14} className="option-check" />}
              </div>
            </button>

            <div className="cyber-filter-divider" />

            {CATALOG_FAMILIES.map((family) => (
              <div className="cyber-filter-family-group" key={family.name}>
                <div className="cyber-filter-family-title">{family.name}</div>
                {family.categories.map((c) => {
                  const isSelected = category === c.id;
                  const count = catalog.filter((p) => p.category === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`cyber-filter-option ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setCategory(c.id);
                        setFilterOpen(false);
                      }}
                    >
                      <div className="option-main">
                        {CATEGORY_IMAGE_MAP[c.id] ? (
                          <img
                            src={CATEGORY_IMAGE_MAP[c.id]}
                            alt=""
                            className="option-icon-img"
                          />
                        ) : (
                          <Box size={14} className="option-icon-svg" />
                        )}
                        <div className="option-text">
                          <strong>{c.label}</strong>
                          <small>{c.description}</small>
                        </div>
                      </div>
                      <div className="option-meta">
                        <span className="option-count">{count}</span>
                        {isSelected && <Check size={14} className="option-check" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      
      <div className="catalog-scroll">
        <div id="catalog-list">
          <Accordion.Root
            type="multiple"
            value={
              search || category !== "all"
                ? CATALOG_CATEGORIES.map((c) => c.id)
                : expanded
            }
            onValueChange={setExpanded}
          >
            {CATALOG_FAMILIES.map((family, idx) => {
              const categories = family.categories.filter((c) =>
                matches.some((p) => p.category === c.id),
              );
              return categories.length ? (
                <div className="catalog-family" key={family.name}>
                  <div className="family-header-row">
                    <div className="family-label">{family.name}</div>
                    {idx === 0 && (
                      <>
                        <span className="sr-only" id="catalog-match-count" aria-live="polite">
                          {matches.length} components
                        </span>
                        <button
                          id="catalog-toggle-all"
                          type="button"
                          className="cyber-expand-all-btn"
                          title={
                            expanded.length === CATALOG_CATEGORIES.length
                              ? "Collapse all categories"
                              : "Expand all categories"
                          }
                          onClick={() =>
                            setExpanded(
                              expanded.length === CATALOG_CATEGORIES.length
                                ? []
                                : CATALOG_CATEGORIES.map((c) => c.id),
                            )
                          }
                        >
                          <ChevronsUpDown size={12} className="expand-icon" />
                          <span>
                            {expanded.length === CATALOG_CATEGORIES.length
                              ? "Collapse all"
                              : "Expand all"}
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                  {categories.map((c) => {
                    const items = matches.filter((p) => p.category === c.id);
                    return (
                      <Accordion.Item
                        key={c.id}
                        value={c.id}
                        className="catalog-section"
                      >
                        <Accordion.Header>
                          <Accordion.Trigger
                            className="catalog-trigger"
                            data-toggle-category={c.id}
                          >
                            <span className="category-symbol">
                            {CATEGORY_IMAGE_MAP[c.id] ? (
                              <img
                                src={CATEGORY_IMAGE_MAP[c.id]}
                                alt=""
                                className="category-icon-img"
                              />
                            ) : (
                              <Box size={17} />
                            )}
                          </span>
                            <span>{c.label}</span>
                            <small>{items.length}</small>
                            <ChevronDown size={14} className="chevron" />
                          </Accordion.Trigger>
                        </Accordion.Header>
                        <Accordion.Content className="catalog-content">
                          {items.map((part) => (
                            <div
                              className="part-card part-row draggable-part"
                              key={part.id}
                              draggable="true"
                              data-add={part.id}
                              role="button"
                              tabIndex={0}
                              title={`Kéo ${part.name} vào 3D workspace hoặc click để xem lại tọa độ`}
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  "application/x-space-lot-part",
                                  part.id,
                                );
                                e.dataTransfer.setData("text/plain", part.id);
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              onClick={() => {
                                if (onStartStaging) {
                                  onStartStaging(part.id, [0, 0, 0]);
                                } else {
                                  notify(
                                    store.add(part.id)
                                      ? `Đã thêm ${part.name}`
                                      : "Scene đạt giới hạn 80 linh kiện.",
                                  );
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (onStartStaging) {
                                    onStartStaging(part.id, [0, 0, 0]);
                                  } else {
                                    notify(
                                      store.add(part.id)
                                        ? `Đã thêm ${part.name}`
                                        : "Scene đạt giới hạn 80 linh kiện.",
                                    );
                                  }
                                }
                              }}
                            >
                              <div className="part-card-main">
                                <div className="part-card-name">
                                  {CATEGORY_IMAGE_MAP[part.category] ? (
                                    <img
                                      src={CATEGORY_IMAGE_MAP[part.category]}
                                      alt=""
                                      className="part-icon-img"
                                    />
                                  ) : (
                                    <Layers size={14} className="part-icon" />
                                  )}
                                  <strong>{part.name}</strong>
                                </div>
                                <span className="part-sub">{part.subtitle}</span>
                              </div>
                              <div className="part-card-side">
                                <span className="part-meta">
                                  {part.massG === null
                                    ? "Unknown"
                                    : `${number(part.massG, 0)} g`}
                                </span>
                                <span
                                  className="drag-indicator"
                                  title="Kéo thả vào mô hình 3D"
                                  aria-hidden="true"
                                >
                                  <GripVertical size={14} />
                                </span>
                              </div>
                            </div>
                          ))}
                        </Accordion.Content>
                      </Accordion.Item>
                    );
                  })}
                </div>
              ) : null;
            })}
          </Accordion.Root>
          {matches.length === 0 ? (
            <div className="empty-state">
              <Search />
              <strong>Không tìm thấy linh kiện</strong>
              <p>Thử từ khóa hoặc nhóm khác.</p>
            </div>
          ) : null}
        </div>
        <div className="family-label hangar-label">
          MY LOCAL ASSETS <PackageOpen size={14} />
        </div>
        <div id="asset-shelf" />
        <div className="library-note">
          <Box size={18} />
          <p>
            Demo specifications.
            <br />
            <span>Verify against your hardware datasheets.</span>
          </p>
        </div>
      </div>
      
    </>
  );
}
