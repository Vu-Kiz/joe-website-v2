import React, { useEffect, useState } from "react";
import {
  listAdminAstrogationUploads,
  pullAstrogationForUser,
  type AdminAstrogationUploadItem,
  type AdminAstrogationPullResult,
  type AdminAstrogationRewardBreakdownItem,
  type AdminAstrogationImportArea,
} from "../../api/admin/adminAstrogationUploads";
import { listAdminUsers, type AdminManageableUser } from "../../api/admin/adminUsers";
import Pagination from "../common/Pagination";
import { INPUT } from "../../utils/ui";

const BTN_SM =
  "inline-flex min-h-[34px] items-center justify-center rounded-[10px] border px-[0.8rem] py-2 text-[0.88rem] font-bold leading-none no-underline transition-[border-color,background,transform,box-shadow] duration-150 ease-out hover:enabled:-translate-y-px hover:enabled:border-[#f5d546]/[0.28] hover:enabled:bg-[#f5d546]/[0.07] disabled:cursor-not-allowed disabled:opacity-[0.55] font-tektur";
const BTN_PRIMARY =
  "border-[#f5d546]/35 bg-[#f5d546]/10 text-[#f2c46f] shadow-[inset_0_0_0_1px_rgba(245,213,70,0.08)] hover:enabled:border-[#f5d546]/45 hover:enabled:bg-[#f5d546]/15";
const BTN_SOFT = "border-white/10 bg-white/[0.025] text-white/90";

const NEW_CLS = "text-[rgb(100,220,120)]";
const UPDATED_CLS = "text-[rgba(246,163,0,0.9)]";
const ASTEROID_CLS = "text-[rgb(100,200,255)]";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const PAGE_SIZE = 25;

