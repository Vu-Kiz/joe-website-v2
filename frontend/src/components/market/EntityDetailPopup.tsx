import React, { useEffect, useState } from "react";
import { getEntityDetail } from "../../api/market/market";
import type { EntityDetail } from "../../api/market/market";
import { BTN } from "../../utils/ui";

type Props = {
  entityType: string;
  entityUid: string;
  entityName: string;
  snapshot?: EntityDetail | null;
  overrideImageUrl?: string | null;
  hideOwner?: boolean;
  onClose: () => void;
  onSelect?: () => void;
  selectLabel?: string;
};

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  if (max <= 0) return null;
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="small muted">{label}</span>
        <span className="small" style={{ color }}>{value} / {max}</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 5, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function hullColor(value: number, max: number) {
  const pct = max > 0 ? value / max : 1;
  return pct > 0.66 ? "#4ade80" : pct > 0.33 ? "#facc15" : "#f87171";
}

function LocationBlock({ loc }: { loc: EntityDetail["location"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      {loc.docked && loc.container && (
        <span className="small">Docked in <strong>{loc.container.name}</strong> ({loc.container.type})</span>
      )}
      {loc.sector && <span className="small muted">Sector: {loc.sector}</span>}
      {loc.system && <span className="small muted">System: {loc.system}</span>}
      {loc.galx != null && loc.galy != null && <span className="small muted">Galaxy: ({loc.galx}, {loc.galy})</span>}
      {loc.sysx != null && loc.sysy != null && <span className="small muted">Position: ({loc.sysx}, {loc.sysy})</span>}
    </div>
  );
}

const EntityDetailPopup: React.FC<Props> = ({
  entityType,
  entityUid,
  entityName,
  snapshot,
  overrideImageUrl,
  hideOwner = false,
  onClose,
  onSelect,
  selectLabel = "Select",
}) => {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<EntityDetail | null>(snapshot ?? null);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getEntityDetail(entityType, entityUid)
      .then((res) => {
        if (!cancelled) { setDetail(res.data); setRaw(res.raw); }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load entity details.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityUid]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65" onClick={onClose}>
      <div
        className="relative flex flex-col gap-4 w-[calc(100vw-2rem)] max-w-[480px] max-h-[90vh] overflow-y-auto p-5 rounded-[12px] border border-white/[0.12] bg-[#1a1c22] shadow-[0_24px_64px_rgba(0,0,0,0.6)] max-[480px]:w-[calc(100vw-1rem)] max-[480px]:p-[0.85rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-3 top-3 bg-white/[0.06] hover:bg-white/10 hover:text-white/90 border-0 rounded-[6px] text-white/50 text-[0.85rem] px-2 py-1 cursor-pointer font-tektur"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >✕</button>

        <div className="flex items-start gap-4 pr-8">
          {(overrideImageUrl ?? detail?.image_url) && (
            <div className="shrink-0 w-20 h-20 rounded-[8px] border border-white/[0.08] bg-white/[0.04] overflow-hidden">
              <img
                className="w-full h-full object-contain"
                src={overrideImageUrl ?? detail?.image_url ?? ""}
                alt={detail?.type_name ?? entityType}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <div className="flex flex-col gap-[0.2rem] min-w-0">
            <p className="m-0 text-[1rem] font-semibold leading-[1.3] break-words">{detail?.name ?? entityName}</p>
            {detail?.type_name && <p className="small muted" style={{ margin: 0 }}>{detail.type_name}</p>}
            <p className="small muted" style={{ margin: 0, fontFamily: "monospace" }}>{entityUid}</p>
            {detail?.wrecked && <p className="small" style={{ margin: 0, color: "#f87171" }}>⚠ Wrecked</p>}
          </div>
        </div>

        {loading && <p className="small opacity-60" style={{ margin: "0.5rem 0" }}>Loading details…</p>}
        {error && <p className="small" style={{ color: "#f87171", margin: "0.5rem 0" }}>{error}</p>}

        {!loading && detail && (
          <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
            {detail.hull != null && detail.max_hull != null && (
              <StatBar label="Hull" value={detail.hull} max={detail.max_hull} color={hullColor(detail.hull, detail.max_hull)} />
            )}
            {detail.shield != null && detail.max_shield != null && detail.max_shield > 0 && (
              <StatBar label="Shields" value={detail.shield} max={detail.max_shield} color="#60a5fa" />
            )}
            {detail.ionic != null && detail.max_ionic != null && detail.max_ionic > 0 && (
              <StatBar label="Ionic" value={detail.ionic} max={detail.max_ionic} color="#a78bfa" />
            )}
            <div className="flex items-baseline gap-2 justify-between" style={{ alignItems: "flex-start" }}>
              <span className="small muted" style={{ flexShrink: 0 }}>Location</span>
              <div style={{ textAlign: "right" }}><LocationBlock loc={detail.location} /></div>
            </div>
            {detail.owner && !hideOwner && (
              <div className="flex items-baseline gap-2 justify-between">
                <span className="small muted">Owner</span>
                <span className="small">{detail.owner.name}</span>
              </div>
            )}
            {detail.cargo && (detail.cargo.weight_total ?? 0) > 0 && (
              <div className="flex items-baseline gap-2 justify-between">
                <span className="small muted">Cargo</span>
                <span className="small">
                  {detail.cargo.weight_remaining?.toLocaleString()} / {detail.cargo.weight_total?.toLocaleString()} T
                  {" · "}
                  {detail.cargo.volume_remaining?.toLocaleString()} / {detail.cargo.volume_total?.toLocaleString()} m³
                </span>
              </div>
            )}
          </div>
        )}

        {!loading && raw && (
          <details style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "0.75rem" }}>
            <summary className="small muted" style={{ cursor: "pointer" }}>Raw API response</summary>
            <pre style={{ fontSize: "0.65rem", overflowX: "auto", color: "rgba(255,255,255,0.5)", marginTop: "0.5rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(raw, null, 2)}
            </pre>
          </details>
        )}

        {onSelect && (
          <div className="border-t border-white/[0.07] pt-3">
            <button className={BTN} type="button" onClick={() => { onSelect(); onClose(); }}>{selectLabel}</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityDetailPopup;
