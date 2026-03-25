import { apiFetch } from "./auth";

export type StoredSectorSummary = {
  id: number;
  uid: string;
  name: string | null;
  owner_uid: string | null;
  owner_name: string | null;
  population: number | null;
  known_systems: number | null;
  coordinate_count: number | null;
  system_count: number | null;
  color_r: number | null;
  color_g: number | null;
  color_b: number | null;
  color_hex: string | null;
  outline_coordinates: Array<{ galx: number; galy: number }>;
  bounds: {
    min_galx: number;
    max_galx: number;
    min_galy: number;
    max_galy: number;
    width: number;
    height: number;
  } | null;
  last_pulled_at: string | null;
};

export type StoredMapSystem = {
  uid: string | null;
  identifier: string | null;
  name: string | null;
  sector_uid: string | null;
  sector_name: string | null;
  galx: number | null;
  galy: number | null;
  last_pulled_at: string | null;
};

export type StoredSectorDetail = {
  resource: "sector";
  identifier: string;
  sector: {
    uid: string;
    name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    population: number | null;
    known_systems: number | null;
    coordinate_count: number | null;
    system_count: number | null;
    color_r: number | null;
    color_g: number | null;
    color_b: number | null;
    color_hex: string | null;
  };
  outline_coordinates: Array<{ galx: number; galy: number }>;
  coordinates: Array<{ galx: number; galy: number }>;
  bounds: {
    min_galx: number;
    max_galx: number;
    min_galy: number;
    max_galy: number;
    width: number;
    height: number;
  } | null;
  systems: Array<{
    uid: string | null;
    identifier: string | null;
    name: string | null;
    sector_uid: string | null;
    sector_name: string | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
    last_pulled_at: string | null;
  }>;
  annotations: Array<{
    id: number;
    sector_uid: string;
    galx: number;
    galy: number;
    marker_type: string | null;
    label: string | null;
    notes: string | null;
    updated_at: string | null;
  }>;
};

