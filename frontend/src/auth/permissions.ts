import type { SwcUser } from "../api/core/auth";
import type { BlogPost } from "../api/content/blog";

export function isAdmin(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return user.is_admin === true;
}

export function isSysadmin(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return user.is_sysadmin === true;
}

export function canAccessAdmin(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return isAdmin(user) || isSysadmin(user);
}

export function canAccessMembers(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.is_joe_member || user.is_admin || user.is_sysadmin);
}

export function canAccessIntel(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.is_intel || user.is_sysadmin);
}

export function canAccessDroidBrain(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.is_joe_member || user.is_intel || user.is_sysadmin) || canAccessPublicTools(user);
}

export function canAccessDroidBrainFull(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.is_intel || user.is_sysadmin);
}

export function canUploadToDroidBrain(user: SwcUser | null | undefined): boolean {
  return !!user;
}

export function canViewAsteroidIntel(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.can_view_asteroid_intel || user.is_admin || user.is_sysadmin);
}

export function canViewScanWindow(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.scan_window_top_left_galx != null &&
    user.scan_window_top_left_galy != null &&
    user.scan_window_bottom_right_galx != null &&
    user.scan_window_bottom_right_galy != null
  );
}

export function canAccessPayments(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.is_joe_member || user.is_admin || user.is_sysadmin);
}

export function canAccessSysadmin(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return isSysadmin(user);
}

export function canAccessCombatCalculator(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.can_access_combat_calc || user.is_admin || user.is_sysadmin);
}

export function canAccessWreckingHelperExtension(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.can_access_wrecking_helper_extension || user.is_admin || user.is_sysadmin);
}

export function canAccessFleetCommander(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.can_access_fleet_commander || user.is_admin || user.is_sysadmin);
}

export function canAccessRmBrowser(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.can_access_rm_browser || user.is_admin || user.is_sysadmin);
}

export function canAccessPublicTools(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return user.tool_access_tier === "full" || user.tool_access_tier === "public";
}

export function getToolAccessTier(user: SwcUser | null | undefined): "full" | "public" | "none" {
  if (!user) return "none";
  return user.tool_access_tier ?? "none";
}

export function canManageBlog(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.can_manage_blog || user.is_admin || user.is_sysadmin);
}

export function canDeleteBlog(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return !!(user.is_admin || user.is_sysadmin);
}

export function canEditBlogPost(
  user: SwcUser | null | undefined,
  post: BlogPost | null | undefined
): boolean {
  if (!user || !post) return false;

  if (user.is_sysadmin || user.is_admin) {
    return true;
  }

  if (!user.can_manage_blog) {
    return false;
  }

  const currentUid =
    user.swc_character_id != null ? String(user.swc_character_id) : "";
  const postUid = post.author_uid != null ? String(post.author_uid) : "";

  return currentUid !== "" && postUid !== "" && currentUid === postUid;
}
