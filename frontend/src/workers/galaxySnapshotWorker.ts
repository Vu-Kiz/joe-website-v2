type SectorSearchRecord = Record<string, unknown> & {
  id?: number | null;
  galx?: number | null;
  galy?: number | null;
};

type SectorCellAnnotation = Record<string, unknown> & {
  id?: number | null;
  sector_uid?: string | null;
  galx?: number | null;
  galy?: number | null;
};

type StoredMapSystem = Record<string, unknown> & {
  uid?: string | null;
  identifier?: string | null;
  sector_uid?: string | null;
  galx?: number | null;
  galy?: number | null;
  name?: string | null;
};

export type GalaxyWorkerInbound =
  | { type: "load"; requestId: number; apiBase: string }
  | { type: "cancel" };

export type GalaxyWorkerOutbound =
  | {
      type: "result";
      requestId: number;
      revision: string;
      systems: StoredMapSystem[];
      searchRecords: SectorSearchRecord[];
      annotationsBySector: Record<string, SectorCellAnnotation[]>;
    }
  | { type: "error"; requestId: number; message: string; status?: number };

let currentRequestId: number | null = null;

function dedupeByKey<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function systemKey(s: StoredMapSystem): string {
  return String(
    s.uid ?? s.identifier ?? `${s.sector_uid ?? ""}:${s.galx ?? "?"}:${s.galy ?? "?"}:${s.name ?? ""}`
  );
}

function recordKey(r: SectorSearchRecord): string {
  return String(r.id ?? `${r.galx ?? "?"}:${r.galy ?? "?"}`);
}

async function fetchLayer(url: string): Promise<unknown[]> {
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json as { data?: unknown[] })?.data ?? [];
}

async function doLoad(requestId: number, apiBase: string): Promise<void> {
  const base = apiBase.replace(/\/+$/, "");

  const metaRes = await fetch(`${base}/universe/galaxy-snapshot/meta`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (currentRequestId !== requestId) return;

  if (!metaRes.ok) {
    self.postMessage({
      type: "error",
      requestId,
      message: "Failed to fetch galaxy snapshot meta.",
      status: metaRes.status,
    } as GalaxyWorkerOutbound);
    return;
  }

  const metaJson = await metaRes.json();
  if (currentRequestId !== requestId) return;

  const meta = (metaJson as { data?: { revision?: string; layers?: Array<{ name: string; available: boolean }> } })?.data;
  const revision = meta?.revision ?? "none";
  const available = new Set((meta?.layers ?? []).filter((l) => l.available).map((l) => l.name));

  const [systems, scans, asteroids, ships, stations, notes] = await Promise.all([
    fetchLayer(`${base}/universe/galaxy-snapshot/layer/systems`),
    available.has("scans") ? fetchLayer(`${base}/universe/galaxy-snapshot/layer/scans`) : Promise.resolve([]),
    available.has("asteroids") ? fetchLayer(`${base}/universe/galaxy-snapshot/layer/asteroids`) : Promise.resolve([]),
    available.has("ships") ? fetchLayer(`${base}/universe/galaxy-snapshot/layer/ships`) : Promise.resolve([]),
    available.has("stations") ? fetchLayer(`${base}/universe/galaxy-snapshot/layer/stations`) : Promise.resolve([]),
    available.has("notes") ? fetchLayer(`${base}/universe/galaxy-snapshot/layer/notes`) : Promise.resolve([]),
  ]);

  if (currentRequestId !== requestId) return;

  const dedupedSystems = dedupeByKey(systems as StoredMapSystem[], systemKey);

  const dedupedRecords = dedupeByKey(
    [
      ...(scans as SectorSearchRecord[]),
      ...(asteroids as SectorSearchRecord[]),
      ...(ships as SectorSearchRecord[]),
      ...(stations as SectorSearchRecord[]),
    ],
    recordKey
  );

  const annotationsBySector = (notes as SectorCellAnnotation[]).reduce<Record<string, SectorCellAnnotation[]>>(
    (acc, annotation) => {
      const sectorUid = annotation.sector_uid ?? "";
      if (!sectorUid) return acc;
      acc[sectorUid] = (acc[sectorUid] ?? []).concat(annotation);
      return acc;
    },
    {}
  );

  if (currentRequestId !== requestId) return;

  self.postMessage({
    type: "result",
    requestId,
    revision,
    systems: dedupedSystems,
    searchRecords: dedupedRecords,
    annotationsBySector,
  } as GalaxyWorkerOutbound);
}

self.onmessage = (event: MessageEvent<GalaxyWorkerInbound>) => {
  const msg = event.data;

  if (msg.type === "cancel") {
    currentRequestId = null;
    return;
  }

  if (msg.type === "load") {
    currentRequestId = msg.requestId;
    doLoad(msg.requestId, msg.apiBase).catch((e: unknown) => {
      if (currentRequestId === msg.requestId) {
        self.postMessage({
          type: "error",
          requestId: msg.requestId,
          message: String((e as Error)?.message ?? "Unknown worker error"),
        } as GalaxyWorkerOutbound);
      }
    });
  }
};