const RULE_LABELS: Record<string, string> = {
  new_ds: "New DS",
  new_af: "New AF",
  updated_ds_1y: "Updated DS (1y+)",
  updated_af_1y: "Updated AF (1y+)",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function rewardedCoordKeys(breakdown: AdminAstrogationRewardBreakdownItem[]): Set<string> {
  return new Set(breakdown.map((b) => `${b.galx},${b.galy}`));
}

const PullResultCard: React.FC<{ result: AdminAstrogationPullResult }> = ({ result }) => {
  const { import: imp, reward, history } = result;
  const rewarded = reward?.breakdown ?? [];
  const rewardedKeys = rewardedCoordKeys(rewarded);

  // Areas that were created/updated but produced no reward entry
  const unrewardedAreas = (imp.areas as AdminAstrogationImportArea[]).filter(
    (a) => (a.action === "created" || a.action === "updated") && !rewardedKeys.has(`${a.galx},${a.galy}`)
  );

  return (
    <div className="rounded-[12px] border border-white/10 bg-black/20 p-4 flex flex-col gap-4">
      {/* Summary row */}
      <div className="flex flex-col gap-1.5">
        <p className="small m-0 font-semibold">{result.message}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="small text-white/50">Seen: <strong className="text-white">{history.events_seen.toLocaleString()}</strong></span>
          <span className="small text-white/50">Matched: <strong className="text-white">{history.events_matched.toLocaleString()}</strong></span>
          <span className="small text-white/50">Pages: <strong className="text-white">{history.pages}</strong></span>
          <span className={`small ${imp.created > 0 ? NEW_CLS : "text-white/30"}`}>+{imp.created} new</span>
          <span className={`small ${imp.updated > 0 ? UPDATED_CLS : "text-white/30"}`}>~{imp.updated} updated</span>
          <span className="small text-white/40">{imp.unchanged} unchanged</span>
          {imp.skipped > 0 && <span className="small text-white/30">{imp.skipped} skipped</span>}
        </div>
      </div>

      {/* Reward section */}
      {reward ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3 border-b border-white/[0.06] pb-2">
            <span className="small font-semibold text-[rgba(246,163,0,0.9)]">
              Reward: {reward.total_amount.toLocaleString()} credits
            </span>
            <span className="small text-white/50">
              {[
                reward.new_ds_count > 0 && `${reward.new_ds_count} new DS`,
                reward.new_af_count > 0 && `${reward.new_af_count} new AF`,
                reward.updated_ds_count > 0 && `${reward.updated_ds_count} updated DS 1y+`,
                reward.updated_af_count > 0 && `${reward.updated_af_count} updated AF 1y+`,
              ].filter(Boolean).join(" · ")}
            </span>
          </div>
          {rewarded.length > 0 && (
            <div className="flex flex-col gap-[2px] max-h-[220px] overflow-y-auto">
              {rewarded.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-[3px] rounded-[6px] hover:bg-white/[0.03] text-[0.82rem]">
                  <span className={`w-[110px] shrink-0 font-semibold ${item.reward_rule.startsWith("new") ? NEW_CLS : UPDATED_CLS}`}>
                    {RULE_LABELS[item.reward_rule] ?? item.reward_rule}
                  </span>
                  <span className="truncate flex-1 text-white/80">{item.square_name ?? `(${item.galx}, ${item.galy})`}</span>
                  <span className="text-white/40 shrink-0">({item.galx}, {item.galy})</span>
                  {item.has_asteroids && <span className={`shrink-0 ${ASTEROID_CLS}`}>★</span>}
                  <span className="text-[rgba(246,163,0,0.7)] shrink-0 w-[90px] text-right">
                    +{item.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (imp.created > 0 || imp.updated > 0) ? (
        <p className="small m-0 text-white/40">No reward generated (public tier or no payer configured).</p>
      ) : null}

      {/* Areas created/updated that didn't trigger a reward */}
      {unrewardedAreas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="small m-0 text-white/50 font-semibold">
            {unrewardedAreas.length} imported grid{unrewardedAreas.length !== 1 ? "s" : ""} without reward
          </p>
          <div className="flex flex-col gap-[2px] max-h-[160px] overflow-y-auto">
            {unrewardedAreas.map((area, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-[3px] rounded-[6px] hover:bg-white/[0.03] text-[0.82rem]">
                <span className={`w-[60px] shrink-0 ${area.action === "created" ? NEW_CLS : UPDATED_CLS}`}>
                  {area.action === "created" ? "created" : "updated"}
                </span>
                <span className="truncate flex-1 text-white/70">{area.square_name ?? `(${area.galx}, ${area.galy})`}</span>
                <span className="text-white/40 shrink-0">({area.galx}, {area.galy})</span>
                {area.has_asteroids && <span className={`shrink-0 ${ASTEROID_CLS}`}>★</span>}
                {area.action === "updated" && (
                  <span className="text-white/30 shrink-0 text-[0.78rem]" title="Previous record date — must be 1y+ old to qualify">
                    prev: {formatDate(area.previous_legacy_recorded_at)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminAstrogationUploadsPanel: React.FC = () => {
  const [rows, setRows] = useState<AdminAstrogationUploadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [page, setPage] = useState(1);
  const [handleFilter, setHandleFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [pendingHandle, setPendingHandle] = useState("");

  function applyFilters() {
    setHandleFilter(pendingHandle.trim());
    setPage(1);
  }

  function clearFilters() {
    setPendingHandle("");
    setHandleFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await listAdminAstrogationUploads({
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          handle: handleFilter || undefined,
          date_from: dateFromFilter || undefined,
          date_to: dateToFilter || undefined,
        });

        if (cancelled) return;

        setRows(response.data);
        setTotal(response.total);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setError(e?.message ?? "Failed to load astrogation upload logs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, handleFilter, dateFromFilter, dateToFilter]);

  function toggleExpanded(id: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // --- Pull for user ---
  const [allUsers, setAllUsers] = useState<AdminManageableUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [showUserMatches, setShowUserMatches] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminManageableUser | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<AdminAstrogationPullResult | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  useEffect(() => {
    listAdminUsers().then((r) => setAllUsers(r.users ?? [])).catch(() => {});
  }, []);

  const userMatches = userQuery.trim()
    ? allUsers
        .filter((u) => {
          const q = userQuery.toLowerCase();
          return (
            String(u.id).includes(q) ||
            (u.handle ?? "").toLowerCase().includes(q) ||
            (u.swc_handle ?? "").toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  function selectUser(u: AdminManageableUser) {
    setSelectedUser(u);
    setUserQuery(u.swc_handle ?? u.handle ?? `User #${u.id}`);
    setShowUserMatches(false);
    setPullResult(null);
    setPullError(null);
  }

  async function handlePull() {
    if (!selectedUser) return;
    setPulling(true);
    setPullResult(null);
    setPullError(null);
    try {
      const result = await pullAstrogationForUser(selectedUser.id);
      setPullResult(result);
      // refresh the log list to show the new entry
      setPage(1);
      setHandleFilter("");
      setPendingHandle("");
    } catch (e: any) {
      setPullError(e?.message ?? "Pull failed.");
    } finally {
      setPulling(false);
    }
  }

  const hasActiveFilters = !!(handleFilter || dateFromFilter || dateToFilter);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <h2 className="h2">Astrogation Upload Logs</h2>
        <p className="small">All member astrogation data uploads — new grids, updates, and skips.</p>
      </header>

      {/* Admin Pull Section */}
      <div className="rounded-[14px] border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-[0.25rem]">
          <h3 className="m-0 text-[1rem] font-semibold">Pull Events for Member</h3>
          <p className="small m-0 text-white/60">Fetch all SWC astrogation events for a member, import them, and run the reward logic.</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 relative flex-[1_1_240px] min-w-[200px]">
            <label className="small" htmlFor="pull-user-search">Member</label>
            <input
              id="pull-user-search"
              className={INPUT}
              type="text"
              value={userQuery}
              placeholder="Search by handle or ID…"
              autoComplete="off"
              onChange={(e) => {
                setUserQuery(e.target.value);
                setSelectedUser(null);
                setShowUserMatches(true);
                setPullResult(null);
                setPullError(null);
              }}
              onFocus={() => setShowUserMatches(true)}
              onBlur={() => setTimeout(() => setShowUserMatches(false), 150)}
            />
            {showUserMatches && userMatches.length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-10 rounded-[12px] border border-white/10 bg-[rgba(12,16,20,0.97)] shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">
                {userMatches.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="flex items-center gap-2 px-3 py-2 text-left text-[0.88rem] hover:bg-white/[0.07] border-b border-white/5 last:border-b-0 font-tektur"
                    onMouseDown={(e) => { e.preventDefault(); selectUser(u); }}
                  >
                    <span className="font-semibold">{u.swc_handle ?? u.handle ?? `User #${u.id}`}</span>
                    <span className="text-white/40 text-[0.8rem]">#{u.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`font-tektur${BTN_SM} ${BTN_PRIMARY}`}
            onClick={handlePull}
            disabled={!selectedUser || pulling}
          >
            {pulling ? "Pulling…" : "Pull Events"}
          </button>
        </div>

        {pullError && (
          <p className="small m-0" style={{ color: "salmon" }}>{pullError}</p>
        )}

        {pullResult && (
          <PullResultCard result={pullResult} />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <div className="flex flex-col gap-1">
            <label className="small" htmlFor="astro-handle-filter">Handle</label>
            <input
              id="astro-handle-filter"
              className={INPUT}
              type="text"
              value={pendingHandle}
              onChange={(e) => setPendingHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Search by handle…"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="small" htmlFor="astro-date-from">From date</label>
            <input
              id="astro-date-from"
              className={INPUT}
              type="date"
              value={dateFromFilter}
              onChange={(e) => { setDateFromFilter(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="small" htmlFor="astro-date-to">To date</label>
            <input
              id="astro-date-to"
              className={INPUT}
              type="date"
              value={dateToFilter}
              onChange={(e) => { setDateToFilter(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="small">
            {loading ? "Loading…" : `${total.toLocaleString()} total upload${total === 1 ? "" : "s"}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`font-tektur${BTN_SM} ${BTN_SOFT}`}
              onClick={clearFilters}
              disabled={!hasActiveFilters && !pendingHandle}
            >
              Clear filters
            </button>
            <button
              type="button"
              className={`font-tektur${BTN_SM} ${BTN_PRIMARY}`}
              onClick={applyFilters}
              disabled={loading}
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="small" style={{ color: "salmon" }}>{error}</p>
      ) : rows.length === 0 && !loading ? (
        <p className="small">No upload logs found.</p>
      ) : (
        <>
          <div className="flex flex-col overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.02] max-[900px]:overflow-x-auto">
            <div className="grid min-w-[700px] border-b border-white/10 bg-white/[0.04] px-3.5 py-2 text-[0.82rem] font-semibold text-white/60 [grid-template-columns:160px_130px_80px_80px_80px_80px_80px_1fr]">
              <div>When</div>
              <div>Handle</div>
              <div>Seen</div>
              <div>Matched</div>
              <div className={NEW_CLS}>New</div>
              <div className={UPDATED_CLS}>Updated</div>
              <div>Unchanged</div>
              <div></div>
            </div>

            <div className="flex min-w-[700px] flex-col">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse border-t border-white/5 bg-white/[0.01] first:border-t-0" />
                  ))
                : rows.map((row) => {
                    const expanded = expandedIds.has(row.id);
                    const hasDetail = row.events_seen > 0 || row.areas.length > 0 || (row.reward_breakdown?.length ?? 0) > 0;
                    const rewardedKeys = new Set((row.reward_breakdown ?? []).map((b) => `${b.galx},${b.galy}`));
                    const unrewardedAreas = row.areas.filter(
                      (a) => (a.action === "created" || a.action === "updated") && !rewardedKeys.has(`${a.galx},${a.galy}`)
                    );
                    return (
                      <div key={row.id} className="flex flex-col border-t border-white/5 first:border-t-0">
                        <div className="grid min-h-12 items-center px-3.5 py-2 text-[0.88rem] [grid-template-columns:160px_130px_80px_80px_80px_80px_80px_1fr] hover:bg-white/[0.025]">
                          <div className="text-[0.8rem] text-white/60">{formatDateTime(row.created_at)}</div>
                          <div className="font-semibold truncate">{row.handle ?? `User #${row.user_id}`}</div>
                          <div className="text-white/70">{row.events_seen.toLocaleString()}</div>
                          <div className="text-white/70">{row.events_matched.toLocaleString()}</div>
                          <div className={row.created > 0 ? NEW_CLS : "text-white/40"}>{row.created.toLocaleString()}</div>
                          <div className={row.updated > 0 ? UPDATED_CLS : "text-white/40"}>{row.updated.toLocaleString()}</div>
                          <div className="text-white/50">{row.unchanged.toLocaleString()}</div>
                          <div className="flex justify-end">
                            {hasDetail && (
                              <button
                                type="button"
                                className={`font-tektur${BTN_SM} ${BTN_PRIMARY} !min-h-[28px] !py-1 !text-[0.8rem]`}
                                onClick={() => toggleExpanded(row.id)}
                              >
                                {expanded ? "Hide" : "Detail"}
                              </button>
                            )}
                          </div>
                        </div>

                        {expanded && hasDetail && (
                          <div className="border-t border-white/5 bg-black/15 px-4 pb-3 pt-2 flex flex-col gap-3">

                            {/* All unchanged — no grid changes */}
                            {row.areas.length === 0 && (row.reward_breakdown === null || row.reward_breakdown.length === 0) && (
                              <p className="small m-0 text-white/40">
                                {row.events_matched > 0
                                  ? `${row.events_matched} matched grid${row.events_matched !== 1 ? "s" : ""} were all already up to date — no changes made.`
                                  : "No matching travel events found in this pull."}
                              </p>
                            )}

                            {/* Reward breakdown */}
                            {(row.reward_breakdown?.length ?? 0) > 0 && (
                              <div className="flex flex-col gap-1">
                                <p className="small m-0 font-semibold text-[rgba(246,163,0,0.9)]">
                                  Rewarded grids — {row.reward_breakdown!.reduce((s, b) => s + b.amount, 0).toLocaleString()} credits
                                </p>
                                <div className="flex flex-col gap-[2px] max-h-[180px] overflow-y-auto">
                                  {row.reward_breakdown!.map((b, i) => (
                                    <div key={i} className="flex items-center gap-3 text-[0.82rem]">
                                      <span className={`w-[110px] shrink-0 font-semibold ${b.reward_rule.startsWith("new") ? NEW_CLS : UPDATED_CLS}`}>
                                        {RULE_LABELS[b.reward_rule] ?? b.reward_rule}
                                      </span>
                                      <span className="truncate flex-1 text-white/80">{b.square_name ?? `(${b.galx}, ${b.galy})`}</span>
                                      <span className="text-white/40 shrink-0">({b.galx}, {b.galy})</span>
                                      {b.has_asteroids && <span className={`shrink-0 ${ASTEROID_CLS}`}>★</span>}
                                      <span className="text-[rgba(246,163,0,0.7)] shrink-0 w-[90px] text-right">+{b.amount.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Imported areas without reward */}
                            {unrewardedAreas.length > 0 && (
                              <div className="flex flex-col gap-1">
                                <p className="small m-0 text-white/50 font-semibold">
                                  {unrewardedAreas.length} imported without reward
                                </p>
                                <ul className="list-none m-0 p-0 flex flex-col gap-[2px] max-h-[160px] overflow-y-auto">
                                  {unrewardedAreas.map((area, i) => (
                                    <li key={i} className="small flex items-center gap-2">
                                      <span className={`w-4 font-bold ${area.action === "created" ? NEW_CLS : UPDATED_CLS}`}>
                                        {area.action === "created" ? "+" : "~"}
                                      </span>
                                      <span className="truncate flex-1">{area.square_name ?? `(${area.galx}, ${area.galy})`}</span>
                                      <span className="text-white/40">({area.galx}, {area.galy})</span>
                                      {area.has_asteroids && <span className={ASTEROID_CLS}>★</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Areas with no reward info at all (pre-migration logs) */}
                            {row.reward_breakdown === null && row.areas.length > 0 && (
                              <div className="flex flex-col gap-1">
                                <p className="small m-0 text-white/40">Reward data not recorded for this upload.</p>
                                <ul className="list-none m-0 p-0 flex flex-col gap-[2px] max-h-[160px] overflow-y-auto">
                                  {row.areas.map((area, i) => (
                                    <li key={i} className="small flex items-center gap-2">
                                      <span className={`w-4 font-bold ${area.action === "created" ? NEW_CLS : UPDATED_CLS}`}>
                                        {area.action === "created" ? "+" : "~"}
                                      </span>
                                      <span className="truncate flex-1">{area.square_name ?? `(${area.galx}, ${area.galy})`}</span>
                                      <span className="text-white/40">({area.galx}, {area.galy})</span>
                                      {area.has_asteroids && <span className={ASTEROID_CLS}>★</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>
          </div>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={total}
            pageSizeOptions={[PAGE_SIZE]}
            onPageChange={setPage}
            onPageSizeChange={() => {}}
          />
        </>
      )}
    </section>
  );
};

export default AdminAstrogationUploadsPanel;
