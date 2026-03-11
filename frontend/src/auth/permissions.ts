import type { SwcUser } from "../api/auth";
import type { BlogPost } from "../api/blog";

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

export function canAccessSysadmin(user: SwcUser | null | undefined): boolean {
  if (!user) return false;
  return isSysadmin(user);
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