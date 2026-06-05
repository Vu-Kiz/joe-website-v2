import React, { useEffect, useMemo, useState } from "react";
import { getAdminNavPreferences, updateAdminNavRecents, updateAdminNavFavorites } from "../../api/admin/adminNavPreferences";
import { BTN_SM, BTN_GHOST_SM, INPUT} from "../../utils/ui";

export type AdminView =
  | "home"
  | "workerHealth"
  | "websiteHealth"
  | "tips"
  | "tenets"
  | "eotm"
  | "weather"
  | "users"
  | "siteLock"
  | "system"
  | "discordBot"
  | "combatValues"
  | "entityStats"
  | "memberChangelog"
  | "logs"
  | "memberAccessLogs"
  | "droidbrainUploads"
  | "astrogationUploads"
  | "toolStore"
  | "jobPayRates"
  | "materialPrices"
  | "supportTickets";

type NavItem = {
  key: AdminView;
  label: string;
  category: "Overview" | "Content" | "People" | "Operations" | "Data & Systems" | "Audit";
  role: "admin" | "sysadmin";
  keywords: string[];
  requiresSysadmin?: boolean;
  requiresLogAccess?: boolean;
};

type Props = {
  activeView: AdminView;
  onChange: (view: AdminView) => void;
  showSystemTools: boolean;
  canSeeLogs: boolean;
  userId?: number;
};

const MOBILE_BREAKPOINT = 1024;
const MAX_RECENTS = 6;
const QUICK_JUMP_BUTTON_CLASS =
  BTN_SM + " border-amber-200/30 !bg-[#111] !text-white/85 hover:!bg-amber-300/15 hover:!text-white";

const ALL_ITEMS: NavItem[] = [
  { key: "home", label: "Overview", category: "Overview", role: "admin", keywords: ["home", "overview"] },
  { key: "tips", label: "Tips", category: "Content", role: "admin", keywords: ["loading", "tips"] },
  { key: "tenets", label: "Tenets", category: "Content", role: "admin", keywords: ["reference", "tenets"] },
  { key: "eotm", label: "EoTM", category: "Content", role: "admin", keywords: ["employee", "month", "eotm"] },
  { key: "weather", label: "Weather", category: "Content", role: "admin", keywords: ["weather", "tatooine"] },
  { key: "memberChangelog", label: "Change Log", category: "Content", role: "admin", keywords: ["changelog", "release", "notes"] },
  { key: "users", label: "Users", category: "People", role: "admin", keywords: ["users", "permissions", "roles"] },
  { key: "jobPayRates", label: "Pay Rate Catalog", category: "People", role: "admin", keywords: ["pay", "rates", "catalog"] },
  { key: "materialPrices", label: "Material Prices", category: "People", role: "admin", keywords: ["material", "prices", "mining", "cost"] },
  { key: "workerHealth", label: "Worker Health", category: "Operations", role: "sysadmin", requiresSysadmin: true, keywords: ["worker", "queue", "health"] },
  { key: "websiteHealth", label: "Website Health", category: "Operations", role: "sysadmin", requiresSysadmin: true, keywords: ["website", "health", "runtime"] },
  { key: "discordBot", label: "Discord Bot", category: "Operations", role: "sysadmin", requiresSysadmin: true, keywords: ["discord", "bot", "guild"] },
  { key: "siteLock", label: "Site Lock", category: "Operations", role: "sysadmin", requiresSysadmin: true, keywords: ["site", "lock", "maintenance"] },
  { key: "system", label: "System", category: "Data & Systems", role: "sysadmin", requiresSysadmin: true, keywords: ["system", "pull", "refresh"] },
  { key: "combatValues", label: "Combat Values", category: "Data & Systems", role: "sysadmin", requiresSysadmin: true, keywords: ["combat", "values", "matrix"] },
  { key: "entityStats", label: "Entity Stats", category: "Data & Systems", role: "sysadmin", requiresSysadmin: true, keywords: ["entity", "stats", "catalog"] },
  { key: "droidbrainUploads", label: "DroidBrain Uploads", category: "Audit", role: "sysadmin", requiresSysadmin: true, keywords: ["droidbrain", "uploads", "imports"] },
  { key: "astrogationUploads", label: "Astrogation Uploads", category: "Audit", role: "sysadmin", requiresSysadmin: true, keywords: ["astrogation", "uploads", "imports", "galaxy", "events"] },
  { key: "toolStore", label: "Tools Store", category: "Data & Systems", role: "sysadmin", requiresSysadmin: true, keywords: ["store", "plans", "subscriptions"] },
  { key: "supportTickets", label: "Support Tickets", category: "Operations", role: "admin", keywords: ["support", "tickets", "bugs", "reports"] },
  { key: "logs", label: "Action Logs", category: "Audit", role: "sysadmin", requiresLogAccess: true, keywords: ["action", "logs", "audit"] },
  { key: "memberAccessLogs", label: "Member Access", category: "Audit", role: "sysadmin", requiresLogAccess: true, keywords: ["member", "access", "history"] },
];

