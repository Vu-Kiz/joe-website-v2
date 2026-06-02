import { apiFetch, getApiBaseUrl } from "../core/auth";

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

export type ArchivePlanetSummary = {
  uid: string | null;
  identifier: string | null;
  name: string | null;
  sector_uid: string | null;
  sector_name: string | null;
  system_uid: string | null;
  system_name: string | null;
  owner_uid: string | null;
  owner_name: string | null;
  planet_type_uid: string | null;
  planet_type_name: string | null;
  size: number | null;
  population: number | null;
  previous_population: number | null;
  previous_population_recorded_at: string | null;
  galx: number | null;
  galy: number | null;
  sysx: number | null;
  sysy: number | null;
  image_small_url: string | null;
  image_large_url: string | null;
  last_pulled_at: string | null;
};

export type ArchivePlanetDetail = ArchivePlanetSummary & {
  planet_type_href: string | null;
  previous_population: number | null;
  previous_population_recorded_at: string | null;
  terrain_map: string | null;
  surface_bounds: Record<string, unknown> | null;
  terrain_grid: Array<Record<string, unknown>> | null;
  cities: Array<Record<string, unknown>> | null;
  image_atmosphere_url: string | null;
  image_stratosphere_url: string | null;
  image_loworbit_url: string | null;
};

export type ArchiveFactionSummary = {
  id: number | null;
  name: string | null;
  abbreviation: string | null;
  owner_uid: string | null;
  swc_uid: number | null;
  member_count: number | null;
  systems_owned: number;
  planets_owned: number;
  stations_owned: number;
  population: number | null;
  population_change: number | null;
};

export type HyperPlannerSystem = {
  uid: string | null;
  identifier: string | null;
  name: string | null;
  sector_uid: string | null;
  sector_name: string | null;
  galx: number | null;
  galy: number | null;
  kind?: "system" | "coords";
  label?: string | null;
};

export type HyperPlannerResult = {
  from: HyperPlannerSystem | null;
  to: HyperPlannerSystem | null;
  summary: {
    hop_count: number;
    visited_systems: number;
    total_modifier: number | null;
    average_modifier: number | null;
    direct_seconds: number;
    direct_formatted_time: string;
    time_saved_seconds: number;
    time_saved_formatted: string;
    total_seconds: number;
    formatted_time: string;
    piloting_skill: number;
    hyperspeed: number;
  };
  systems: HyperPlannerSystem[];
  hops: Array<{
    hop_type?: "hyperlane" | "direct";
    lane_uid: string | null;
    lane_name: string | null;
    owner_name: string | null;
    blocks: string | null;
    modifier: number | null;
    existing_blocks: number;
    blocks_used: number;
    journey_length: number;
    direct_seconds: number;
    direct_formatted_time: string;
    time_modifier: number;
    lane_seconds: number;
    formatted_time: string;
    from: HyperPlannerSystem | null;
    to: HyperPlannerSystem | null;
  }>;
  routes?: HyperPlannerRoute[];
};

export type HyperPlannerRoute = {
  route_index: number;
  route_label: string;
  from: HyperPlannerSystem | null;
  to: HyperPlannerSystem | null;
  summary: HyperPlannerResult["summary"];
  systems: HyperPlannerSystem[];
  hops: HyperPlannerResult["hops"];
};

export type HyperPlan = {
  id: number;
  name: string;
  from_system_identifier: string;
  from_system_name: string | null;
  to_system_identifier: string;
  to_system_name: string | null;
  ship_uid: string | null;
  ship_name: string | null;
  ship_class_name: string | null;
  hyperspeed: number;
  piloting_skill: number;
  created_at: string | null;
  updated_at: string | null;
};

