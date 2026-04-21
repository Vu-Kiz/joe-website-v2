import React, { useEffect, useMemo, useState } from "react";
import type { SwcUser } from "../../api/auth";
import { isSysadmin } from "../../auth/permissions";
import { getMemberChangelog, type MemberChangelogEntry } from "../../api/memberChangelog";
import HamburgerToggle from "../common/HamburgerToggle";
import PrivilegePreviewPanel, {
  canSeeAudienceWithPrivs,
  toPreviewPrivs,
  type PreviewPrivs,
} from "./PrivilegePreviewPanel";

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
      <div className="members-tool-back">
        <button className="btn" type="button" onClick={onBack}>
          Back to Overview
        </button>
      </div>

      <section className="panel members-changelog">
        <div className="members-changelog__header">
          <h2 className="members-changelog__title">Role-Based Change Log</h2>
          <p className="small members-changelog__subtitle">
            Showing only updates for tools this account can access.
          </p>
        </div>

        <div className="members-changelog__toolbar">
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
            className="input"
            placeholder="Search updates by version, title, details, or tool"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="members-changelog__filters">
            <select
              className="input"
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
              className="input"
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
            <button type="button" className="btn btn--small" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
          <p className="small members-changelog__count">
            {loading ? "Loading…" : `${filteredEntries.length} update${filteredEntries.length === 1 ? "" : "s"} shown`}
          </p>
        </div>

        <div className="members-changelog__body">
          {loading ? <p className="small members-changelog__status">Loading changelog…</p> : null}
          {error ? <p className="small members-changelog__status members-changelog__status--error">{error}</p> : null}
          {!loading && !error && !filteredEntries.length ? (
            <p className="small members-changelog__status">
              No changelog entries are available for your current role flags.
            </p>
          ) : null}
          {!loading && !error && versionGroups.length
            ? versionGroups.map((group) => {
                const isOpen = !!openVersions[group.version];
                const releasedLabel = group.releasedAt ? new Date(group.releasedAt).toLocaleDateString() : null;
                return (
                  <section key={group.version} className="panel members-changelog__version">
                    <div className="members-changelog__version-head">
                      <div className="members-changelog__version-copy">
                        <h3 className="members-changelog__version-title">v{group.version}</h3>
                        <p className="small members-changelog__version-meta">
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
                      <div className="members-changelog__entries">
                        {group.entries.map((entry) => (
                          <article key={entry.id} className="members-changelog__entry">
                            <h4 className="members-changelog__entry-title">{entry.title}</h4>
                            <p className="small members-changelog__entry-details">{entry.details}</p>
                            <div className="members-changelog__tool-list">
                              {entry.tools.map((tool) => (
                                <span key={`${entry.id}-${tool}`} className="members-changelog__tool-chip">
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
            <p className="small members-changelog__sys-note">
              Toggle privilege flags above to preview visibility the same way access perms are enabled.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
};

export default MemberRoleChangelogPanel;