const VALID_VIEWS = new Set<AdminView>(ALL_ITEMS.map((item) => item.key));

const CATEGORY_ORDER: NavItem["category"][] = ["Overview", "Content", "People", "Operations", "Data & Systems", "Audit"];


function matchesSearch(item: NavItem, needle: string): boolean {
  if (!needle.trim()) return true;
  const haystack = `${item.label} ${item.category} ${item.keywords.join(" ")}`.toLowerCase();
  return haystack.includes(needle.trim().toLowerCase());
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleChange = () => setIsMobile(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}

function getVisibleAdminNavItems(showSystemTools: boolean, canSeeLogs: boolean): NavItem[] {
  return ALL_ITEMS.filter((item) => {
    if (item.requiresSysadmin && !showSystemTools) return false;
    if (item.requiresLogAccess && !canSeeLogs) return false;
    return true;
  });
}

// Backward-compatible export for any stale imports during HMR.
// eslint-disable-next-line react-refresh/only-export-components
export function isAdminViewVisible(view: AdminView, showSystemTools: boolean, canSeeLogs: boolean): boolean {
  return getVisibleAdminNavItems(showSystemTools, canSeeLogs).some((item) => item.key === view);
}

const AdminNav: React.FC<Props> = ({
  activeView,
  onChange,
  showSystemTools,
  canSeeLogs,
  userId,
}) => {
  const isMobile = useIsMobile();
  const visible = useMemo(() => getVisibleAdminNavItems(showSystemTools, canSeeLogs), [showSystemTools, canSeeLogs]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [favorites, setFavorites] = useState<AdminView[]>([]);
  const [recents, setRecents] = useState<AdminView[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setRecents([]);
    setFavorites([]);

    (async () => {
      try {
        const response = await getAdminNavPreferences();
        if (cancelled) return;

        const incomingRecents = Array.isArray(response?.data?.recents) ? response.data.recents : [];
        setRecents(incomingRecents.filter((v): v is AdminView => VALID_VIEWS.has(v as AdminView)).slice(0, MAX_RECENTS));

        const incomingFavorites = Array.isArray(response?.data?.favorites) ? response.data.favorites : [];
        setFavorites(incomingFavorites.filter((v): v is AdminView => VALID_VIEWS.has(v as AdminView)));
      } catch {
        if (!cancelled) {
          setRecents([]);
          setFavorites([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const nextExpanded: Record<string, boolean> = {};
    for (const item of visible) {
      const sectionKey = `${item.role}:${item.category}`;
      if (nextExpanded[sectionKey] === undefined) {
        nextExpanded[sectionKey] = true;
      }
    }
    setExpanded((prev) => ({ ...nextExpanded, ...prev }));
  }, [visible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setPaletteQuery(searchTerm);
    }
  }, [paletteOpen, searchTerm]);

  const visibleMap = useMemo(() => {
    const map = new Map<AdminView, NavItem>();
    for (const item of visible) {
      map.set(item.key, item);
    }
    return map;
  }, [visible]);

  const filtered = useMemo(
    () => visible.filter((item) => matchesSearch(item, searchTerm)),
    [visible, searchTerm]
  );

  const filteredMap = useMemo(() => {
    const map = new Map<AdminView, NavItem>();
    for (const item of filtered) {
      map.set(item.key, item);
    }
    return map;
  }, [filtered]);

  const favoritesVisible = useMemo(
    () => favorites.filter((key) => filteredMap.has(key) && visibleMap.has(key)),
    [favorites, filteredMap, visibleMap]
  );
  const recentsVisible = useMemo(
    () => recents.filter((key) => filteredMap.has(key) && visibleMap.has(key) && !favoritesVisible.includes(key)),
    [recents, filteredMap, visibleMap, favoritesVisible]
  );

  const groupedByRole = useMemo(() => {
    const grouped: Record<"admin" | "sysadmin", Record<NavItem["category"], NavItem[]>> = {
      admin: {
        "Overview": [],
        "Content": [],
        "People": [],
        "Operations": [],
        "Data & Systems": [],
        "Audit": [],
      },
      sysadmin: {
        "Overview": [],
        "Content": [],
        "People": [],
        "Operations": [],
        "Data & Systems": [],
        "Audit": [],
      },
    };

    for (const item of filtered) {
      grouped[item.role][item.category].push(item);
    }

    return grouped;
  }, [filtered]);

  const paletteItems = useMemo(
    () => visible.filter((item) => matchesSearch(item, paletteQuery)),
    [visible, paletteQuery]
  );

  const optGroups = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    for (const item of filtered) {
      const label = item.category;
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    return groups;
  }, [filtered]);

  function rememberRecent(view: AdminView): void {
    setRecents((current) => {
      const next = [view, ...current.filter((key) => key !== view)].slice(0, MAX_RECENTS);
      void updateAdminNavRecents(next).catch(() => {});
      return next;
    });
  }

  function handleSelect(view: AdminView): void {
    onChange(view);
    rememberRecent(view);
    setPaletteOpen(false);
  }

  function toggleFavorite(view: AdminView): void {
    setFavorites((current) => {
      const next = current.includes(view)
        ? current.filter((key) => key !== view)
        : [view, ...current];
      void updateAdminNavFavorites(next).catch(() => {});
      return next;
    });
  }

  if (isMobile) {
    return (
      <div className="panel space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 font-tektur text-sm uppercase tracking-wide text-white/85">Admin Nav</h3>
          <button type="button" className={QUICK_JUMP_BUTTON_CLASS} onClick={() => setPaletteOpen(true)}>
            Quick Jump
          </button>
        </div>
        <input
          className={INPUT + " rounded-full pl-4"}
          type="search"
          placeholder="Search tools…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search admin tools"
        />
        {favoritesVisible.length > 0 && (
          <div className="space-y-2">
            <p className="m-0 text-xs uppercase tracking-wide text-white/60">Favorites</p>
            <div className="flex flex-wrap gap-2">
              {favoritesVisible.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={activeView === key ? BTN_SM : BTN_GHOST_SM}
                  onClick={() => handleSelect(key)}
                >
                  {visibleMap.get(key)?.label ?? key}
                </button>
              ))}
            </div>
          </div>
        )}
        <select
          className={INPUT}
          value={activeView}
          onChange={(event) => handleSelect(event.target.value as AdminView)}
        >
          {Object.entries(optGroups).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {paletteOpen && (
          <PaletteDialog
            query={paletteQuery}
            onQueryChange={setPaletteQuery}
            onClose={() => setPaletteOpen(false)}
            items={paletteItems}
            activeView={activeView}
            onSelect={handleSelect}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="panel space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 font-tektur text-sm uppercase tracking-wide text-white/85">Admin Tools</h3>
          <button type="button" className={QUICK_JUMP_BUTTON_CLASS} onClick={() => setPaletteOpen(true)}>
            Quick Jump
          </button>
        </div>
        <input
          className={INPUT + " rounded-full pl-4"}
          type="search"
          placeholder="Search tools…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search admin tools"
        />

        <QuickSection
          title="Favorites"
          empty="Pin tools with the star icon."
          views={favoritesVisible}
          activeView={activeView}
          onSelect={handleSelect}
          visibleMap={visibleMap}
          onToggleFavorite={toggleFavorite}
          favorites={favorites}
        />

        <QuickSection
          title="Recent"
          empty="Recent tools will appear here."
          views={recentsVisible}
          activeView={activeView}
          onSelect={handleSelect}
          visibleMap={visibleMap}
          onToggleFavorite={toggleFavorite}
          favorites={favorites}
        />

        {(["admin", "sysadmin"] as const).map((role) => {
          const roleLabel = role === "admin" ? "Admin" : "Sysadmin";
          const hasRoleItems = CATEGORY_ORDER.some((category) => groupedByRole[role][category].length > 0);
          if (!hasRoleItems) return null;
          return (
            <div key={role} className="space-y-2 pt-1">
              <p className="m-0 text-xs uppercase tracking-wide text-white/60">{roleLabel} Tools</p>
              {CATEGORY_ORDER.map((category) => {
                const items = groupedByRole[role][category];
                if (items.length === 0) return null;
                const sectionKey = `${role}:${category}`;
                const sectionOpen = searchTerm.trim() ? true : expanded[sectionKey] ?? true;
                return (
                  <section key={sectionKey} className="rounded-xl border border-white/10 bg-black/25">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-t-xl border-0 bg-transparent px-3 py-2 text-left text-sm font-semibold text-white/85"
                      onClick={() => setExpanded((current) => ({ ...current, [sectionKey]: !sectionOpen }))}
                    >
                      <span>{category}</span>
                      <span className="text-white/50">{sectionOpen ? "−" : "+"}</span>
                    </button>
                    {sectionOpen && (
                      <div className="space-y-1 px-2 pb-2">
                        {items.map((item) => {
                          const isFavorite = favorites.includes(item.key);
                          const isActive = activeView === item.key;
                          return (
                            <div key={item.key} className="flex items-center gap-1">
                              <button
                                type="button"
                                className={`flex-1 rounded-md border border-white/10 px-2 py-1.5 text-left text-sm transition ${isActive ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/45" : "bg-black/20 text-white/80 hover:bg-white/10 hover:text-white"}`}
                                onClick={() => handleSelect(item.key)}
                              >
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300/70 align-middle" />
                                <span className="ml-2 align-middle">{item.label}</span>
                              </button>
                              <button
                                type="button"
                                className={`h-8 w-8 rounded-md border border-white/10 bg-black/20 text-sm transition ${isFavorite ? "text-amber-300 hover:bg-amber-300/15" : "text-white/35 hover:bg-white/10 hover:text-white/70"}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(item.key);
                                }}
                                aria-label={isFavorite ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`}
                                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                              >
                                ★
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          );
        })}
      </div>
      {paletteOpen && (
        <PaletteDialog
          query={paletteQuery}
          onQueryChange={setPaletteQuery}
          onClose={() => setPaletteOpen(false)}
          items={paletteItems}
          activeView={activeView}
          onSelect={handleSelect}
        />
      )}
    </>
  );
};

type QuickSectionProps = {
  title: string;
  empty: string;
  views: AdminView[];
  activeView: AdminView;
  onSelect: (view: AdminView) => void;
  visibleMap: Map<AdminView, NavItem>;
  onToggleFavorite: (view: AdminView) => void;
  favorites: AdminView[];
};

const QuickSection: React.FC<QuickSectionProps> = ({
  title,
  empty,
  views,
  activeView,
  onSelect,
  visibleMap,
  onToggleFavorite,
  favorites,
}) => {
  return (
    <section className="space-y-2">
      <p className="m-0 text-xs uppercase tracking-wide text-white/60">{title}</p>
      {views.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed border-white/12 bg-black/15 px-3 py-2 text-xs text-white/45">
          {empty}
        </p>
      ) : (
        <div className="space-y-1">
          {views.map((view) => {
            const item = visibleMap.get(view);
            if (!item) return null;
            const isFavorite = favorites.includes(view);
            const isActive = activeView === view;
            return (
              <div key={view} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`flex-1 rounded-md border border-white/10 px-2 py-1.5 text-left text-sm transition ${isActive ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/45" : "bg-black/20 text-white/80 hover:bg-white/10 hover:text-white"}`}
                  onClick={() => onSelect(view)}
                >
                  {item.label}
                </button>
                <button
                  type="button"
                  className={`h-8 w-8 rounded-md border border-white/10 bg-black/20 text-sm transition ${isFavorite ? "text-amber-300 hover:bg-amber-300/15" : "text-white/35 hover:bg-white/10 hover:text-white/70"}`}
                  onClick={() => onToggleFavorite(view)}
                  aria-label={isFavorite ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`}
                  title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  ★
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

type PaletteDialogProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  items: NavItem[];
  activeView: AdminView;
  onSelect: (view: AdminView) => void;
};

const PaletteDialog: React.FC<PaletteDialogProps> = ({
  query,
  onQueryChange,
  onClose,
  items,
  activeView,
  onSelect,
}) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/65 p-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-amber-200/30 bg-[#111] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.55)]" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="m-0 text-sm font-semibold text-white/85">Jump to Tool</p>
          <button type="button" className={QUICK_JUMP_BUTTON_CLASS} onClick={onClose}>Close</button>
        </div>
        <input
          className={INPUT + " rounded-full pl-4"}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Type a tool name, category, or keyword…"
          autoFocus
        />
        <div className="mt-3 max-h-[50vh] overflow-auto rounded-lg border border-white/10 bg-black/25 p-2">
          {items.length === 0 ? (
            <p className="m-0 px-2 py-2 text-sm text-white/50">No matching tools.</p>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md border border-white/10 px-2 py-2 text-left text-sm transition ${activeView === item.key ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/45" : "bg-black/25 text-white/85 hover:bg-white/10"}`}
                  onClick={() => onSelect(item.key)}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-white/45">{item.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNav;
