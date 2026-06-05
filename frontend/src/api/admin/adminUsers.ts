import { apiFetch } from "../core/auth";

export type AdminUserSubscription = {
  id: number;
  plan_key: string;
  current_period_end: string | null;
};

export type AdminManageableUser = {
  id: number;
  handle: string | null;
  active_subscription?: AdminUserSubscription | null;
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
  can_access_fleet_commander: boolean;
  can_access_rm_browser: boolean;
  is_rm_browser_service_account: boolean;
  is_combat_ops_service_account: boolean;
  is_garry: boolean;
  is_raid: boolean;

  can_manage_blog: boolean;
  can_manage_tips: boolean;
  can_manage_eotm: boolean;
  factions: { id: number; name: string; abbreviation: string | null }[];
};

export type ListAdminUsersResponse = {
  ok: boolean;
  users: AdminManageableUser[];
};

export type UpdateAdminUserPermissionsPayload = {
  is_admin?: boolean;
  is_intel?: boolean;
  can_view_asteroid_intel?: boolean;
  can_access_combat_calc?: boolean;
  can_access_wrecking_helper_extension?: boolean;
  can_access_fleet_commander?: boolean;
  can_access_rm_browser?: boolean;
  is_rm_browser_service_account?: boolean;
  is_combat_ops_service_account?: boolean;
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

export type RevokeAdminUserSwcAuthorizationResponse = {
  ok: boolean;
  message: string;
  result: {
    processed: number;
    remote_attempted: number;
    remote_revoked: number;
    remote_errors: number;
    local_revoked: number;
  };
  user: {
    id: number;
    handle: string | null;
    auth_version: number;
  };
};

export type RevokeAllAdminUsersSwcAuthorizationResponse = {
  ok: boolean;
  message: string;
  result: {
    processed: number;
    remote_attempted: number;
    remote_revoked: number;
    remote_errors: number;
    local_revoked: number;
    affected_users: number;
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

export async function revokeAdminUserSwcAuthorization(
  userId: number
): Promise<RevokeAdminUserSwcAuthorizationResponse> {
  return apiFetch<RevokeAdminUserSwcAuthorizationResponse>(
    `/admin/users/${userId}/revoke-swc-authorization`,
    {
      method: "POST",
    }
  );
}

export type AdminFactionSubscription = {
  id: number;
  plan_key: string;
  faction: { id: number; name: string; abbreviation: string } | null;
  seat_count: number | null;
  seats_used: number;
  current_period_end: string | null;
  manager: { id: number; handle: string } | null;
  members: { id: number; handle: string; avatar_url: string | null }[];
};

export async function listFactionSubscriptions(): Promise<{ ok: boolean; data: AdminFactionSubscription[] }> {
  return apiFetch<{ ok: boolean; data: AdminFactionSubscription[] }>("/admin/users/faction-subscriptions");
}

export async function revokeFactionSubscription(subscriptionId: number): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>(
    `/admin/users/faction-subscriptions/${subscriptionId}/revoke`,
    { method: "POST" }
  );
}

export async function revokeAdminUserSubscription(userId: number): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>(
    `/admin/users/${userId}/revoke-subscription`,
    { method: "POST" }
  );
}

export async function revokeAllAdminUsersSwcAuthorization(): Promise<RevokeAllAdminUsersSwcAuthorizationResponse> {
  return apiFetch<RevokeAllAdminUsersSwcAuthorizationResponse>(
    `/admin/users/revoke-swc-authorization-all`,
    {
      method: "POST",
      body: JSON.stringify({
        confirm: "REVOKE_ALL_SWC_AUTH",
      }),
    }
  );
}
