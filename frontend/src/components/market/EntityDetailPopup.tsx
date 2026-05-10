import React, { useEffect, useState } from "react";
import { getEntityDetail } from "../../api/market";
import type { EntityDetail } from "../../api/market";

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
      {loc.sector && (
        <span className="small muted">Sector: {loc.sector}</span>
      )}
      {loc.system && (
        <span className="small muted">System: {loc.system}</span>
      )}
      {loc.galx != null && loc.galy != null && (
        <span className="small muted">Galaxy: ({loc.galx}, {loc.galy})</span>
      )}
      {loc.sysx != null && loc.sysy != null && (
        <span className="small muted">Position: ({loc.sysx}, {loc.sysy})</span>
      )}
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
  const [loading, setLoading] = useState(!snapshot);
  const [detail, setDetail] = useState<EntityDetail | null>(snapshot ?? null);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (snapshot) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getEntityDetail(entityType, entityUid)
      .then((res) => {
        if (!cancelled) {
          setDetail(res.data);
          setRaw(res.raw);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load entity details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [entityType, entityUid]);

  return (
    <div className="entity-popup-backdrop" onClick={onClose}>
      <div className="entity-popup" onClick={(e) => e.stopPropagation()}>
        <button className="entity-popup__close" type="button" onClick={onClose} aria-label="Close">✕</button>

        <div className="entity-popup__header">
          {(overrideImageUrl ?? detail?.image_url) && (
            <div className="entity-popup__image-wrap">
              <img
                className="entity-popup__image"
                src={overrideImageUrl ?? detail?.image_url ?? ""}
                alt={detail?.type_name ?? entityType}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <div className="entity-popup__title-block">
            <p className="entity-popup__name">{detail?.name ?? entityName}</p>
            {detail?.type_name && <p className="small muted" style={{ margin: 0 }}>{detail.type_name}</p>}
            <p className="small muted" style={{ margin: 0, fontFamily: "monospace" }}>{entityUid}</p>
            {detail?.wrecked && <p className="small" style={{ margin: 0, color: "#f87171" }}>⚠ Wrecked</p>}
          </div>
        </div>

        {loading && <p className="market-empty" style={{ margin: "0.5rem 0" }}>Loading details…</p>}
        {error && <p className="small" style={{ color: "#f87171", margin: "0.5rem 0" }}>{error}</p>}

        {!loading && detail && (
          <div className="entity-popup__body">
            {/* Hull / shield / ionic */}
            {detail.hull != null && detail.max_hull != null && (
              <StatBar label="Hull" value={detail.hull} max={detail.max_hull} color={hullColor(detail.hull, detail.max_hull)} />
            )}
            {detail.shield != null && detail.max_shield != null && detail.max_shield > 0 && (
              <StatBar label="Shields" value={detail.shield} max={detail.max_shield} color="#60a5fa" />
            )}
            {detail.ionic != null && detail.max_ionic != null && detail.max_ionic > 0 && (
              <StatBar label="Ionic" value={detail.ionic} max={detail.max_ionic} color="#a78bfa" />
            )}

            {/* Location */}
            <div className="entity-popup__row" style={{ alignItems: "flex-start" }}>
              <span className="small muted" style={{ flexShrink: 0 }}>Location</span>
              <div style={{ textAlign: "right" }}>
                <LocationBlock loc={detail.location} />
              </div>
            </div>

            {/* Owner */}
            {detail.owner && !hideOwner && (
              <div className="entity-popup__row">
                <span className="small muted">Owner</span>
                <span className="small">{detail.owner.name}</span>
              </div>
            )}

            {/* Cargo */}
            {detail.cargo && (detail.cargo.weight_total ?? 0) > 0 && (
              <div className="entity-popup__row">
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
          <div className="entity-popup__footer">
            <button className="btn" type="button" onClick={() => { onSelect(); onClose(); }}>
              {selectLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityDetailPopup;
