import React, { useEffect, useMemo, useState } from "react";
import BBCodeView from "../bbcode/BBCodeView";
import { listTenets, type TenetOfSalvage } from "../../api/content/tenets";
import { getCgtTime } from "../../api/core/time";
import tenetsBanner from "../../assets/home/SalvageBanner.png";

type CgtSeed = {
  year: number;
  day: number;
};

const hashString = (value: string): number => {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
};

const getSeedOverride = (): string | null => {
  const params = new URLSearchParams(window.location.search);

  const forcedSeed = params.get("tenetSeed")?.trim();
  if (forcedSeed) {
    return `forced:${forcedSeed}`;
  }

  if (params.get("tenetRefresh") === "1") {
    return `refresh:${Date.now()}`;
  }

  return null;
};

const TenetsOfSalvagePanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TenetOfSalvage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cgtSeed, setCgtSeed] = useState<CgtSeed | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [tenetsRes, timeRes] = await Promise.all([
          listTenets(),
          getCgtTime(),
        ]);

        if (cancelled) return;

        setItems(tenetsRes.items ?? []);
        setCgtSeed({
          year: timeRes.cgt.year,
          day: timeRes.cgt.day,
        });
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load Tenets of Salvage");
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

  const chosen = useMemo(() => {
    if (!items.length) return null;
    if (!cgtSeed) return null;

    const highestWeight = Math.max(...items.map((x) => x.weight));
    const pool = items.filter((x) => x.weight === highestWeight);

    if (!pool.length) return items[0] ?? null;

    const overrideSeed = getSeedOverride();
    const baseSeed = overrideSeed ?? `cgt:${cgtSeed.year}-${cgtSeed.day}`;
    const index = hashString(baseSeed) % pool.length;

    return pool[index] ?? pool[0];
  }, [items, cgtSeed]);

  return (
    <section className="panel">
      <div className="panel-banner">
        <img src={tenetsBanner} alt="Tenets of Salvage" />
      </div>

      {loading && <p className="small">Consulting the salvage codex…</p>}
      {!loading && error && <p className="small">{error}</p>}
      {!loading && !error && !chosen && (
        <p className="small">No tenets have been recorded yet.</p>
      )}

      {!loading && !error && chosen && (
        <div className="flex flex-col gap-3 text-center items-center">
          <h3 className="m-0 text-[var(--jen-orange)] text-center">{chosen.title}</h3>
          <BBCodeView value={chosen.body_bbcode} className="text-[0.9rem] leading-[1.2] text-center" />
        </div>
      )}
    </section>
  );
};

export default TenetsOfSalvagePanel;
