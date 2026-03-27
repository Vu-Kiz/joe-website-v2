import React from "react";

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
    <section className="admin-card">
      <div className="admin-card__header">
        <h3 className="admin-card__title">{title}</h3>
        <p className="admin-card__desc">{description}</p>
      </div>

      <div className="admin-card__actions">
        <button className="btn" type="button" onClick={onClick} disabled={loading}>
          {loading ? "Running..." : buttonLabel}
        </button>
      </div>

      {message ? <p className="small">{message}</p> : null}
      {error ? <p className="small" style={{ color: "salmon" }}>{error}</p> : null}
      {progressLines.length > 0 ? (
        <div className="sysuniverse-stack">
          {progressLines.slice(-8).map((line, index) => (
            <p key={`${title}-${index}`} className="small">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {persistence ? (
        <div className="admin-grid">
          <div className="admin-card"><h3 className="admin-card__title">Type Records</h3><p className="small">{persistence.station_type_count ?? persistence.planet_type_count ?? persistence.ship_type_count ?? persistence.facility_type_count ?? persistence.item_type_count ?? persistence.terrain_type_count ?? persistence.material_type_count ?? persistence.total ?? 0}</p></div>
          <div className="admin-card"><h3 className="admin-card__title">Pages Pulled</h3><p className="small">{persistence.pages ?? "Unknown"}</p></div>
          <div className="admin-card"><h3 className="admin-card__title">Total Listed</h3><p className="small">{persistence.total ?? "Unknown"}</p></div>
          <div className="admin-card"><h3 className="admin-card__title">Details Hydrated</h3><p className="small">{persistence.hydrated_station_types ?? persistence.hydrated_planet_types ?? persistence.hydrated_ship_types ?? persistence.hydrated_facility_types ?? persistence.hydrated_item_types ?? persistence.hydrated_terrain_types ?? persistence.hydrated_material_types ?? 0}</p></div>
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
