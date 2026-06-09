import React, { useEffect, useMemo, useState } from "react";
import type { SwcUser } from "../../api/core/auth";
import { isSysadmin } from "../../auth/permissions";
import { getMemberChangelog, type MemberChangelogEntry } from "../../api/members/memberChangelog";
import HamburgerToggle from "../common/HamburgerToggle";
import PrivilegePreviewPanel, {
  canSeeAudienceWithPrivs,
  toPreviewPrivs,
  type PreviewPrivs,
} from "./PrivilegePreviewPanel";
import { BTN, BTN_SM, INPUT} from "../../utils/ui";
import ReportBugButton from "../support/ReportBugButton";

type MemberRoleChangelogPanelProps = {
  user: SwcUser | null;
  initialVersionFilter?: string | null;
  onBack: () => void;
};

const MemberRoleChangelogPanel: React.FC<MemberRoleChangelogPanelProps> = ({
  user,
  initialVersionFilter = null,
  onBack,
}) => {
  const [entries, setEntries] = useState<MemberChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [versionFilter, setVersionFilter] = useState("all");
  const [toolFilter, setToolFilter] = useState("all");
  const [previewPrivs, setPreviewPrivs] = useState<PreviewPrivs>(() => toPreviewPrivs(user));
  const [openVersions, setOpenVersions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setPreviewPrivs(toPreviewPrivs(user));
  }, [user]);

  const isSysadminUser = isSysadmin(user);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMemberChangelog();
        if (cancelled) return;
        setEntries(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load changelog.");
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const privilegeVisibleEntries = useMemo(() => {
    if (!isSysadminUser) {
      return entries;
    }

    return entries.filter((entry) =>
      (entry.audiences ?? []).length === 0
        ? true
        : (entry.audiences ?? []).some((audience) => canSeeAudienceWithPrivs(audience, previewPrivs))
    );
  }, [entries, isSysadminUser, previewPrivs]);

  const versionOptions = useMemo(() => {
    const values = Array.from(new Set(privilegeVisibleEntries.map((entry) => entry.version).filter(Boolean)));
    return values.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
  }, [privilegeVisibleEntries]);

  const toolOptions = useMemo(() => {
    const scopedEntries = privilegeVisibleEntries.filter((entry) =>
      versionFilter === "all" ? true : entry.version === versionFilter
    );
    const values = Array.from(
      new Set(scopedEntries.flatMap((entry) => entry.tools ?? []).map((tool) => tool.trim()).filter(Boolean)),
    );
    return values.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [privilegeVisibleEntries, versionFilter]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return privilegeVisibleEntries.filter((entry) => {
      const matchesVersion = versionFilter === "all" || entry.version === versionFilter;
      const matchesTool = toolFilter === "all" || (entry.tools ?? []).some((tool) => tool === toolFilter);
      const matchesSearch =
        !query || `${entry.version} ${entry.title} ${entry.details} ${entry.tools.join(" ")}`.toLowerCase().includes(query);
      return matchesVersion && matchesTool && matchesSearch;
    });
  }, [privilegeVisibleEntries, search, versionFilter, toolFilter]);

  useEffect(() => {
    if (versionFilter !== "all" && !versionOptions.includes(versionFilter)) {
      setVersionFilter("all");
    }
  }, [versionFilter, versionOptions]);

  useEffect(() => {
    if (toolFilter !== "all" && !toolOptions.includes(toolFilter)) {
      setToolFilter("all");
    }
  }, [toolFilter, toolOptions]);

  const versionGroups = useMemo(() => {
    const grouped: Array<{
      version: string;
      entries: MemberChangelogEntry[];
      releasedAt: string | null;
    }> = [];
    const map = new Map<string, number>();

    filteredEntries.forEach((entry) => {
      const existingIndex = map.get(entry.version);
      if (existingIndex !== undefined) {
        grouped[existingIndex].entries.push(entry);
        if (!grouped[existingIndex].releasedAt && entry.released_at) {
          grouped[existingIndex].releasedAt = entry.released_at;
        }
        return;
      }

      map.set(entry.version, grouped.length);
      grouped.push({
        version: entry.version,
        entries: [entry],
        releasedAt: entry.released_at,
      });
    });

    return grouped;
  }, [filteredEntries]);

  useEffect(() => {
    if (!versionGroups.length) return;
    setOpenVersions((current) => {
      const next = { ...current };
      versionGroups.forEach((group, index) => {
        if (typeof next[group.version] !== "boolean") {
          next[group.version] = index === 0;
        }
      });
      return next;
    });
  }, [versionGroups]);

  const toggleVersion = (version: string) => {
    setOpenVersions((current) => ({
      ...current,
      [version]: !current[version],
    }));
  };

  useEffect(() => {
    if (!initialVersionFilter) {
      return;
    }

    const normalized = initialVersionFilter.trim().replace(/^v/i, "");
    if (!normalized) {
      return;
    }

    setVersionFilter(normalized);
  }, [initialVersionFilter]);

  const clearFilters = () => {
    setSearch("");
    setVersionFilter("all");
    setToolFilter("all");
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button className={BTN} type="button" onClick={onBack}>
          Back to Overview
        </button>
        <ReportBugButton toolKey="member_changelog" toolLabel="Role-Based Change Log" />
      </div>

      <section className="panel grid gap-[0.85rem]">
        <div className="grid gap-[0.3rem]">
          <h2 className="m-0">Role-Based Change Log</h2>
          <p className="small m-0 opacity-[0.86]">
            Showing only updates for tools this account can access.
          </p>
        </div>

        <div className="grid gap-[0.55rem]">
          {isSysadminUser ? (
            <PrivilegePreviewPanel
              value={previewPrivs}
              onChange={setPreviewPrivs}
              onReset={() => setPreviewPrivs(toPreviewPrivs(user))}
              title="Preview Privileges"
            />
          ) : null}

          <input
            type="text"
            className={INPUT}
            placeholder="Search updates by version, title, details, or tool"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))_auto] gap-[0.55rem] items-center max-[900px]:grid-cols-1">
            <select
              className={INPUT}
              value={versionFilter}
              onChange={(event) => setVersionFilter(event.target.value)}
            >
              <option value="all">All versions</option>
              {versionOptions.map((version) => (
                <option key={version} value={version}>
                  v{version}
                </option>
              ))}
            </select>
            <select
              className={INPUT}
              value={toolFilter}
              onChange={(event) => setToolFilter(event.target.value)}
            >
              <option value="all">All tools</option>
              {toolOptions.map((tool) => (
                <option key={tool} value={tool}>
                  {tool}
                </option>
              ))}
            </select>
            <button type="button" className={BTN_SM + " all"} onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
          <p className="small m-0 opacity-[0.86]">
            {loading ? "Loading…" : `${filteredEntries.length} update${filteredEntries.length === 1 ? "" : "s"} shown`}
          </p>
        </div>

        <div className="grid gap-[0.75rem]">
          {loading ? <p className="small m-0">Loading changelog…</p> : null}
          {error ? <p className="small m-0 text-[salmon]">{error}</p> : null}
          {!loading && !error && !filteredEntries.length ? (
            <p className="small m-0">
              No changelog entries are available for your current role flags.
            </p>
          ) : null}
          {!loading && !error && versionGroups.length
            ? versionGroups.map((group) => {
                const isOpen = !!openVersions[group.version];
                const releasedLabel = group.releasedAt ? new Date(group.releasedAt).toLocaleDateString() : null;
                return (
                  <section key={group.version} className="panel grid gap-[0.75rem]">
                    <div className="flex items-center justify-between gap-[0.8rem]">
                      <div className="grid gap-[0.2rem]">
                        <h3 className="m-0 text-[rgba(246,163,0,0.95)]">v{group.version}</h3>
                        <p className="small m-0 opacity-80">
                          {group.entries.length} update{group.entries.length === 1 ? "" : "s"}
                          {releasedLabel ? ` · Released ${releasedLabel}` : ""}
                        </p>
                      </div>
                      <HamburgerToggle
                        open={isOpen}
                        onClick={() => toggleVersion(group.version)}
                        ariaLabel={`${isOpen ? "Collapse" : "Expand"} v${group.version} updates`}
                      />
                    </div>

                    {isOpen ? (
                      <div className="grid gap-[0.55rem]">
                        {group.entries.map((entry) => (
                          <article key={entry.id} className="grid gap-[0.35rem] p-[0.75rem_0.85rem] rounded-[12px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(246,163,0,0.05))]">
                            <h4 className="m-0 text-base">{entry.title}</h4>
                            <p className="small m-0 leading-[1.42]">{entry.details}</p>
                            <div className="flex flex-wrap gap-[0.35rem]">
                              {entry.tools.map((tool) => (
                                <span key={`${entry.id}-${tool}`} className="inline-flex items-center min-h-[26px] px-[0.55rem] py-[0.2rem] rounded-full border border-[rgba(246,163,0,0.42)] bg-[rgba(246,163,0,0.1)] text-[rgba(255,214,122,0.95)] text-[0.78rem] font-bold">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })
            : null}

          {isSysadminUser ? (
            <p className="small m-0 opacity-70">
              Toggle privilege flags above to preview visibility the same way access perms are enabled.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
};

export default MemberRoleChangelogPanel;
