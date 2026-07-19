export type MarketTab = "browse" | "my_listings" | "my_orders" | "post" | "vendor" | "vendor_directory" | "vendor_owners" | "vendor_hubs";

export const MARKET_TABS: MarketTab[] = ["browse", "my_listings", "my_orders", "post", "vendor", "vendor_directory", "vendor_owners", "vendor_hubs"];

export type MarketSection = "market" | "vendors";

export const VENDOR_TABS: MarketTab[] = ["vendor", "vendor_directory", "vendor_owners", "vendor_hubs"];

export function sectionForTab(tab: MarketTab): MarketSection {
  return VENDOR_TABS.includes(tab) ? "vendors" : "market";
}

export function defaultTabForSection(section: MarketSection): MarketTab {
  return section === "vendors" ? "vendor" : "browse";
}
