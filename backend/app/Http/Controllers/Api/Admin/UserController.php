<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SwcSectorSearchRecord;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use App\Support\Swc\SwcAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    protected function readSystemUpdaterCursor(User $user): array
    {
        $prefs = is_array($user->member_tool_preferences) ? $user->member_tool_preferences : [];
        $universe = is_array($prefs['universe'] ?? null) ? $prefs['universe'] : [];
        $updater = is_array($universe['system_updater'] ?? null) ? $universe['system_updater'] : [];

        return [
            'timestamp' => isset($updater['last_uploaded_timestamp']) && is_numeric((string) $updater['last_uploaded_timestamp'])
                ? (int) $updater['last_uploaded_timestamp']
                : null,
            'event_uid' => isset($updater['last_uploaded_event_uid']) && trim((string) $updater['last_uploaded_event_uid']) !== ''
                ? trim((string) $updater['last_uploaded_event_uid'])
                : null,
            'updated_at' => isset($updater['cursor_updated_at']) && trim((string) $updater['cursor_updated_at']) !== ''
                ? trim((string) $updater['cursor_updated_at'])
                : null,
        ];
    }

    protected function writeSystemUpdaterCursor(User $user, ?int $timestamp, ?string $eventUid): array
    {
        $prefs = is_array($user->member_tool_preferences) ? $user->member_tool_preferences : [];
        $universe = is_array($prefs['universe'] ?? null) ? $prefs['universe'] : [];
        $updater = is_array($universe['system_updater'] ?? null) ? $universe['system_updater'] : [];

        $updater['last_uploaded_timestamp'] = $timestamp;
        $updater['last_uploaded_event_uid'] = $eventUid !== null ? trim($eventUid) : null;
        $updater['cursor_updated_at'] = now()->toIso8601String();
        $universe['system_updater'] = $updater;
        $prefs['universe'] = $universe;

        $user->member_tool_preferences = $prefs;
        $user->save();
        $user->refresh();

        return $this->readSystemUpdaterCursor($user);
    }

    protected function resolveDisplayHandle(User $user): string
    {
        $candidates = [
            $user->swc_handle,
            $user->discord_global_name,
            $user->discord_username,
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return 'User #' . $user->id;
    }

    protected function resolveImportActorHandle(User $user): ?string
    {
        $value = trim((string) (
            $user->swc_handle
            ?? $user->discord_global_name
            ?? $user->discord_username
            ?? ''
        ));

        return $value !== '' ? $value : null;
    }

    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->orderByRaw('COALESCE(swc_handle, "") asc')
            ->get([
                'id',
                'swc_handle',
                'swc_character_id',
                'swc_avatar_url',
                'discord_username',
                'discord_global_name',
                'discord_avatar_url',
                'is_joe_member',
                'is_admin',
                'is_sysadmin',
                'is_intel',
                'can_view_asteroid_intel',
                'can_access_combat_calc',
                'can_access_wrecking_helper_extension',
                'scan_window_top_left_galx',
                'scan_window_top_left_galy',
                'scan_window_bottom_right_galx',
                'scan_window_bottom_right_galy',
                'is_garry',
                'is_raid',
                'can_manage_blog',
                'can_manage_tips',
                'can_manage_eotm',
            ])
            ->map(function (User $user) {
                return [
                    'id'               => $user->id,
                    'handle'           => $this->resolveDisplayHandle($user),
                    'swc_handle'       => $user->swc_handle,
                    'swc_character_id' => $user->swc_character_id,
                    'swc_avatar_url'   => $user->swc_avatar_url ?: $user->discord_avatar_url,
                    'discord_username' => $user->discord_username,
                    'discord_global_name' => $user->discord_global_name,
                    'is_joe_member'    => (bool) $user->is_joe_member,
                    'is_admin'         => (bool) $user->is_admin,
                    'is_sysadmin'      => (bool) $user->is_sysadmin,
                    'is_intel'         => (bool) $user->is_intel,
                    'can_view_asteroid_intel' => (bool) $user->can_view_asteroid_intel,
                    'can_access_combat_calc' => (bool) $user->can_access_combat_calc,
                    'can_access_wrecking_helper_extension' => (bool) $user->can_access_wrecking_helper_extension,
                    'scan_window_top_left_galx' => $user->scan_window_top_left_galx,
                    'scan_window_top_left_galy' => $user->scan_window_top_left_galy,
                    'scan_window_bottom_right_galx' => $user->scan_window_bottom_right_galx,
                    'scan_window_bottom_right_galy' => $user->scan_window_bottom_right_galy,
                    'is_garry'         => (bool) $user->is_garry,
                    'is_raid'          => (bool) $user->is_raid,
                    'can_manage_blog'  => (bool) $user->can_manage_blog,
                    'can_manage_tips'  => (bool) $user->can_manage_tips,
                    'can_manage_eotm'  => (bool) $user->can_manage_eotm,
                ];
            })
            ->values();

        return response()->json([
            'ok' => true,
            'users' => $users,
        ]);
    }

    public function updatePermissions(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();

        $validated = $request->validate([
            'is_admin'        => ['sometimes', 'boolean'],
            'can_view_asteroid_intel' => ['sometimes', 'boolean'],
            'can_access_combat_calc' => ['sometimes', 'boolean'],
            'can_access_wrecking_helper_extension' => ['sometimes', 'boolean'],
            'scan_window_top_left_galx' => ['sometimes', 'nullable', 'integer'],
            'scan_window_top_left_galy' => ['sometimes', 'nullable', 'integer'],
            'scan_window_bottom_right_galx' => ['sometimes', 'nullable', 'integer'],
            'scan_window_bottom_right_galy' => ['sometimes', 'nullable', 'integer'],
            'can_manage_blog' => ['sometimes', 'boolean'],
            'can_manage_tips' => ['sometimes', 'boolean'],
            'can_manage_eotm' => ['sometimes', 'boolean'],
        ]);

        if (
            $actor &&
            $actor->id === $user->id &&
            array_key_exists('is_admin', $validated) &&
            !$validated['is_admin']
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'You cannot remove your own admin access.',
            ], 422);
        }

        $beforeAll = [
            'is_admin'        => (bool) $user->is_admin,
            'can_view_asteroid_intel' => (bool) $user->can_view_asteroid_intel,
            'can_access_combat_calc' => (bool) $user->can_access_combat_calc,
            'can_access_wrecking_helper_extension' => (bool) $user->can_access_wrecking_helper_extension,
            'scan_window_top_left_galx' => $user->scan_window_top_left_galx,
            'scan_window_top_left_galy' => $user->scan_window_top_left_galy,
            'scan_window_bottom_right_galx' => $user->scan_window_bottom_right_galx,
            'scan_window_bottom_right_galy' => $user->scan_window_bottom_right_galy,
            'can_manage_blog' => (bool) $user->can_manage_blog,
            'can_manage_tips' => (bool) $user->can_manage_tips,
            'can_manage_eotm' => (bool) $user->can_manage_eotm,
        ];

        if (array_key_exists('is_admin', $validated)) {
            $user->is_admin = (bool) $validated['is_admin'];
        }

        if (array_key_exists('can_view_asteroid_intel', $validated)) {
            $user->can_view_asteroid_intel = (bool) $validated['can_view_asteroid_intel'];
        }

        if (array_key_exists('can_access_combat_calc', $validated)) {
            $user->can_access_combat_calc = (bool) $validated['can_access_combat_calc'];
        }

        if (array_key_exists('can_access_wrecking_helper_extension', $validated)) {
            $user->can_access_wrecking_helper_extension = (bool) $validated['can_access_wrecking_helper_extension'];
        }

        if (array_key_exists('scan_window_top_left_galx', $validated)) {
            $user->scan_window_top_left_galx = $validated['scan_window_top_left_galx'];
        }

        if (array_key_exists('scan_window_top_left_galy', $validated)) {
            $user->scan_window_top_left_galy = $validated['scan_window_top_left_galy'];
        }

        if (array_key_exists('scan_window_bottom_right_galx', $validated)) {
            $user->scan_window_bottom_right_galx = $validated['scan_window_bottom_right_galx'];
        }

        if (array_key_exists('scan_window_bottom_right_galy', $validated)) {
            $user->scan_window_bottom_right_galy = $validated['scan_window_bottom_right_galy'];
        }

        if (array_key_exists('can_manage_blog', $validated)) {
            $user->can_manage_blog = (bool) $validated['can_manage_blog'];
        }

        if (array_key_exists('can_manage_tips', $validated)) {
            $user->can_manage_tips = (bool) $validated['can_manage_tips'];
        }

        if (array_key_exists('can_manage_eotm', $validated)) {
            $user->can_manage_eotm = (bool) $validated['can_manage_eotm'];
        }

        $user->save();
        $user->refresh();

        $afterAll = [
            'is_admin'        => (bool) $user->is_admin,
            'can_view_asteroid_intel' => (bool) $user->can_view_asteroid_intel,
            'can_access_combat_calc' => (bool) $user->can_access_combat_calc,
            'can_access_wrecking_helper_extension' => (bool) $user->can_access_wrecking_helper_extension,
            'scan_window_top_left_galx' => $user->scan_window_top_left_galx,
            'scan_window_top_left_galy' => $user->scan_window_top_left_galy,
            'scan_window_bottom_right_galx' => $user->scan_window_bottom_right_galx,
            'scan_window_bottom_right_galy' => $user->scan_window_bottom_right_galy,
            'can_manage_blog' => (bool) $user->can_manage_blog,
            'can_manage_tips' => (bool) $user->can_manage_tips,
            'can_manage_eotm' => (bool) $user->can_manage_eotm,
        ];

        $before = [];
        $after = [];

        foreach ($afterAll as $key => $value) {
            if (($beforeAll[$key] ?? null) !== $value) {
                $before[$key] = $beforeAll[$key] ?? null;
                $after[$key] = $value;
            }
        }

        if ($after !== []) {
            AdminActionLogger::log(
                $request,
                'users',
                'update_permissions',
                'Updated user permissions for ' . $this->resolveDisplayHandle($user),
                'user',
                $user->id,
                $before,
                $after
            );

            $user->invalidateActiveSessions();
            $user->refresh();
        }

        return response()->json([
            'ok' => true,
            'user' => [
                'id'               => $user->id,
                'handle'           => $this->resolveDisplayHandle($user),
                'swc_handle'       => $user->swc_handle,
                'swc_character_id' => $user->swc_character_id,
                'swc_avatar_url'   => $user->swc_avatar_url ?: $user->discord_avatar_url,
                'auth_version'     => $user->auth_version,
                'discord_username' => $user->discord_username,
                'discord_global_name' => $user->discord_global_name,
                'is_joe_member'    => (bool) $user->is_joe_member,
                'is_admin'         => (bool) $user->is_admin,
                'is_sysadmin'      => (bool) $user->is_sysadmin,
                'is_intel'         => (bool) $user->is_intel,
                'can_view_asteroid_intel' => (bool) $user->can_view_asteroid_intel,
                'can_access_combat_calc' => (bool) $user->can_access_combat_calc,
                'can_access_wrecking_helper_extension' => (bool) $user->can_access_wrecking_helper_extension,
                'scan_window_top_left_galx' => $user->scan_window_top_left_galx,
                'scan_window_top_left_galy' => $user->scan_window_top_left_galy,
                'scan_window_bottom_right_galx' => $user->scan_window_bottom_right_galx,
                'scan_window_bottom_right_galy' => $user->scan_window_bottom_right_galy,
                'is_garry'         => (bool) $user->is_garry,
                'is_raid'          => (bool) $user->is_raid,
                'can_manage_blog'  => (bool) $user->can_manage_blog,
                'can_manage_tips'  => (bool) $user->can_manage_tips,
                'can_manage_eotm'  => (bool) $user->can_manage_eotm,
            ],
        ]);
    }

    public function forceLogout(Request $request, User $user): JsonResponse
    {
        $user->invalidateActiveSessions();
        $user->refresh();

        AdminActionLogger::log(
            $request,
            'users',
            'force_logout',
            'Forced logout for ' . $this->resolveDisplayHandle($user),
            'user',
            $user->id,
            null,
            [
                'auth_version' => $user->auth_version,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'User sessions have been invalidated. They will need to log in again.',
            'user' => [
                'id' => $user->id,
                'handle' => $this->resolveDisplayHandle($user),
                'auth_version' => $user->auth_version,
            ],
        ]);
    }

    public function resetSystemUpdaterCursor(Request $request, User $user): JsonResponse
    {
        $before = $this->readSystemUpdaterCursor($user);
        $after = $this->writeSystemUpdaterCursor($user, null, null);

        AdminActionLogger::log(
            $request,
            'users',
            'reset_system_updater_cursor',
            'Reset system updater cursor for ' . $this->resolveDisplayHandle($user),
            'user',
            $user->id,
            [
                'system_updater_cursor' => $before,
            ],
            [
                'system_updater_cursor' => $after,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'System updater cursor reset.',
            'user' => [
                'id' => $user->id,
                'handle' => $this->resolveDisplayHandle($user),
            ],
            'cursor' => [
                'before' => $before,
                'after' => $after,
            ],
        ]);
    }

    public function fullResetSystemUpdater(Request $request, User $user): JsonResponse
    {
        $handle = $this->resolveImportActorHandle($user);
        $beforeCursor = $this->readSystemUpdaterCursor($user);

        $clearedLegacyLinks = 0;
        if ($handle !== null) {
            $clearedLegacyLinks = SwcSectorSearchRecord::query()
                ->where('legacy_handle', $handle)
                ->update([
                    'legacy_handle' => null,
                    'legacy_player' => null,
                ]);
        }

        // Use timestamp=0 so import logic skips fallback cutoff behavior.
        $afterCursor = $this->writeSystemUpdaterCursor($user, 0, null);

        AdminActionLogger::log(
            $request,
            'users',
            'full_reset_system_updater',
            'Full reset system updater for ' . $this->resolveDisplayHandle($user),
            'user',
            $user->id,
            [
                'system_updater_cursor' => $beforeCursor,
                'legacy_handle' => $handle,
            ],
            [
                'system_updater_cursor' => $afterCursor,
                'legacy_links_cleared' => $clearedLegacyLinks,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'System updater fully reset. Map data was preserved.',
            'user' => [
                'id' => $user->id,
                'handle' => $this->resolveDisplayHandle($user),
            ],
            'cursor' => [
                'before' => $beforeCursor,
                'after' => $afterCursor,
            ],
            'legacy' => [
                'handle' => $handle,
                'links_cleared' => $clearedLegacyLinks,
            ],
        ]);
    }

    public function revokeSwcAuthorization(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();

        if (!$actor || !(bool) $actor->is_sysadmin) {
            return response()->json([
                'ok' => false,
                'message' => 'Only sysadmins can revoke SWC authorizations.',
            ], 403);
        }

        $result = $this->swcAuthorizationService->revokeAuthorizationsForUser($user, true);
        $user->invalidateActiveSessions();
        $user->refresh();

        AdminActionLogger::log(
            $request,
            'users',
            'revoke_swc_authorization',
            'Revoked SWC authorizations for ' . $this->resolveDisplayHandle($user),
            'user',
            $user->id,
            null,
            [
                'processed' => $result['processed'],
                'remote_attempted' => $result['remote_attempted'],
                'remote_revoked' => $result['remote_revoked'],
                'remote_errors' => $result['remote_errors'],
                'local_revoked' => $result['local_revoked'],
                'auth_version' => $user->auth_version,
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'SWC authorization revoked. User must reconnect Chain Code Verification.',
            'result' => [
                'processed' => $result['processed'],
                'remote_attempted' => $result['remote_attempted'],
                'remote_revoked' => $result['remote_revoked'],
                'remote_errors' => $result['remote_errors'],
                'local_revoked' => $result['local_revoked'],
            ],
            'user' => [
                'id' => $user->id,
                'handle' => $this->resolveDisplayHandle($user),
                'auth_version' => $user->auth_version,
            ],
        ]);
    }

    public function revokeAllSwcAuthorizations(Request $request): JsonResponse
    {
        $actor = $request->user();

        if (!$actor || !(bool) $actor->is_sysadmin) {
            return response()->json([
                'ok' => false,
                'message' => 'Only sysadmins can revoke all SWC authorizations.',
            ], 403);
        }

        $validated = $request->validate([
            'confirm' => ['required', 'string', 'in:REVOKE_ALL_SWC_AUTH'],
        ]);

        if (($validated['confirm'] ?? '') !== 'REVOKE_ALL_SWC_AUTH') {
            return response()->json([
                'ok' => false,
                'message' => 'Confirmation token is invalid.',
            ], 422);
        }

        $result = $this->swcAuthorizationService->revokeAllAuthorizations(true);

        $affectedUserIds = collect($result['details'] ?? [])
            ->pluck('user_id')
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($affectedUserIds !== []) {
            User::query()
                ->whereIn('id', $affectedUserIds)
                ->get()
                ->each(function (User $user): void {
                    $user->invalidateActiveSessions();
                });
        }

        AdminActionLogger::log(
            $request,
            'users',
            'revoke_all_swc_authorizations',
            'Revoked all SWC authorizations.',
            'swc_authorization',
            null,
            null,
            [
                'processed' => $result['processed'],
                'remote_attempted' => $result['remote_attempted'],
                'remote_revoked' => $result['remote_revoked'],
                'remote_errors' => $result['remote_errors'],
                'local_revoked' => $result['local_revoked'],
                'affected_users' => count($affectedUserIds),
            ]
        );

        return response()->json([
            'ok' => true,
            'message' => 'All SWC authorizations revoked. Users must reconnect Chain Code Verification.',
            'result' => [
                'processed' => $result['processed'],
                'remote_attempted' => $result['remote_attempted'],
                'remote_revoked' => $result['remote_revoked'],
                'remote_errors' => $result['remote_errors'],
                'local_revoked' => $result['local_revoked'],
                'affected_users' => count($affectedUserIds),
            ],
        ]);
    }
}
