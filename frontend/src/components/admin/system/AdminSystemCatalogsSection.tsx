import React from "react";
import { BTN } from "../../../utils/ui";

type CatalogCardProps = {
  title: string;
  description: string;
  loading: boolean;
  buttonLabel: string;
  onClick: () => void;
  message: string | null;
  error: string | null;
  progressLines: string[];
  persistence: any;
};

function CatalogCard({
  title,
  description,
  loading,
  buttonLabel,
  onClick,
  message,
  error,
  progressLines,
  persistence,
}: CatalogCardProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0">{title}</h3>
        <p className="m-0 opacity-[0.85]">{description}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className={BTN} type="button" onClick={onClick} disabled={loading}>
          {loading ? "Running..." : buttonLabel}
        </button>
      </div>

      {message ? <p className="small">{message}</p> : null}
      {error ? <p className="small" style={{ color: "salmon" }}>{error}</p> : null}
      {progressLines.length > 0 ? (
        <div className="grid gap-3.5">
          {progressLines.slice(-8).map((line, index) => (
            <p key={`${title}-${index}`} className="small">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {persistence ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <div className="flex flex-col gap-4"><h3 className="m-0">Type Records</h3><p className="small">{persistence.station_type_count ?? persistence.planet_type_count ?? persistence.ship_type_count ?? persistence.vehicle_type_count ?? persistence.droid_type_count ?? persistence.creature_type_count ?? persistence.npc_type_count ?? persistence.race_count ?? persistence.weapon_type_count ?? persistence.facility_type_count ?? persistence.item_type_count ?? persistence.terrain_type_count ?? persistence.material_type_count ?? persistence.total ?? 0}</p></div>
          <div className="flex flex-col gap-4"><h3 className="m-0">Pages Pulled</h3><p className="small">{persistence.pages ?? "Unknown"}</p></div>
          <div className="flex flex-col gap-4"><h3 className="m-0">Total Listed</h3><p className="small">{persistence.total ?? "Unknown"}</p></div>
          <div className="flex flex-col gap-4"><h3 className="m-0">Details Hydrated</h3><p className="small">{persistence.hydrated_station_types ?? persistence.hydrated_planet_types ?? persistence.hydrated_ship_types ?? persistence.hydrated_vehicle_types ?? persistence.hydrated_droid_types ?? persistence.hydrated_creature_types ?? persistence.hydrated_npc_types ?? persistence.hydrated_races ?? persistence.hydrated_weapon_types ?? persistence.hydrated_facility_types ?? persistence.hydrated_item_types ?? persistence.hydrated_terrain_types ?? persistence.hydrated_material_types ?? 0}</p></div>
        </div>
      ) : null}
    </section>
  );
}

type Props = {
  stationTypeLoading: boolean;
  stationTypeMessage: string | null;
  stationTypeError: string | null;
  stationTypePersistence: any;
  stationTypeProgressLines: string[];
  onPullAllStationTypes: () => void;
  shipTypeLoading: boolean;
  shipTypeMessage: string | null;
  shipTypeError: string | null;
  shipTypePersistence: any;
  shipTypeProgressLines: string[];
  onPullAllShipTypes: () => void;
  vehicleTypeLoading: boolean;
  vehicleTypeMessage: string | null;
  vehicleTypeError: string | null;
  vehicleTypePersistence: any;
  vehicleTypeProgressLines: string[];
  onPullAllVehicleTypes: () => void;
  droidTypeLoading: boolean;
  droidTypeMessage: string | null;
  droidTypeError: string | null;
  droidTypePersistence: any;
  droidTypeProgressLines: string[];
  onPullAllDroidTypes: () => void;
  creatureTypeLoading: boolean;
  creatureTypeMessage: string | null;
  creatureTypeError: string | null;
  creatureTypePersistence: any;
  creatureTypeProgressLines: string[];
  onPullAllCreatureTypes: () => void;
  npcTypeLoading: boolean;
  npcTypeMessage: string | null;
  npcTypeError: string | null;
  npcTypePersistence: any;
  npcTypeProgressLines: string[];
  onPullAllNpcTypes: () => void;
  raceLoading: boolean;
  raceMessage: string | null;
  raceError: string | null;
  racePersistence: any;
  raceProgressLines: string[];
  onPullAllRaces: () => void;
  weaponTypeLoading: boolean;
  weaponTypeMessage: string | null;
  weaponTypeError: string | null;
  weaponTypePersistence: any;
  weaponTypeProgressLines: string[];
  onPullAllWeaponTypes: () => void;
  facilityTypeLoading: boolean;
  facilityTypeMessage: string | null;
  facilityTypeError: string | null;
  facilityTypePersistence: any;
  facilityTypeProgressLines: string[];
  onPullAllFacilityTypes: () => void;
  itemTypeLoading: boolean;
  itemTypeMessage: string | null;
  itemTypeError: string | null;
  itemTypePersistence: any;
  itemTypeProgressLines: string[];
  onPullAllItemTypes: () => void;
  planetTypeLoading: boolean;
  planetTypeMessage: string | null;
  planetTypeError: string | null;
  planetTypePersistence: any;
  planetTypeProgressLines: string[];
  onPullAllPlanetTypes: () => void;
  terrainTypeLoading: boolean;
  terrainTypeMessage: string | null;
  terrainTypeError: string | null;
  terrainTypePersistence: any;
  terrainTypeProgressLines: string[];
  onPullAllTerrainTypes: () => void;
  materialTypeLoading: boolean;
  materialTypeMessage: string | null;
  materialTypeError: string | null;
  materialTypePersistence: any;
  materialTypeProgressLines: string[];
  onPullAllMaterialTypes: () => void;
};

const AdminSystemCatalogsSection: React.FC<Props> = (props) => {
  return (
    <>
      <CatalogCard
        title="Pull All Station Types"
        description="Pull the non-rate-limited SWC station type catalog, then hydrate each station type with its full detail payload so we can inspect richer metadata separately from live station instances."
        loading={props.stationTypeLoading}
        buttonLabel="Pull All Station Types"
        onClick={props.onPullAllStationTypes}
        message={props.stationTypeMessage}
        error={props.stationTypeError}
        progressLines={props.stationTypeProgressLines}
        persistence={props.stationTypePersistence}
      />
      <CatalogCard
        title="Pull All Ship Types"
        description="Pull the SWC ship type catalog and hydrate each ship type so we have stored ship references alongside other galaxy entity catalogs."
        loading={props.shipTypeLoading}
        buttonLabel="Pull All Ship Types"
        onClick={props.onPullAllShipTypes}
        message={props.shipTypeMessage}
        error={props.shipTypeError}
        progressLines={props.shipTypeProgressLines}
        persistence={props.shipTypePersistence}
      />
      <CatalogCard
        title="Pull All Vehicle Types"
        description="Pull the SWC vehicle type catalog and hydrate each vehicle type so we have stored ground-vehicle references alongside the other galaxy entity catalogs."
        loading={props.vehicleTypeLoading}
        buttonLabel="Pull All Vehicle Types"
        onClick={props.onPullAllVehicleTypes}
        message={props.vehicleTypeMessage}
        error={props.vehicleTypeError}
        progressLines={props.vehicleTypeProgressLines}
        persistence={props.vehicleTypePersistence}
      />
      <CatalogCard
        title="Pull All Droid Types"
        description="Pull the SWC droid type catalog and hydrate each droid type so we have stored droid references in their own catalog instead of mixing them with NPCs or vehicles."
        loading={props.droidTypeLoading}
        buttonLabel="Pull All Droid Types"
        onClick={props.onPullAllDroidTypes}
        message={props.droidTypeMessage}
        error={props.droidTypeError}
        progressLines={props.droidTypeProgressLines}
        persistence={props.droidTypePersistence}
      />
      <CatalogCard
        title="Pull All Creature Types"
        description="Pull the SWC creature type catalog and hydrate each creature type so stored wildlife and creature references live in their own catalog."
        loading={props.creatureTypeLoading}
        buttonLabel="Pull All Creature Types"
        onClick={props.onPullAllCreatureTypes}
        message={props.creatureTypeMessage}
        error={props.creatureTypeError}
        progressLines={props.creatureTypeProgressLines}
        persistence={props.creatureTypePersistence}
      />
      <CatalogCard
        title="Pull All NPC Types"
        description="Pull the SWC NPC type catalog and hydrate each NPC type so DroidBrain can reference real NPC type metadata separately from race names."
        loading={props.npcTypeLoading}
        buttonLabel="Pull All NPC Types"
        onClick={props.onPullAllNpcTypes}
        message={props.npcTypeMessage}
        error={props.npcTypeError}
        progressLines={props.npcTypeProgressLines}
        persistence={props.npcTypePersistence}
      />
      <CatalogCard
        title="Pull All Races"
        description="Pull the SWC race catalog into its own table so race metadata stays separate from NPC types."
        loading={props.raceLoading}
        buttonLabel="Pull All Races"
        onClick={props.onPullAllRaces}
        message={props.raceMessage}
        error={props.raceError}
        progressLines={props.raceProgressLines}
        persistence={props.racePersistence}
      />
      <CatalogCard
        title="Pull All Weapon Types"
        description="Pull the SWC weapon type catalog and hydrate each weapon type so stored combat references live in their own catalog."
        loading={props.weaponTypeLoading}
        buttonLabel="Pull All Weapon Types"
        onClick={props.onPullAllWeaponTypes}
        message={props.weaponTypeMessage}
        error={props.weaponTypeError}
        progressLines={props.weaponTypeProgressLines}
        persistence={props.weaponTypePersistence}
      />
      <CatalogCard
        title="Pull All Facility Types"
        description="Pull the SWC facility type catalog and hydrate each facility type so we have stored facility references alongside the other galaxy entity catalogs."
        loading={props.facilityTypeLoading}
        buttonLabel="Pull All Facility Types"
        onClick={props.onPullAllFacilityTypes}
        message={props.facilityTypeMessage}
        error={props.facilityTypeError}
        progressLines={props.facilityTypeProgressLines}
        persistence={props.facilityTypePersistence}
      />
      <CatalogCard
        title="Pull All Item Types"
        description="Pull the SWC item type catalog and hydrate each item type so we have stored item references alongside the other galaxy entity catalogs."
        loading={props.itemTypeLoading}
        buttonLabel="Pull All Item Types"
        onClick={props.onPullAllItemTypes}
        message={props.itemTypeMessage}
        error={props.itemTypeError}
        progressLines={props.itemTypeProgressLines}
        persistence={props.itemTypePersistence}
      />
      <CatalogCard
        title="Pull All Planet Types"
        description="Pull the SWC planet type catalog and hydrate each body type so suns, moons, asteroid fields, and normal planets can be classified from real SWC type data instead of guessing from names."
        loading={props.planetTypeLoading}
        buttonLabel="Pull All Planet Types"
        onClick={props.onPullAllPlanetTypes}
        message={props.planetTypeMessage}
        error={props.planetTypeError}
        progressLines={props.planetTypeProgressLines}
        persistence={props.planetTypePersistence}
      />
      <CatalogCard
        title="Pull All Terrain Types"
        description="Pull the SWC terrain type catalog and hydrate each terrain type so the planet terrain data has a real reference layer instead of only raw grid points and terrain map strings."
        loading={props.terrainTypeLoading}
        buttonLabel="Pull All Terrain Types"
        onClick={props.onPullAllTerrainTypes}
        message={props.terrainTypeMessage}
        error={props.terrainTypeError}
        progressLines={props.terrainTypeProgressLines}
        persistence={props.terrainTypePersistence}
      />
      <CatalogCard
        title="Pull All Material Types"
        description="Pull the SWC material catalog and hydrate each material type so terrain references can resolve into stored material metadata instead of only raw names and UIDs."
        loading={props.materialTypeLoading}
        buttonLabel="Pull All Material Types"
        onClick={props.onPullAllMaterialTypes}
        message={props.materialTypeMessage}
        error={props.materialTypeError}
        progressLines={props.materialTypeProgressLines}
        persistence={props.materialTypePersistence}
      />
    </>
  );
};

export default AdminSystemCatalogsSection;