export type UniversePullResponse = {
  ok: boolean;
  message: string;
  data: any;
  persistence?: any;
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
  search_records: SectorSearchRecord[];
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

export type SectorSearchRecord = {
  id: number;
  sector_uid: string | null;
  asteroid_uid: string | null;
  galx: number;
  galy: number;
  square_name: string | null;
  is_system_searched: boolean;
  has_asteroids: boolean;
  planetoids_checked: boolean | null;
  planetoid_1_type: string | null;
  planetoid_1_size: "1x1" | "2x2" | null;
  planetoid_2_type: string | null;
  planetoid_2_size: "1x1" | "2x2" | null;
  has_ships: boolean | null;
  has_stations: boolean | null;
  legacy_note: string | null;
  legacy_recorded_at: string | null;
  rescan_due_at: string | null;
  is_rescan_due: boolean;
  legacy_player: string | null;
  legacy_icon: string | null;
  handle: string | null;
  legacy_tag: string | null;
  legacy_read: boolean;
  updated_at?: string | null;
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
    owner_uid: string | null;
    owner_name: string | null;
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
    planet_type_uid: string | null;
    planet_type_name: string | null;
    planet_type_href: string | null;
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
  droidbrain_stations: Array<{
    uid: string | null;
    name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    type_name: string | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
    snapshot_unixtime: number | null;
    image_url: string | null;
    icon_url: string | null;
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
  ships: Array<{
    uid: string | null;
    name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    class_name: string | null;
    type_name: string | null;
    galx: number | null;
    galy: number | null;
    sysx: number | null;
    sysy: number | null;
    snapshot_unixtime: number | null;
  }>;
};

export type StoredLocationDetail = {
  resource: "location";
  location: {
    galx: number;
    galy: number;
    primary_label: string;
    sector_uid: string | null;
    sector_name: string | null;
    within_scan_window: boolean;
  };
  systems: Array<{
    uid: string | null;
    identifier: string | null;
    name: string | null;
    sector_uid: string | null;
    sector_name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    galx: number | null;
    galy: number | null;
    last_pulled_at: string | null;
  }>;
  search_record: SectorSearchRecord | null;
  annotation: SectorCellAnnotation | null;
  asteroid_field: {
    width: number;
    height: number;
    rows: string[];
    mask: boolean[][];
    snapshot_unixtime: number | null;
    object_type: string | null;
    object_name: string | null;
  } | null;
  ships: Array<{
    uid: string | null;
    name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    class_name: string | null;
    type_name: string | null;
    system_name: string | null;
    planet_name: string | null;
    city_name: string | null;
    sysx: number | null;
    sysy: number | null;
    surfx: number | null;
    surfy: number | null;
    groundx: number | null;
    groundy: number | null;
    snapshot_unixtime: number | null;
  }>;
  stations: Array<{
    uid: string | null;
    name: string | null;
    owner_uid: string | null;
    owner_name: string | null;
    class_name: string | null;
    type_name: string | null;
    image_url: string | null;
    icon_url: string | null;
    system_name: string | null;
    planet_name: string | null;
    city_name: string | null;
    sysx: number | null;
    sysy: number | null;
    surfx: number | null;
    surfy: number | null;
    groundx: number | null;
    groundy: number | null;
    snapshot_unixtime: number | null;
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
  manoeuvrability: number | null;
  sensors: number | null;
  ecm: number | null;
  weight_tonnes: number | null;
  volume_m3: number | null;
  weight_capacity_tonnes: number | null;
  volume_capacity_m3: number | null;
  max_speed: number | null;
  hyperdrive: number | null;
  max_passengers: number | null;
  escape_pods: number | null;
  hull: number | null;
  shield: number | null;
  shield_arcs: Array<{
    name: string | null;
    value: number | null;
    percent: number | null;
  }> | null;
  armour: number | null;
  ionic_capacity: number | null;
  has_repulsors: boolean | null;
  slot_size: number | null;
  medical_rooms: number | null;
  has_hangar_bay: boolean | null;
  has_docking_bay: boolean | null;
  can_recycle: boolean | null;
  can_interdict: boolean | null;
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

export type StoredShipTypeDetail = StoredShipTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type StoredVehicleTypeSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  description: string | null;
  length: number | null;
  max_speed: number | null;
  max_passengers: number | null;
  hull: number | null;
  shield: number | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredVehicleTypeDetail = StoredVehicleTypeSummary & {
  manoeuvrability: number | null;
  sensors: number | null;
  ecm: number | null;
  weight_tonnes: number | null;
  volume_m3: number | null;
  weight_capacity_tonnes: number | null;
  volume_capacity_m3: number | null;
  ionic_capacity: number | null;
  has_repulsors: boolean | null;
  slot_size: number | null;
  medical_rooms: number | null;
  has_hangar_bay: boolean | null;
  has_docking_bay: boolean | null;
  can_recycle: boolean | null;
  production_modifier: number | null;
  recommended_workers: number | null;
  recycling_xp: number | null;
  generic_slots: number | null;
  terrain_restrictions: Array<Record<string, unknown>> | null;
  weapons: Array<Record<string, unknown>> | null;
  materials: Array<Record<string, unknown>> | null;
  payload: Record<string, unknown> | null;
};

export type StoredDroidTypeSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  description: string | null;
  sensors: number | null;
  ecm: number | null;
  batch_quantity: number | null;
  weight_tonnes: number | null;
  volume_m3: number | null;
  weight_capacity_tonnes: number | null;
  volume_capacity_m3: number | null;
  hull: number | null;
  shield: number | null;
  ionic_capacity: number | null;
  armour: number | null;
  slot_size: number | null;
  terrain_restrictions: Array<Record<string, unknown>> | null;
  price_credits: number | null;
  production_modifier: number | null;
  recommended_workers: number | null;
  recycling_xp: number | null;
  generic_slots: number | null;
  skills: Record<string, unknown> | null;
  weapons: Array<Record<string, unknown>> | null;
  materials: Array<Record<string, unknown>> | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredDroidTypeDetail = StoredDroidTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type StoredCreatureTypeSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  description: string | null;
  slot_size: number | null;
  species: string | null;
  base_hp: number | null;
  weight_tonnes: number | null;
  volume_m3: number | null;
  homeworld_uid: string | null;
  homeworld_name: string | null;
  homeworld_href: string | null;
  spawn_terrain_types: Array<Record<string, unknown>> | null;
  terrain_restrictions: Array<Record<string, unknown>> | null;
  skills: Record<string, unknown> | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredCreatureTypeDetail = StoredCreatureTypeSummary & {
  weapons: Array<Record<string, unknown>> | null;
  payload: Record<string, unknown> | null;
};

export type StoredNpcTypeSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  description: string | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  last_pulled_at: string | null;
};

export type StoredNpcTypeDetail = StoredNpcTypeSummary & {
  hiring_locations: Array<Record<string, unknown>> | null;
  skills: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
};

export type StoredRaceSummary = {
  uid: string;
  name: string | null;
  description: string | null;
  force_probability: number | null;
  hp_bonus: number | null;
  hp_multiplier: number | null;
  homeworld_uid: string | null;
  homeworld_name: string | null;
  homeworld_href: string | null;
  images: Record<string, unknown> | null;
  image_url: string | null;
  last_pulled_at: string | null;
};

export type StoredRaceDetail = StoredRaceSummary & {
  skills: Record<string, unknown> | null;
  terrain_restrictions: Array<Record<string, unknown>> | null;
  payload: Record<string, unknown> | null;
};

export type StoredWeaponTypeSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  description: string | null;
  damage_type: string | null;
  min_damage: number | null;
  max_damage: number | null;
  optimum_range: number | null;
  max_hits: number | null;
  drop_off: number | null;
  firepower: number | null;
  tracking: number | null;
  is_poison: boolean | null;
  is_dual: boolean | null;
  price_credits: number | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  icon_url: string | null;
  last_pulled_at: string | null;
};

export type StoredWeaponTypeDetail = StoredWeaponTypeSummary & {
  payload: Record<string, unknown> | null;
  mounted_ships?: Array<{
    uid: string;
    name: string | null;
    class_name: string | null;
    image_url: string | null;
    icon_url: string | null;
  }> | null;
  mounted_vehicles?: Array<{
    uid: string;
    name: string | null;
    class_name: string | null;
    image_url: string | null;
    icon_url: string | null;
  }> | null;
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
  matching_weapon?: StoredWeaponTypeDetail | null;
  payload: Record<string, unknown> | null;
};

export type StoredTerrainTypeSummary = {
  uid: string;
  name: string | null;
  code: string | null;
  material_probability_percent: number | null;
  material_types: Array<Record<string, unknown>> | null;
  images: Record<string, string | null> | null;
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

export type StoredPlanetTypeSummary = {
  uid: string;
  name: string | null;
  description: string | null;
  images: Record<string, string | null> | null;
  image_url: string | null;
  last_pulled_at: string | null;
};

export type StoredPlanetTypeDetail = StoredPlanetTypeSummary & {
  payload: Record<string, unknown> | null;
};

export type EntityStatsKind = "station" | "facility" | "item" | "planet" | "ship" | "vehicle" | "droid" | "creature" | "npc" | "race" | "weapon" | "terrain" | "material";
export type UniverseCacheManifest = {
  revision: string;
  snapshot: Record<string, unknown>;
  generated_at: string;
};

export type GalaxySnapshotLayerMeta = {
  name: "sectors" | "systems" | "asteroids" | "scans" | "notes" | "ships" | "stations";
  count: number;
  available: boolean;
};

export type GalaxySnapshotMeta = {
  revision: string;
  manifest_revision: string;
  can_view_asteroid_intel: boolean;
  can_view_scan_window: boolean;
  layers: GalaxySnapshotLayerMeta[];
  generated_at: string;
};

export function getStoredSectors() {
  return apiFetch<{ ok: boolean; data: StoredSectorSummary[] }>("/universe/sectors");
}

export function getUniverseCacheManifest() {
  return apiFetch<{ ok: boolean; data: UniverseCacheManifest }>("/universe/cache-manifest");
}

export function getGalaxySnapshotMeta() {
  return apiFetch<{ ok: boolean; data: GalaxySnapshotMeta }>("/universe/galaxy-snapshot/meta");
}

export function getGalaxySnapshotLayer<T>(layer: GalaxySnapshotLayerMeta["name"]) {
  return apiFetch<{ ok: boolean; data: T[] }>(
    `/universe/galaxy-snapshot/layer/${encodeURIComponent(layer)}`
  );
}

export function getStoredSector(sector: string) {
  return apiFetch<{ ok: boolean; data: StoredSectorDetail }>(
    `/universe/sectors/${encodeURIComponent(sector)}`
  );
}

export function getStoredMapSystems() {
  return apiFetch<{ ok: boolean; data: StoredMapSystem[] }>("/universe/map-systems");
}

export type GalaxyBounds = {
  min_galx: number;
  max_galx: number;
  min_galy: number;
  max_galy: number;
};

function buildBoundsParams(bounds?: GalaxyBounds | null) {
  if (!bounds) {
    return "";
  }

  const params = new URLSearchParams({
    min_galx: String(bounds.min_galx),
    max_galx: String(bounds.max_galx),
    min_galy: String(bounds.min_galy),
    max_galy: String(bounds.max_galy),
  });

  return `?${params.toString()}`;
}

export function getStoredMapSystemsInBounds(bounds?: GalaxyBounds | null) {
  return apiFetch<{ ok: boolean; data: StoredMapSystem[] }>(
    `/universe/map-systems${buildBoundsParams(bounds)}`
  );
}

export function refreshStoredSystem(identifier: string) {
  return apiFetch<UniversePullResponse>("/sys/universe/pull", {
    method: "POST",
    body: JSON.stringify({
      resource: "system",
      identifier,
      persist: true,
      deep: false,
      hyperlanes_only: true,
    }),
  });
}

export function getHyperPlannerRoute(
  from: string,
  to: string,
  options?: {
    pilotingSkill?: number;
    hyperspeed?: number;
  }
) {
  const params = new URLSearchParams({
    from,
    to,
    ...(options?.pilotingSkill != null ? { piloting_skill: String(options.pilotingSkill) } : {}),
    ...(options?.hyperspeed != null ? { hyperspeed: String(options.hyperspeed) } : {}),
  });
  return apiFetch<{ ok: boolean; data: HyperPlannerResult }>(
    `/universe/hyper-planner?${params.toString()}`
  );
}

export function getHyperPlans() {
  return apiFetch<{ ok: boolean; data: HyperPlan[] }>("/universe/hyper-plans");
}

export function saveHyperPlan(payload: {
  name: string;
  from_system_identifier: string;
  from_system_name?: string | null;
  to_system_identifier: string;
  to_system_name?: string | null;
  ship_uid?: string | null;
  ship_name?: string | null;
  ship_class_name?: string | null;
  hyperspeed: number;
  piloting_skill: number;
}) {
  return apiFetch<{ ok: boolean; message: string; data: HyperPlan }>("/universe/hyper-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteHyperPlan(planId: number) {
  return apiFetch<{ ok: boolean; message: string }>(`/universe/hyper-plans/${planId}`, {
    method: "DELETE",
  });
}

export function getStoredSearchRecords() {
  return apiFetch<{ ok: boolean; data: SectorSearchRecord[] }>("/universe/search-records");
}

export function getStoredSearchRecordsInBounds(bounds?: GalaxyBounds | null) {
  return apiFetch<{ ok: boolean; data: SectorSearchRecord[] }>(
    `/universe/search-records${buildBoundsParams(bounds)}`
  );
}

export function saveStoredSearchRecord(payload: {
  sector_uid?: string | null;
  galx: number;
  galy: number;
  square_name?: string | null;
  planetoids_checked?: boolean | null;
  planetoid_1_type?: string | null;
  planetoid_1_size?: "1x1" | "2x2" | null;
  planetoid_2_type?: string | null;
  planetoid_2_size?: "1x1" | "2x2" | null;
  has_ships?: boolean | null;
  has_stations?: boolean | null;
}) {
  return apiFetch<{ ok: boolean; message: string; data: SectorSearchRecord }>(
    "/universe/search-records",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function getStoredSystem(system: string) {
  return apiFetch<{ ok: boolean; data: StoredSystemDetail }>(
    `/universe/systems/${encodeURIComponent(system)}`
  );
}

export function getStoredLocation(galx: number, galy: number) {
  return apiFetch<{ ok: boolean; data: StoredLocationDetail }>(
    `/universe/locations/${encodeURIComponent(String(galx))}/${encodeURIComponent(String(galy))}`
  );
}

export function getArchivePlanets(query?: string) {
  const params = new URLSearchParams();
  if (query?.trim()) {
    params.set("q", query.trim());
  }

  return apiFetch<{ ok: boolean; data: ArchivePlanetSummary[] }>(
    `/universe/archive/planets${params.toString() ? `?${params.toString()}` : ""}`
  );
}

export function getArchivePlanet(planet: string) {
  return apiFetch<{ ok: boolean; data: ArchivePlanetDetail }>(
    `/universe/archive/planets/${encodeURIComponent(planet)}`
  );
}

export function getArchiveFactions(query?: string) {
  const params = new URLSearchParams();
  if (query?.trim()) {
    params.set("q", query.trim());
  }

  return apiFetch<{ ok: boolean; data: ArchiveFactionSummary[] }>(
    `/universe/archive/factions${params.toString() ? `?${params.toString()}` : ""}`
  );
}

export function getStoredCellAnnotations(options: { sectorUid?: string | null; bounds?: GalaxyBounds | null }) {
  const params = new URLSearchParams();

  if (options.sectorUid) {
    params.set("sector_uid", options.sectorUid);
  }

  if (options.bounds) {
    params.set("min_galx", String(options.bounds.min_galx));
    params.set("max_galx", String(options.bounds.max_galx));
    params.set("min_galy", String(options.bounds.min_galy));
    params.set("max_galy", String(options.bounds.max_galy));
  }

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

export function getStoredVehicleTypes() {
  return apiFetch<{ ok: boolean; data: StoredVehicleTypeSummary[] }>("/universe/vehicle-types");
}

export function getStoredDroidTypes() {
  return apiFetch<{ ok: boolean; data: StoredDroidTypeSummary[] }>("/universe/droid-types");
}

export function getStoredCreatureTypes() {
  return apiFetch<{ ok: boolean; data: StoredCreatureTypeSummary[] }>("/universe/creature-types");
}

export function getStoredNpcTypes() {
  return apiFetch<{ ok: boolean; data: StoredNpcTypeSummary[] }>("/universe/npc-types");
}

export function getStoredRaces() {
  return apiFetch<{ ok: boolean; data: StoredRaceSummary[] }>("/universe/races");
}

export function getStoredWeaponTypes() {
  return apiFetch<{ ok: boolean; data: StoredWeaponTypeSummary[] }>("/universe/weapon-types");
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

export function getStoredPlanetTypes() {
  return apiFetch<{ ok: boolean; data: StoredPlanetTypeSummary[] }>("/universe/planet-types");
}

export function getStoredPlanetType(planetType: string) {
  return apiFetch<{ ok: boolean; data: StoredPlanetTypeDetail }>(
    `/universe/planet-types/${encodeURIComponent(planetType)}`
  );
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

export function getStoredVehicleType(vehicleType: string) {
  return apiFetch<{ ok: boolean; data: StoredVehicleTypeDetail }>(
    `/universe/vehicle-types/${encodeURIComponent(vehicleType)}`
  );
}

export function getStoredDroidType(droidType: string) {
  return apiFetch<{ ok: boolean; data: StoredDroidTypeDetail }>(
    `/universe/droid-types/${encodeURIComponent(droidType)}`
  );
}

export function getStoredCreatureType(creatureType: string) {
  return apiFetch<{ ok: boolean; data: StoredCreatureTypeDetail }>(
    `/universe/creature-types/${encodeURIComponent(creatureType)}`
  );
}

export function getStoredNpcType(npcType: string) {
  return apiFetch<{ ok: boolean; data: StoredNpcTypeDetail }>(
    `/universe/npc-types/${encodeURIComponent(npcType)}`
  );
}

export function getStoredRace(race: string) {
  return apiFetch<{ ok: boolean; data: StoredRaceDetail }>(
    `/universe/races/${encodeURIComponent(race)}`
  );
}

export function getStoredWeaponType(weaponType: string) {
  return apiFetch<{ ok: boolean; data: StoredWeaponTypeDetail }>(
    `/universe/weapon-types/${encodeURIComponent(weaponType)}`
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

export async function downloadEntityStatsCsv(entityType: EntityStatsKind) {
  const response = await fetch(
    `${getApiBaseUrl()}/universe/entity-stats/${encodeURIComponent(entityType)}/export.csv`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/csv",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();

    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // leave as raw text
    }

    throw new Error(
      json?.message ||
        json?.error ||
        (text && !text.startsWith("<!DOCTYPE") ? text : null) ||
        `Failed to export CSV (${response.status}).`
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);

  return {
    blob,
    filename: filenameMatch?.[1] ?? `${entityType}-entity-stats.csv`,
  };
}

export async function downloadAdminEntityStatsCsv(entityType: EntityStatsKind) {
  const response = await fetch(
    `${getApiBaseUrl()}/admin/entity-stats/${encodeURIComponent(entityType)}/export.csv`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/csv",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();

    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // leave as raw text
    }

    throw new Error(
      json?.message ||
        json?.error ||
        (text && !text.startsWith("<!DOCTYPE") ? text : null) ||
        `Failed to export CSV (${response.status}).`
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);

  return {
    blob,
    filename: filenameMatch?.[1] ?? `${entityType}-entity-stats.csv`,
  };
}

export function getSubscriberCellRecords() {
  return apiFetch<{ ok: boolean; data: SectorSearchRecord[] }>("/universe/subscriber-cell-records");
}

export function adminGetAllSubscriberCellRecords() {
  return apiFetch<{ ok: boolean; data: SectorSearchRecord[] }>("/admin/subscriber-cell-records");
}

export function saveSubscriberCellRecord(payload: {
  galx: number;
  galy: number;
  sector_uid?: string | null;
  planetoids_checked?: boolean | null;
  planetoid_1_size?: "1x1" | "2x2" | null;
  planetoid_2_size?: "1x1" | "2x2" | null;
  has_ships?: boolean | null;
  has_stations?: boolean | null;
}) {
  return apiFetch<{ ok: boolean; data: SectorSearchRecord }>("/universe/subscriber-cell-records", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