export type SectorCellAnnotation = {
  id?: number;
  sector_uid: string;
  galx: number;
  galy: number;
  marker_type: string | null;
  label: string | null;
  notes: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type StoredSystemDetail = {
  resource: "system";
  identifier: string;
  system: {
    uid: string | null;
    identifier: string | null;
    name: string | null;
    sector_uid: string | null;
    sector_name: string | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
    last_pulled_at: string | null;
  };
  planets: Array<{
    uid: string | null;
    identifier: string | null;
    name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    size: number | null;
    population: number | null;
    previous_population: number | null;
    previous_population_recorded_at: string | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
    terrain_map: string | null;
    surface_bounds: {
      width?: number | null;
      height?: number | null;
      [key: string]: unknown;
    } | null;
    terrain_grid: Array<Record<string, unknown>> | null;
    cities: Array<Record<string, unknown>> | null;
    image_small_url: string | null;
    image_large_url: string | null;
    image_atmosphere_url: string | null;
    image_stratosphere_url: string | null;
    image_loworbit_url: string | null;
    last_pulled_at: string | null;
  }>;
  stations: Array<{
    uid: string | null;
    identifier: string | null;
    name: string | null;
    type_name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
    last_pulled_at: string | null;
    station_type: {
      uid: string;
      name: string | null;
      length: number | null;
      description: string | null;
      sensors: number | null;
      ecm: number | null;
      weight_tonnes: number | null;
      volume_m3: number | null;
      weight_capacity_tonnes: number | null;
      volume_capacity_m3: number | null;
      max_passengers: number | null;
      escape_pods: number | null;
      hull: number | null;
      shield: number | null;
      ionic_capacity: number | null;
      medical_rooms: number | null;
      has_hangar_bay: boolean | null;
      has_docking_bay: boolean | null;
      can_recycle: boolean | null;
      can_produce: boolean | null;
      is_asteroid_mining_depot: boolean | null;
      can_refine_alazhi: boolean | null;
      can_interdict: boolean | null;
      can_research: boolean | null;
      price_credits: number | null;
      production_modifier: number | null;
      recommended_workers: number | null;
      recycling_xp: number | null;
      generic_slots: number | null;
      weapons: Array<Record<string, unknown>> | null;
      materials: Array<Record<string, unknown>> | null;
      images: Record<string, string | null> | null;
      image_url: string | null;
      icon_url: string | null;
      last_pulled_at: string | null;
    } | null;
  }>;
  hyperlanes: Array<{
    uid: string | null;
    name: string | null;
    destination_uid: string | null;
    destination_name: string | null;
    destination_galx: number | null;
    destination_galy: number | null;
    owner_name: string | null;
    blocks: string | null;
    modifier: number | null;
    last_pulled_at: string | null;
  }>;
};

export type StoredStationTypeSummary = {
  uid: string;
  name: string | null;
  length: number | null;
  description: string | null;
  sensors: number | null;
  ecm: number | null;
  weight_tonnes: number | null;
  volume_m3: number | null;
  weight_capacity_tonnes: number | null;
  volume_capacity_m3: number | null;
  max_passengers: number | null;
  escape_pods: number | null;
  hull: number | null;
  shield: number | null;
  ionic_capacity: number | null;
  medical_rooms: number | null;
  has_hangar_bay: boolean | null;
  has_docking_bay: boolean | null;
  can_recycle: boolean | null;
  can_produce: boolean | null;
  is_asteroid_mining_depot: boolean | null;
  can_refine_alazhi: boolean | null;
  can_interdict: boolean | null;
  can_research: boolean | null;
  price_credits: number | null;
  production_modifier: number | null;
  recommended_workers: number | null;
  recycling_xp: number | null;
  generic_slots: number | null;
  weapons: Array<Record<string, unknown>> | null;
  materials: Array<Record<string, unknown>> | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredStationTypeDetail = StoredStationTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type StoredShipTypeSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  description: string | null;
  length: number | null;
  max_speed: number | null;
  hyperdrive: number | null;
  max_passengers: number | null;
  hull: number | null;
  shield: number | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredShipTypeDetail = StoredShipTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type StoredFacilityTypeSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  size: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  description: string | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredFacilityTypeDetail = StoredFacilityTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type StoredItemTypeSummary = {
  uid: string;
  name: string | null;
  class_uid: string | null;
  class_name: string | null;
  description: string | null;
  weight_tonnes: number | null;
  volume_m3: number | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredItemTypeDetail = StoredItemTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type StoredTerrainTypeSummary = {
  uid: string;
  name: string | null;
  code: string | null;
  description: string | null;
  image_url: string | null;
  last_pulled_at: string | null;
};

export type StoredTerrainTypeDetail = StoredTerrainTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type StoredMaterialTypeSummary = {
  uid: string;
  name: string | null;
  description: string | null;
  weight_tonnes: number | null;
  volume_m3: number | null;
  rarity: number | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredMaterialTypeDetail = StoredMaterialTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type EntityStatsKind = "station" | "facility" | "item" | "ship" | "terrain" | "material";

export function getStoredSectors() {
  return apiFetch<{ ok: boolean; data: StoredSectorSummary[] }>("/universe/sectors");
}

export function getStoredSector(sector: string) {
  return apiFetch<{ ok: boolean; data: StoredSectorDetail }>(
    `/universe/sectors/${encodeURIComponent(sector)}`
  );
}

export function getStoredMapSystems() {
  return apiFetch<{ ok: boolean; data: StoredMapSystem[] }>("/universe/map-systems");
}

export function getStoredSystem(system: string) {
  return apiFetch<{ ok: boolean; data: StoredSystemDetail }>(
    `/universe/systems/${encodeURIComponent(system)}`
  );
}

export function getStoredCellAnnotations(sectorUid: string) {
  const params = new URLSearchParams({ sector_uid: sectorUid });
  return apiFetch<{ ok: boolean; data: SectorCellAnnotation[] }>(
    `/universe/cell-annotations?${params.toString()}`
  );
}

export function saveStoredCellAnnotation(payload: {
  sector_uid: string;
  galx: number;
  galy: number;
  marker_type?: string | null;
  label?: string | null;
  notes?: string | null;
}) {
  return apiFetch<{ ok: boolean; message: string; data: SectorCellAnnotation | null }>(
    `/universe/cell-annotations`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function getStoredStationTypes() {
  return apiFetch<{ ok: boolean; data: StoredStationTypeSummary[] }>("/universe/station-types");
}

export function getStoredStationType(stationType: string) {
  return apiFetch<{ ok: boolean; data: StoredStationTypeDetail }>(
    `/universe/station-types/${encodeURIComponent(stationType)}`
  );
}

export function getStoredShipTypes() {
  return apiFetch<{ ok: boolean; data: StoredShipTypeSummary[] }>("/universe/ship-types");
}

export function getStoredFacilityTypes() {
  return apiFetch<{ ok: boolean; data: StoredFacilityTypeSummary[] }>("/universe/facility-types");
}

export function getStoredFacilityType(facilityType: string) {
  return apiFetch<{ ok: boolean; data: StoredFacilityTypeDetail }>(
    `/universe/facility-types/${encodeURIComponent(facilityType)}`
  );
}

export function getStoredItemTypes() {
  return apiFetch<{ ok: boolean; data: StoredItemTypeSummary[] }>("/universe/item-types");
}

export function getStoredItemType(itemType: string) {
  return apiFetch<{ ok: boolean; data: StoredItemTypeDetail }>(
    `/universe/item-types/${encodeURIComponent(itemType)}`
  );
}

export function getStoredShipType(shipType: string) {
  return apiFetch<{ ok: boolean; data: StoredShipTypeDetail }>(
    `/universe/ship-types/${encodeURIComponent(shipType)}`
  );
}

export function getStoredTerrainTypes() {
  return apiFetch<{ ok: boolean; data: StoredTerrainTypeSummary[] }>("/universe/terrain-types");
}

export function getStoredTerrainType(terrainType: string) {
  return apiFetch<{ ok: boolean; data: StoredTerrainTypeDetail }>(
    `/universe/terrain-types/${encodeURIComponent(terrainType)}`
  );
}

export function getStoredMaterialTypes() {
  return apiFetch<{ ok: boolean; data: StoredMaterialTypeSummary[] }>("/universe/material-types");
}

export function getStoredMaterialType(materialType: string) {
  return apiFetch<{ ok: boolean; data: StoredMaterialTypeDetail }>(
    `/universe/material-types/${encodeURIComponent(materialType)}`
  );
}

export function updateAdminEntityStats(
  entityType: EntityStatsKind,
  entityId: string,
  data: Record<string, unknown>
) {
  return apiFetch<{ ok: boolean; message: string; data: Record<string, unknown> | null }>(
    `/admin/entity-stats/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ data }),
    }
  );
}

export function populateAdminStationIcons() {
  return apiFetch<{ ok: boolean; message: string; data: { updated: number; skipped: number } }>(
    "/admin/entity-stats/station-icons/populate",
    {
      method: "POST",
    }
  );
}

export function populateAdminMaterialIcons() {
  return apiFetch<{ ok: boolean; message: string; data: { updated: number; skipped: number } }>(
    "/admin/entity-stats/material-icons/populate",
    {
      method: "POST",
    }
  );
}
