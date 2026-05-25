<?php

namespace App\Http\Controllers\Api\Faction;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\ToolStore\ToolSubscription;
use App\Models\ToolStore\ToolSubscriptionMember;
use App\Models\ToolStore\ToolSubscriptionMemberRevocation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FactionConsoleController extends Controller
{
    /**
     * Resolve the active faction subscription the requesting user manages.
     * Only the activating user (whoever paid) can manage it.
     */
    private function resolveSubscription(Request $request, int $subscriptionId): ?ToolSubscription
    {
        $user = $request->user();
        if (!$user) return null;

        return ToolSubscription::query()
            ->where('id', $subscriptionId)
            ->where('subscriber_type', 'faction')
            ->where('status', 'active')
            ->where('activated_by_user_id', $user->id)
            ->first();
    }

    /**
     * GET /faction-console/{subscription}
     * Returns subscription info, seat usage, eligible members, approved members.
     */
    public function show(Request $request, int $subscriptionId): JsonResponse
    {
        $sub = $this->resolveSubscription($request, $subscriptionId);
        if (!$sub) {
            return response()->json(['ok' => false, 'message' => 'Subscription not found or access denied.'], 404);
        }

        $approvedIds = ToolSubscriptionMember::query()
            ->where('tool_subscription_id', $sub->id)
            ->pluck('user_id')
            ->all();

        $seatsUsed  = count($approvedIds);
        $seatCount  = $sub->seat_count;

        // All site users in this faction (via SWC sync)
        $factionUsers = User::query()
            ->whereHas('factions', fn ($q) => $q->where('factions.id', $sub->subscriber_id))
            ->get(['id', 'swc_handle', 'swc_avatar_url', 'swc_character_id'])
            ->map(fn (User $u) => [
                'id'               => $u->id,
                'handle'           => $u->swc_handle,
                'avatar_url'       => $u->swc_avatar_url,
                'swc_character_id' => $u->swc_character_id,
                'granted'          => in_array($u->id, $approvedIds, true),
            ]);

        return response()->json([
            'ok'   => true,
            'data' => [
                'subscription' => $this->formatSub($sub),
                'seats_used'   => $seatsUsed,
                'members'      => $factionUsers,
            ],
        ]);
    }

    /**
     * POST /faction-console/{subscription}/members/{user}
     * Grant a seat to a user.
     */
    public function grant(Request $request, int $subscriptionId, int $userId): JsonResponse
    {
        $sub = $this->resolveSubscription($request, $subscriptionId);
        if (!$sub) {
            return response()->json(['ok' => false, 'message' => 'Subscription not found or access denied.'], 404);
        }

        // Verify target user is in the faction
        $targetUser = User::query()
            ->whereHas('factions', fn ($q) => $q->where('factions.id', $sub->subscriber_id))
            ->find($userId);

        if (!$targetUser) {
            return response()->json(['ok' => false, 'message' => 'User is not a member of this faction.'], 422);
        }

        // Check seat cap
        if ($sub->seat_count !== null) {
            $seatsUsed = ToolSubscriptionMember::query()
                ->where('tool_subscription_id', $sub->id)
                ->count();

            if ($seatsUsed >= $sub->seat_count) {
                return response()->json([
                    'ok'      => false,
                    'message' => "All {$sub->seat_count} seats are in use. Revoke a seat before granting another.",
                ], 422);
            }
        }

        // 7-day cooldown after member revocation
        $recentRevoke = ToolSubscriptionMemberRevocation::query()
            ->where('tool_subscription_id', $sub->id)
            ->where('user_id', $userId)
            ->where('revoked_at', '>=', now()->subDays(7))
            ->exists();

        if ($recentRevoke) {
            return response()->json([
                'ok'      => false,
                'message' => 'This member was recently revoked. They cannot be re-granted for 7 days.',
            ], 422);
        }

        ToolSubscriptionMember::firstOrCreate([
            'tool_subscription_id' => $sub->id,
            'user_id'              => $userId,
        ]);

        return response()->json(['ok' => true, 'message' => 'Seat granted.']);
    }

    /**
     * DELETE /faction-console/{subscription}/members/{user}
     * Revoke a seat from a user.
     */
    public function revoke(Request $request, int $subscriptionId, int $userId): JsonResponse
    {
        $sub = $this->resolveSubscription($request, $subscriptionId);
        if (!$sub) {
            return response()->json(['ok' => false, 'message' => 'Subscription not found or access denied.'], 404);
        }

        ToolSubscriptionMember::query()
            ->where('tool_subscription_id', $sub->id)
            ->where('user_id', $userId)
            ->delete();

        ToolSubscriptionMemberRevocation::create([
            'tool_subscription_id' => $sub->id,
            'user_id'              => $userId,
            'revoked_at'           => now(),
        ]);

        return response()->json(['ok' => true, 'message' => 'Seat revoked.']);
    }

    /**
     * GET /faction-console — list all faction subscriptions the user manages.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $subscriptions = ToolSubscription::query()
            ->where('subscriber_type', 'faction')
            ->where('status', 'active')
            ->where('activated_by_user_id', $user->id)
            ->get()
            ->map(fn ($s) => $this->formatSub($s));

        return response()->json(['ok' => true, 'data' => $subscriptions]);
    }

    private function formatSub(ToolSubscription $sub): array
    {
        $faction = Faction::find($sub->subscriber_id);

        return [
            'id'                   => $sub->id,
            'plan_key'             => $sub->plan_key,
            'faction_id'           => $sub->subscriber_id,
            'faction_name'         => $faction?->name,
            'faction_abbreviation' => $faction?->abbreviation,
            'seat_count'           => $sub->seat_count,
            'price_paid_credits'   => $sub->price_paid_credits,
            'current_period_end'   => $sub->current_period_end?->toIso8601String(),
        ];
    }
}
