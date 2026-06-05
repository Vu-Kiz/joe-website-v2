import { useEffect, useState } from "react";
import { SELECT_INPUT } from "../../utils/ui";
import {
  getShipSnapshots,
  getShipSnapshotDetail,
  type ShipSnapshot,
  type SnapshotShip,
} from "../../api/universe/universe";

type Props = {
  galx: number;
  galy: number;
  /** Called with null = "latest", or a full snapshot ship list */
  onSnapshot: (ships: SnapshotShip[] | null, snapshotTime: number | null) => void;
};

export default function ShipSnapshotSelector({ galx, galy, onSnapshot }: Props) {
  const [snapshots, setSnapshots] = useState<ShipSnapshot[]>([]);
  const [selected, setSelected] = useState<string>("latest");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSnapshots([]);
    setSelected("latest");
    onSnapshot(null, null);
    getShipSnapshots(galx, galy)
      .then((res) => setSnapshots(res.data ?? []))
      .catch(() => {});
  }, [galx, galy]);

  function handleChange(value: string) {
    setSelected(value);
    if (value === "latest") {
      onSnapshot(null, null);
      return;
    }
    const ts = parseInt(value, 10);
    setLoading(true);
    getShipSnapshotDetail(ts, galx, galy)
      .then((res) => onSnapshot(res.data ?? [], ts))
      .catch(() => onSnapshot([], ts))
      .finally(() => setLoading(false));
  }

  if (snapshots.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="text-[0.7rem] font-semibold opacity-50 uppercase tracking-wide shrink-0">
        Snapshot
      </label>
      <select
        className={SELECT_INPUT + " text-xs py-1 min-h-0"}
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
      >
        <option value="latest">Latest</option>
        {snapshots.map((s) => (
          <option key={s.snapshot_unixtime} value={String(s.snapshot_unixtime)}>
            {s.cgt_formatted} · {s.ship_count} ships
          </option>
        ))}
      </select>
      {loading && <span className="text-xs opacity-40">Loading…</span>}
    </div>
  );
}
