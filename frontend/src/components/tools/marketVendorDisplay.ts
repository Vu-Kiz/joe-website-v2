export const POPUP_BASE = "fixed inset-0 z-[1200] flex items-center justify-center bg-black/65";
export const POPUP_PANEL = "relative flex flex-col gap-4 w-[calc(100vw-2rem)] max-w-[480px] max-h-[90vh] overflow-y-auto p-5 rounded-[12px] border border-white/[0.12] bg-[#1a1c22] shadow-[0_24px_64px_rgba(0,0,0,0.6)]";
export const POPUP_CLOSE = "absolute right-3 top-3 bg-white/[0.06] hover:bg-white/10 hover:text-white/90 border-0 rounded-[6px] text-white/50 text-[0.85rem] px-2 py-1 cursor-pointer font-tektur";
export const POPUP_ROW = "flex items-baseline gap-2 justify-between";

export const BEST_PRICE_BADGE = "rounded-[4px] text-[0.7rem] font-semibold px-[0.45rem] py-[0.15rem] uppercase tracking-[0.05em] bg-[rgba(245,213,70,0.14)] text-[#f5d546]";

export const NEAR_YOU_BADGE = "rounded-[4px] text-[0.7rem] font-semibold px-[0.45rem] py-[0.15rem] uppercase tracking-[0.05em] bg-[rgba(100,220,200,0.14)] text-[#5ddec8]";

// Vendors within this many galaxy-grid units of the player get the "Near You" badge.
export const NEAR_YOU_THRESHOLD = 5;

export const OWNER_LINK_CLS =
  "bg-transparent border-0 p-0 m-0 cursor-pointer text-left hover:text-accent underline-offset-2 hover:underline font-tektur";

export function formatCredits(amount: number): string {
  return amount.toLocaleString() + " Credits";
}

export function formatCoords(galx: number | null, galy: number | null): string | null {
  if (galx == null || galy == null) return null;
  return `(${galx}, ${galy})`;
}

type VendorLocationFields = {
  system_label: string | null;
  galx: number | null;
  galy: number | null;
  planet_label?: string | null;
  city_label?: string | null;
  surface_x?: number | null;
  surface_y?: number | null;
  ground_x?: number | null;
  ground_y?: number | null;
};

export type VendorLocationPart = { text: string; colorClass: string };

export type VendorLocation = {
  // The galaxy grid — what a member needs to actually fly there.
  system: VendorLocationPart;
  // Planet/city/on-planet tile — finer detail once they've reached that grid. Empty
  // when the vendor has none of it (deep-space, ship, or station vendors).
  details: VendorLocationPart[];
};

// Each level of the breadcrumb gets its own color from the site's existing accent
// palette (not a new one-off color) so system/planet/city read as distinct place
// "names" at a glance instead of one flat grey/blue block.
const SYSTEM_COLOR_CLS = "text-[#5ddec8]"; // teal — matches the distance/near-you accent
const PLANET_COLOR_CLS = "text-[#F6A300]"; // jen-orange
const CITY_COLOR_CLS = "text-[#f5d546]"; // site accent gold
const TILE_COLOR_CLS = "text-white/45"; // surface/ground grid refs — detail, not a name
const UNKNOWN_COLOR_CLS = "text-white/30 italic"; // explicitly missing, not just terse

// Builds the "how to actually get there" breadcrumb once a member has already
// picked a galaxy grid: system -> planet -> city -> the exact surface/ground tile.
// Returns colored parts (rather than a joined string) so <VendorLocationBlock>
// can render the galaxy grid with visual priority and let each named place keep
// its own color instead of everything reading as one flat block.
//
// SWC reports planet/city/surface/ground per-vendor, not per-location — a vendor
// sitting on its own ship/container at a galaxy grid (rather than physically placed
// in a city) can genuinely lack some or all of this data even when other vendors at
// the exact same grid have it. Rather than silently truncating the breadcrumb (which
// reads as a display bug) or hiding it entirely, every vendor gets the same 4-part
// detail line, with "Unknown" standing in for whichever pieces SWC didn't report.
export function formatVendorLocation(vendor: VendorLocationFields): VendorLocation {
  const coords = formatCoords(vendor.galx, vendor.galy);
  const system: VendorLocationPart = {
    text: `${vendor.system_label ?? "Unknown system"}${coords ? ` ${coords}` : ""}`,
    colorClass: SYSTEM_COLOR_CLS,
  };

  const details: VendorLocationPart[] = [
    vendor.planet_label
      ? { text: vendor.planet_label, colorClass: PLANET_COLOR_CLS }
      : { text: "Unknown planet", colorClass: UNKNOWN_COLOR_CLS },
    vendor.city_label
      ? { text: vendor.city_label, colorClass: CITY_COLOR_CLS }
      : { text: "Unknown city", colorClass: UNKNOWN_COLOR_CLS },
    vendor.surface_x != null && vendor.surface_y != null
      ? { text: `surface (${vendor.surface_x}, ${vendor.surface_y})`, colorClass: TILE_COLOR_CLS }
      : { text: "Unknown surface tile", colorClass: UNKNOWN_COLOR_CLS },
    vendor.ground_x != null && vendor.ground_y != null
      ? { text: `ground (${vendor.ground_x}, ${vendor.ground_y})`, colorClass: TILE_COLOR_CLS }
      : { text: "Unknown ground tile", colorClass: UNKNOWN_COLOR_CLS },
  ];

  return { system, details };
}

export function galaxyDistance(
  ax: number | null | undefined,
  ay: number | null | undefined,
  bx: number | null | undefined,
  by: number | null | undefined
): number | null {
  if (ax == null || ay == null || bx == null || by == null) return null;
  return Math.hypot(ax - bx, ay - by);
}

export function formatDistance(distance: number | null): string | null {
  if (distance == null) return null;
  return `${Math.round(distance)} grid${Math.round(distance) === 1 ? "" : "s"} away`;
}
