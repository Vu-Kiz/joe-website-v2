<?php

namespace App\Http\Controllers\Api\Universe;

use App\Http\Controllers\Controller;
use App\Models\SubscriberCellRecord;
use App\Models\ToolStore\ToolSubscription;
use App\Models\ToolStore\ToolSubscriptionMember;
use App\Support\ToolStore\ToolAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriberCellRecordController extends Controller
{
    public function __construct(protected ToolAccessService $toolAccessService)
    {
    }

    /**
     * Resolve the owner (type + id) for the requesting user's active subscription.
     * Individual sub → owner_type=user, owner_id=user->id
     * Faction sub    → owner_type=faction, owner_id=faction_subscription->subscriber_id
     */
    private function resolveOwner(Request $request): array|null
    {
        $user = $request->user();
        if (!$user) return null;

        $sub = $this->toolAccessService->activeSubscriptionFor($user);

        if ($sub) {
            if ($sub->subscriber_type === 'user') {
                return ['type' => 'user', 'id' => $user->id];
            }
            if ($sub->subscriber_type === 'faction') {
                return ['type' => 'faction', 'id' => $sub->subscriber_id];
            }
        }

        // Admins/sysadmins testing via force_subscriber_tier have no real sub row — scope to user.
        if ($user->force_subscriber_tier) {
            return ['type' => 'user', 'id' => $user->id];
        }

        return null;
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $records = SubscriberCellRecord::query()
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'ok'   => true,
            'data' => $records->map(fn ($r) => $this->format($r)),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $owner = $this->resolveOwner($request);
        if (!$owner) {
            return response()->json(['ok' => true, 'data' => []]);
        }

        $records = SubscriberCellRecord::query()
            ->where('owner_type', $owner['type'])
            ->where('owner_id', $owner['id'])
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'ok'   => true,
            'data' => $records->map(fn ($r) => $this->format($r)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $owner = $this->resolveOwner($request);
        if (!$owner) {
            return response()->json(['ok' => false, 'message' => 'No active subscription found.'], 403);
        }

        $data = $request->validate([
            'galx'              => ['required', 'integer'],
            'galy'              => ['required', 'integer'],
            'sector_uid'        => ['nullable', 'string', 'max:32'],
            'square_name'       => ['nullable', 'string', 'max:64'],
            'is_system_searched'=> ['sometimes', 'boolean'],
            'has_asteroids'     => ['sometimes', 'boolean'],
            'planetoids_checked'=> ['nullable', 'boolean'],
            'planetoid_1_size'  => ['nullable', 'string', 'in:1x1,2x2'],
            'planetoid_2_size'  => ['nullable', 'string', 'in:1x1,2x2'],
            'has_ships'         => ['nullable', 'boolean'],
            'has_stations'      => ['nullable', 'boolean'],
        ]);

        $record = SubscriberCellRecord::updateOrCreate(
            [
                'owner_type' => $owner['type'],
                'owner_id'   => $owner['id'],
                'galx'       => $data['galx'],
                'galy'       => $data['galy'],
            ],
            array_merge($data, ['updated_by_user_id' => $request->user()->id])
        );

        return response()->json([
            'ok'   => true,
            'data' => $this->format($record),
        ]);
    }

    private function format(SubscriberCellRecord $r): array
    {
        return [
            'id'                 => $r->id,
            'sector_uid'         => $r->sector_uid,
            'galx'               => $r->galx,
            'galy'               => $r->galy,
            'square_name'        => $r->square_name,
            'is_system_searched' => $r->is_system_searched,
            'has_asteroids'      => $r->has_asteroids,
            'planetoids_checked' => $r->planetoids_checked,
            'planetoid_1_type'   => null,
            'planetoid_1_size'   => $r->planetoid_1_size,
            'planetoid_2_type'   => null,
            'planetoid_2_size'   => $r->planetoid_2_size,
            'has_ships'          => $r->has_ships,
            'has_stations'       => $r->has_stations,
            'legacy_note'        => null,
            'legacy_recorded_at' => null,
            'rescan_due_at'      => null,
            'is_rescan_due'      => false,
            'legacy_player'      => null,
            'legacy_icon'        => null,
            'handle'             => null,
            'legacy_tag'         => null,
            'legacy_read'        => false,
            'updated_at'         => $r->updated_at?->toIso8601String(),
        ];
    }
}
