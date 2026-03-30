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
