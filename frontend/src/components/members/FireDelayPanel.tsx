import React, { useEffect, useState, useCallback } from "react";
import { getFireDelays, getFireDelaySettings, updateFireDelaySettings, type FireDelayShip } from "../../api/member/fireDelay";
import ReportBugButton from "../support/ReportBugButton";
import { BTN_SM, INPUT } from "../../utils/ui";

const FIRE_DELAY = 1800;

function formatCountdown(remaining: number): string {
  if (remaining <= 0) return "Ready";
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function readyBadge(remaining: number) {
  if (remaining <= 0) return "text-green-400 border-green-400/40 bg-green-400/10";
  if (remaining < 300) return "text-amber-300 border-amber-400/40 bg-amber-400/10";
  return "text-red-400 border-red-400/40 bg-red-400/10";
}

function ShipRow({ ship, now }: { ship: FireDelayShip; now: number }) {
  const remaining = Math.max(0, ship.next_fire_at - now);
  const pct = Math.min(100, Math.max(0, ((FIRE_DELAY - remaining) / FIRE_DELAY) * 100));

  return (
    <div className="grid gap-[0.3rem] p-3 rounded-[10px] border border-white/8 bg-white/3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="m-0 font-semibold text-[0.88rem] truncate">{ship.name ?? ship.uid}</p>
          {ship.type_name && <p className="m-0 text-[0.72rem] opacity-50 truncate">{ship.type_name}</p>}
          {ship.owner_name && <p className="m-0 text-[0.72rem] opacity-40 truncate">{ship.owner_name}</p>}
          {ship.galx != null && ship.galy != null && (
            <p className="m-0 text-[0.68rem] opacity-30">{ship.galx}, {ship.galy}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`inline-block text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${readyBadge(remaining)}`}>
            {formatCountdown(remaining)}
          </span>
          <span className="text-[0.65rem] opacity-30">Fired {formatTimestamp(ship.fired_at)}</span>
        </div>
      </div>
      <div className="h-[3px] rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${remaining <= 0 ? "bg-green-500" : remaining < 300 ? "bg-amber-400" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const FireDelayPanel: React.FC<{ isSysadmin?: boolean }> = ({ isSysadmin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ships, setShips] = useState<FireDelayShip[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [factionUid, setFactionUid] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [tab, setTab] = useState<"ours" | "raid">("raid");

  const [settingsFactionUid, setSettingsFactionUid] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFireDelays();
      setShips(res.data.ships);
      setFetchedAt(res.data.fetched_at);
      setFactionUid(res.data.faction_uid ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch fire delays.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (isSysadmin) {
      getFireDelaySettings().then((r) => setSettingsFactionUid(String(r.data.faction_uid))).catch(() => {});
    }
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load, isSysadmin]);

  async function handleSaveSettings() {
    const uid = parseInt(settingsFactionUid, 10);
    if (!uid || uid < 1) return;
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      await updateFireDelaySettings(uid);
      setSettingsMsg("Saved.");
      load();
    } catch (e: any) {
      setSettingsMsg(`Error: ${e?.message ?? "Failed to save."}`);
    } finally {
      setSettingsSaving(false);
    }
  }

  const ourShips = ships.filter(
    (s) => s.public_status === "Friend" || (!s.public_status && s.in_droidbrain)
  );
  const raidShips = ships.filter(
    (s) => s.public_status === "Enemy" || s.public_status === "Neutral" || (!s.public_status && !s.in_droidbrain)
  );
  const displayed = tab === "ours" ? ourShips : raidShips;
  const readyCount = displayed.filter((s) => Math.max(0, s.next_fire_at - now) === 0).length;
  const coolingCount = displayed.length - readyCount;

  return (
    <div className="panel grid gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[1.4rem] font-semibold m-0">Fire Delay Tracker</h1>
          <p className="small opacity-60 m-0">
            Live fire delay status for ships active in combat. All weapons share a fixed 30-minute cooldown.
            {factionUid ? <span className="ml-2 opacity-40">Faction {factionUid}</span> : null}
          </p>
        </div>
        <ReportBugButton toolKey="fire_delay_tracker" toolLabel="Fire Delay Tracker" />
      </div>

      {isSysadmin && (
        <div className="grid gap-2 p-3 rounded-[10px] border border-white/8 bg-white/3">
          <p className="text-[0.72rem] font-bold uppercase tracking-wider opacity-50 m-0">Sysadmin — Combat Faction</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className={INPUT + " w-36"}
              type="number"
              min="1"
              placeholder="SWC faction UID"
              value={settingsFactionUid}
              onChange={(e) => setSettingsFactionUid(e.target.value)}
            />
            <button type="button" className={BTN_SM} onClick={handleSaveSettings} disabled={settingsSaving}>
              {settingsSaving ? "Saving…" : "Save"}
            </button>
            {settingsMsg && <span className="text-[0.72rem] opacity-60">{settingsMsg}</span>}
          </div>
          <p className="text-[0.68rem] opacity-40 m-0">
            Default: 1796 (JOE RAID). Change during ops run from another faction. Service account is set via Admin → Users (<code>is_combat_ops_service_account</code>).
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" className={BTN_SM + (tab === "raid" ? " active" : "")} onClick={() => setTab("raid")}>
          Raid Ships {raidShips.length > 0 ? `(${raidShips.length})` : ""}
        </button>
        <button type="button" className={BTN_SM + (tab === "ours" ? " active" : "")} onClick={() => setTab("ours")}>
          Our Ships {ourShips.length > 0 ? `(${ourShips.length})` : ""}
        </button>
        <button type="button" className={BTN_SM} onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
        {fetchedAt && <span className="text-[0.72rem] opacity-40">Fetched {formatTimestamp(fetchedAt)}</span>}
      </div>

      {error ? <p className="small m-0" style={{ color: "salmon" }}>{error}</p> : null}

      {!loading && ships.length === 0 && !error ? (
        <p className="small m-0 opacity-50">
          No combat events in the last 2 hours. Ships appear here when they fire in SWC.
        </p>
      ) : null}

      {displayed.length > 0 ? (
        <>
          <div className="flex gap-3 flex-wrap">
            <span className="text-[0.72rem] font-bold text-green-400">{readyCount} Ready</span>
            <span className="text-[0.72rem] font-bold text-red-400">{coolingCount} Cooling down</span>
          </div>
          <div className="grid gap-2">
            {displayed.map((ship) => (
              <ShipRow key={ship.uid} ship={ship} now={now} />
            ))}
          </div>
        </>
      ) : !loading ? (
        <p className="small m-0 opacity-50">
          No {tab === "ours" ? "friendly" : "enemy"} ships with recent fire events.
        </p>
      ) : null}
    </div>
  );
};

export default FireDelayPanel;
