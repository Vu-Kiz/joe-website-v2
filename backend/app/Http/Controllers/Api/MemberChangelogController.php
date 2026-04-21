<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MemberChangelogEntry;
use App\Support\Swc\Auth\Permissions;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberChangelogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $entries = MemberChangelogEntry::query()
            ->where('is_active', true)
            ->orderByDesc('released_at')
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->get();

        $visibleEntries = $entries
            ->filter(fn (MemberChangelogEntry $entry): bool => $this->isVisibleToUser($entry, $user))
            ->values()
            ->map(function (MemberChangelogEntry $entry): array {
                return [
                    'id' => $entry->id,
                    'version' => (string) $entry->version,
                    'title' => (string) $entry->title,
                    'details' => (string) $entry->details,
                    'tools' => array_values(array_filter($entry->tools ?? [], fn ($value): bool => is_string($value) && trim($value) !== '')),
                    'audiences' => array_values(array_filter($entry->audiences ?? [], fn ($value): bool => is_string($value) && trim($value) !== '')),
                    'released_at' => $entry->released_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'ok' => true,
            'data' => $visibleEntries,
        ]);
    }

    private function isVisibleToUser(MemberChangelogEntry $entry, Authenticatable $user): bool
    {
        $audiences = $entry->audiences ?? [];
        if (!is_array($audiences) || count($audiences) === 0) {
            return true;
        }

        foreach ($audiences as $audience) {
            if (!is_string($audience) || trim($audience) === '') {
                continue;
            }

            if ($this->canSeeAudience($audience, $user)) {
                return true;
            }
        }

        return false;
    }

    private function canSeeAudience(string $audience, Authenticatable $user): bool
    {
        return match ($audience) {
            'all' => true,
            'members' => Permissions::hasAny($user, ['is_joe_member', 'is_admin', 'is_sysadmin']),
            'payments' => Permissions::hasAny($user, ['is_joe_member', 'is_admin', 'is_sysadmin']),
            'droidbrain' => Permissions::hasAny($user, ['is_joe_member', 'is_intel', 'is_sysadmin']),
            'combatCalc' => Permissions::hasAny($user, ['can_access_combat_calc', 'is_admin', 'is_sysadmin']),
            'wreckingHelper' => Permissions::hasAny($user, ['can_access_wrecking_helper_extension', 'is_admin', 'is_sysadmin']),
            'jenEditor' => Permissions::hasAny($user, ['can_manage_blog', 'is_admin', 'is_sysadmin']),
            'asteroidIntel' => Permissions::hasAny($user, ['can_view_asteroid_intel', 'is_admin', 'is_sysadmin']),
            'admin' => Permissions::hasAny($user, ['is_admin', 'is_sysadmin']),
            'sysadmin' => Permissions::hasAny($user, ['is_sysadmin']),
            default => false,
        };
    }
}
