import React, { useState } from "react";
import arrowLeftIcon from "../../assets/marketplace/ArrowLeftIcon.png";
import arrowRightIcon from "../../assets/marketplace/ArrowRightIcon.png";

type FilterCheckboxSectionProps<T extends string> = {
  title: string;
  selected: T[];
  onClear: () => void;
  options: Array<{ value: T; label: string }>;
  onToggle: (value: T) => void;
  isFirst?: boolean;
};

export function FilterCheckboxSection<T extends string>({ title, selected, onClear, options, onToggle, isFirst }: FilterCheckboxSectionProps<T>) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section className={`flex flex-col ${collapsed ? "gap-0" : "gap-[0.65rem]"} pt-[0.1rem] ${!isFirst ? "pt-[0.9rem] border-t border-white/6" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <button
          className="flex items-start justify-between gap-3 flex-1 min-w-0 bg-transparent border-0 text-inherit cursor-pointer p-0 text-left font-tektur"
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <div>
            <p className="m-0 text-white/88 text-[0.8rem] font-bold tracking-[0.04em] uppercase">{title}</p>
            <p className="m-0 mt-[0.18rem] text-white/45 text-[0.76rem]">{selected.length > 0 ? `${selected.length} selected` : "All"}</p>
          </div>
          <span className="text-white/52 text-[1rem] font-bold leading-none pt-[0.1rem]" aria-hidden="true">
            {collapsed ? "+" : "−"}
          </span>
        </button>
        <button
          className="inline-flex items-center justify-center min-h-[1.45rem] px-[0.45rem] py-[0.12rem] rounded-full border border-white/10 bg-white/2.5 text-white/58 cursor-pointer text-[0.68rem] font-semibold whitespace-nowrap transition-[background,border-color,color] duration-150 hover:bg-white/5 hover:border-white/16 hover:text-white/90 font-tektur"
          type="button"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-[0.45rem]">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={`flex items-center gap-[0.65rem] min-h-9 px-[0.2rem] py-[0.3rem] cursor-pointer transition-[color] duration-150 ${checked ? "text-white/96" : "text-white/62 hover:text-white/90"}`}
              >
                <input
                  className="absolute opacity-0 pointer-events-none font-tektur"
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.value)}
                />
                <span
                  className={`w-4 h-4 rounded-[0.28rem] shrink-0 transition-[border-color,background,box-shadow] duration-150 ${
                    checked
                      ? "border border-[rgba(183,138,67,0.78)] bg-[rgba(183,138,67,0.22)] shadow-[inset_0_0_0_2px_rgba(19,18,15,0.82)]"
                      : "border border-white/22 bg-white/1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[0.88rem] leading-[1.3]">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

type FilterGroupProps = {
  title: string;
  isFirst?: boolean;
  children: React.ReactNode;
};

export const FilterGroup: React.FC<FilterGroupProps> = ({ title, isFirst, children }) => (
  <section className={`flex flex-col gap-[0.45rem] pt-[0.1rem] ${!isFirst ? "pt-[0.9rem] border-t border-white/6" : ""}`}>
    <p className="m-0 text-white/88 text-[0.8rem] font-bold tracking-[0.04em] uppercase">{title}</p>
    {children}
  </section>
);

type FilterSidebarProps = {
  panelLabel: string;
  summaryText: string;
  activeFilterCount: number;
  children: React.ReactNode;
  results: React.ReactNode;
};

export const FilterSidebar: React.FC<FilterSidebarProps> = ({ panelLabel, summaryText, activeFilterCount, children, results }) => {
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Grid columns: collapsed sidebar is ~2.9rem wide; expanded is 240-280px
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gap: "1.25rem",
    gridTemplateColumns: filtersCollapsed
      ? "2.9rem minmax(0,1fr)"
      : "minmax(240px,280px) minmax(0,1fr)",
  };

  // Filter panel bg as inline style (gradient can't be Tailwind arbitrary)
  const filterPanelStyle: React.CSSProperties = filtersCollapsed
    ? {
        padding: "0.45rem",
        alignItems: "stretch",
        borderColor: "rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))",
      }
    : {
        background: "linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      };

  // Toggle button style when collapsed (vertical pill)
  const toggleBtnStyle: React.CSSProperties = filtersCollapsed
    ? {
        width: "2rem",
        minHeight: "8.75rem",
        padding: "0.55rem 0.1rem",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        borderRadius: "999px",
        borderColor: "rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.015)",
        color: "rgba(255,255,255,0.72)",
      }
    : {};

  const toggleLabelStyle: React.CSSProperties = filtersCollapsed
    ? { writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.12em" }
    : {};

  const toggleIconStyle: React.CSSProperties = filtersCollapsed
    ? { width: "0.72rem", height: "0.72rem", opacity: 0.8 }
    : {};

  return (
    <div style={gridStyle} className="max-[920px]:grid-cols-1!">
      <aside className="min-w-0">
        <section
          className="sticky top-4 flex flex-col gap-4 p-4 border border-white/8 rounded-[14px] max-[920px]:static"
          style={filterPanelStyle}
        >
          <div className={`flex ${filtersCollapsed ? "justify-center" : "justify-start"}`}>
            <button
              className="inline-flex items-center gap-[0.45rem] w-full border border-white/8 rounded-[10px] bg-white/2 text-white/82 cursor-pointer text-[0.78rem] font-bold tracking-[0.03em] min-h-[2.6rem] px-[0.7rem] py-[0.55rem] transition-[border-color,background,color] duration-150 hover:border-white/16 hover:bg-white/5 hover:text-white/96 font-tektur"
              type="button"
              style={toggleBtnStyle}
              onClick={() => setFiltersCollapsed((c) => !c)}
              aria-expanded={!filtersCollapsed}
              aria-controls="filter-sidebar-body"
            >
              <span style={toggleLabelStyle}>{filtersCollapsed ? "Filters" : "Hide Filters"}</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-[0.28rem] rounded-full bg-[rgba(183,138,67,0.16)] text-[#e7c37d] text-[0.68rem] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
              <img
                src={filtersCollapsed ? arrowRightIcon : arrowLeftIcon}
                alt=""
                aria-hidden="true"
                className="shrink-0"
                style={filtersCollapsed ? toggleIconStyle : { width: "0.8rem", height: "0.8rem", objectFit: "contain", flexShrink: 0 }}
              />
            </button>
          </div>

          {!filtersCollapsed && (
            <div id="filter-sidebar-body" className="flex flex-col gap-4">
              <div className="flex flex-col gap-[0.45rem]">
                <div>
                  <p className="m-0 text-white/50 text-[0.72rem] font-bold tracking-[0.08em] uppercase">{panelLabel}</p>
                  <p className="m-0 mt-[0.2rem] text-white/56 text-[0.82rem]">{summaryText}</p>
                  {activeFilterCount > 0 && (
                    <p className="m-0 text-white/56 text-[0.82rem]">{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</p>
                  )}
                </div>
              </div>

              {children}
            </div>
          )}
        </section>
      </aside>

      <section className="min-w-0 flex flex-col gap-4">
        {results}
      </section>
    </div>
  );
};
