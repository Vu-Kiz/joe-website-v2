import { apiFetch } from "./auth";

export type AdminManageableUser = {
  id: number;
  handle: string | null;
  swc_handle?: string | null;
  swc_character_id?: number | string | null;
  swc_avatar_url?: string | null;
  discord_username?: string | null;
  discord_global_name?: string | null;
  scan_window_top_left_galx?: number | null;
  scan_window_top_left_galy?: number | null;
  scan_window_bottom_right_galx?: number | null;
  scan_window_bottom_right_galy?: number | null;

  is_joe_member: boolean;
  is_admin: boolean;
  is_sysadmin: boolean;
  is_intel: boolean;
  can_view_asteroid_intel: boolean;
  can_access_combat_calc: boolean;
  can_access_wrecking_helper_extension: boolean;
  is_garry: boolean;
  is_raid: boolean;

  can_manage_blog: boolean;
  can_manage_tips: boolean;
  can_manage_eotm: boolean;
};

export type ListAdminUsersResponse = {
  ok: boolean;
  users: AdminManageableUser[];
};

export type UpdateAdminUserPermissionsPayload = {
  is_admin?: boolean;
  can_view_asteroid_intel?: boolean;
  can_access_combat_calc?: boolean;
  can_access_wrecking_helper_extension?: boolean;
  scan_window_top_left_galx?: number | null;
  scan_window_top_left_galy?: number | null;
  scan_window_bottom_right_galx?: number | null;
  scan_window_bottom_right_galy?: number | null;
  can_manage_blog?: boolean;
};

export type UpdateAdminUserPermissionsResponse = {
  ok: boolean;
  user: AdminManageableUser;
};

export type ForceAdminUserLogoutResponse = {
  ok: boolean;
  message: string;
  user: {
    id: number;
    handle: string | null;
    auth_version: number;
  };
};

export type ResetAdminUserSystemUpdaterCursorResponse = {
  ok: boolean;
  message: string;
  user: {
    id: number;
    handle: string | null;
  };
  cursor: {
    before: {
      timestamp: number | null;
      event_uid: string | null;
      updated_at?: string | null;
    };
    after: {
      timestamp: number | null;
      event_uid: string | null;
      updated_at?: string | null;
    };
  };
};

export type FullResetAdminUserSystemUpdaterResponse = {
  ok: boolean;
  message: string;
  user: {
    id: number;
    handle: string | null;
  };
  cursor: {
    before: {
      timestamp: number | null;
      event_uid: string | null;
      updated_at?: string | null;
    };
    after: {
      timestamp: number | null;
      event_uid: string | null;
      updated_at?: string | null;
    };
  };
  legacy: {
    handle: string | null;
    links_cleared: number;
  };
};

export async function listAdminUsers(): Promise<ListAdminUsersResponse> {
  return apiFetch<ListAdminUsersResponse>("/admin/users", {
    method: "GET",
  });
}

export async function updateAdminUserPermissions(
  userId: number,
  payload: UpdateAdminUserPermissionsPayload
): Promise<UpdateAdminUserPermissionsResponse> {
  return apiFetch<UpdateAdminUserPermissionsResponse>(
    `/admin/users/${userId}/permissions`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function forceAdminUserLogout(
  userId: number
): Promise<ForceAdminUserLogoutResponse> {
  return apiFetch<ForceAdminUserLogoutResponse>(
    `/admin/users/${userId}/force-logout`,
    {
      method: "POST",
    }
  );
}

export async function resetAdminUserSystemUpdaterCursor(
  userId: number
): Promise<ResetAdminUserSystemUpdaterCursorResponse> {
  return apiFetch<ResetAdminUserSystemUpdaterCursorResponse>(
    `/admin/users/${userId}/reset-system-updater-cursor`,
    {
      method: "POST",
    }
  );
}

export async function fullResetAdminUserSystemUpdater(
  userId: number
): Promise<FullResetAdminUserSystemUpdaterResponse> {
  return apiFetch<FullResetAdminUserSystemUpdaterResponse>(
    `/admin/users/${userId}/full-reset-system-updater`,
    {
      method: "POST",
    }
  );
}
