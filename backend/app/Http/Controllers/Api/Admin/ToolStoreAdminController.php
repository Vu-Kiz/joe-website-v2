<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\ToolStore\ToolSubscription;
use App\Models\ToolStore\ToolSubscriptionFactionDeal;
use App\Models\ToolStore\ToolSubscriptionMember;
use App\Models\ToolStore\ToolSubscriptionPlan;
use App\Models\ToolStore\ToolSubscriptionPlanSeatTier;
use App\Models\User;
use App\Support\Admin\AdminActionLogger;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ToolStoreAdminController extends Controller
{
    // -------------------------------------------------------------------------
    // Plans
    // -------------------------------------------------------------------------

    public function indexPlans(): JsonResponse
    {
        $plans = ToolSubscriptionPlan::query()
            ->orderBy('id')
            ->with('updatedBy:id,swc_handle')
            ->get();

        $publicTools = collect(config('tools.tools'))
            ->filter(fn ($t) => $t['public'])
            ->values();

        $tiers = ToolSubscriptionPlanSeatTier::query()
            ->orderBy('plan_key')
            ->orderBy('min_seats')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => [
                'plans'        => $plans->map(fn ($p) => $this->formatPlan($p)),
                'public_tools' => $publicTools,
                'seat_tiers'   => $tiers->map(fn ($t) => $this->formatTier($t)),
            ],
        ]);
    }

    public function updatePlan(Request $request, string $key): JsonResponse
    {
        $plan = ToolSubscriptionPlan::query()->where('key', $key)->firstOrFail();

        $data = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'max:128'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'monthly_price_credits' => ['sometimes', 'required', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);

        $before = $plan->toArray();

        $data['updated_by_user_id'] = $request->user()->id;
        $plan->update($data);
        $plan->load('updatedBy:id,swc_handle');

        AdminActionLogger::log(
            $request,
            'tool_store',
            'update_plan',
            "Updated tool subscription plan: {$plan->key}",
            'tool_subscription_plan',
            $plan->id,
            $before,
            $plan->toArray()
        );

        return response()->json([
            'ok' => true,
            'data' => $this->formatPlan($plan),
        ]);
    }

    // -------------------------------------------------------------------------
    // Seat tiers
    // -------------------------------------------------------------------------

    public function storeTier(Request $request): JsonResponse
    {
        $planKeys = ToolSubscriptionPlan::query()->pluck('key')->toArray();

        $data = $request->validate([
            'plan_key'               => ['required', 'string', Rule::in($planKeys)],
            'min_seats'              => ['required', 'integer', 'min:1'],
            'price_per_seat_credits' => ['required', 'integer', 'min:0'],
        ]);

        $existing = ToolSubscriptionPlanSeatTier::query()
            ->where('plan_key', $data['plan_key'])
            ->where('min_seats', $data['min_seats'])
            ->first();

        if ($existing) {
            return response()->json([
                'ok' => false,
                'message' => 'A tier for this plan and seat count already exists.',
            ], 422);
        }

        $tier = ToolSubscriptionPlanSeatTier::create($data);

        AdminActionLogger::log(
            $request,
            'tool_store',
            'create_seat_tier',
            "Created seat tier: {$tier->plan_key} — {$tier->min_seats}+ seats",
            'tool_subscription_plan_seat_tier',
            $tier->id,
            null,
            $tier->toArray()
        );

        return response()->json(['ok' => true, 'data' => $this->formatTier($tier)], 201);
    }

    public function updateTier(Request $request, int $id): JsonResponse
    {
        $tier = ToolSubscriptionPlanSeatTier::query()->findOrFail($id);

        $data = $request->validate([
            'price_per_seat_credits' => ['required', 'integer', 'min:0'],
        ]);

        $before = $tier->toArray();
        $tier->update($data);

        AdminActionLogger::log(
            $request,
            'tool_store',
            'update_seat_tier',
            "Updated seat tier: {$tier->plan_key} — {$tier->min_seats}+ seats",
            'tool_subscription_plan_seat_tier',
            $tier->id,
            $before,
            $tier->toArray()
        );

        return response()->json(['ok' => true, 'data' => $this->formatTier($tier)]);
    }

    public function destroyTier(Request $request, int $id): JsonResponse
    {
        $tier = ToolSubscriptionPlanSeatTier::query()->findOrFail($id);
        $snapshot = $tier->toArray();

        AdminActionLogger::log(
            $request,
            'tool_store',
            'delete_seat_tier',
            "Deleted seat tier: {$tier->plan_key} — {$tier->min_seats}+ seats",
            'tool_subscription_plan_seat_tier',
            $tier->id,
            $snapshot,
            null
        );

        $tier->delete();

        return response()->json(['ok' => true]);
    }

    // -------------------------------------------------------------------------
    // Faction deals
    // -------------------------------------------------------------------------

    public function indexDeals(): JsonResponse
    {
        $deals = ToolSubscriptionFactionDeal::query()
            ->with(['faction:id,name,abbreviation', 'setBy:id,swc_handle'])
            ->orderByDesc('updated_at')
            ->get();

        $factions = Faction::query()
            ->orderBy('name')
            ->get(['id', 'name', 'abbreviation']);

        $planKeys = ToolSubscriptionPlan::query()
            ->orderBy('id')
            ->pluck('label', 'key');

        return response()->json([
            'ok' => true,
            'data' => [
                'deals' => $deals->map(fn ($d) => $this->formatDeal($d)),
                'factions' => $factions,
                'plan_keys' => $planKeys,
            ],
        ]);
    }

    public function storeDeal(Request $request): JsonResponse
    {
        $planKeys = ToolSubscriptionPlan::query()->pluck('key')->toArray();

        $data = $request->validate([
            'faction_id'             => ['required', 'integer', Rule::exists('factions', 'id')],
            'plan_key'               => ['required', 'string', Rule::in($planKeys)],
            'override_price_credits' => ['nullable', 'integer', 'min:0'],
            'per_seat_price_credits' => ['nullable', 'integer', 'min:0'],
            'max_seats'              => ['nullable', 'integer', 'min:1'],
            'notes'                  => ['nullable', 'string', 'max:500'],
        ]);

        if (empty($data['override_price_credits']) && empty($data['per_seat_price_credits'])) {
            return response()->json([
                'ok' => false,
                'message' => 'Either a flat price or a per-seat price is required.',
            ], 422);
        }
        if (!empty($data['override_price_credits']) && !empty($data['per_seat_price_credits'])) {
            return response()->json([
                'ok' => false,
                'message' => 'Set either a flat price or a per-seat price, not both.',
            ], 422);
        }

        $existing = ToolSubscriptionFactionDeal::query()
            ->where('faction_id', $data['faction_id'])
            ->where('plan_key', $data['plan_key'])
            ->first();

        if ($existing) {
            return response()->json([
                'ok' => false,
                'message' => 'A deal for this faction and plan already exists. Edit the existing deal instead.',
            ], 422);
        }

        $data['set_by_user_id'] = $request->user()->id;
        $deal = ToolSubscriptionFactionDeal::create($data);
        $deal->load(['faction:id,name,abbreviation', 'setBy:id,swc_handle']);

        AdminActionLogger::log(
            $request,
            'tool_store',
            'create_faction_deal',
            "Created faction deal: {$deal->faction->name} — {$deal->plan_key}",
            'tool_subscription_faction_deal',
            $deal->id,
            null,
            $deal->toArray()
        );

        return response()->json([
            'ok' => true,
            'data' => $this->formatDeal($deal),
        ], 201);
    }

    public function updateDeal(Request $request, int $id): JsonResponse
    {
        $deal = ToolSubscriptionFactionDeal::query()->findOrFail($id);

        $data = $request->validate([
            'override_price_credits' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'per_seat_price_credits' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'max_seats'              => ['sometimes', 'nullable', 'integer', 'min:1'],
            'notes'                  => ['sometimes', 'nullable', 'string', 'max:500'],
        ]);

        $before = $deal->toArray();
        $data['set_by_user_id'] = $request->user()->id;
        $deal->update($data);
        $deal->load(['faction:id,name,abbreviation', 'setBy:id,swc_handle']);

        AdminActionLogger::log(
            $request,
            'tool_store',
            'update_faction_deal',
            "Updated faction deal: {$deal->faction->name} — {$deal->plan_key}",
            'tool_subscription_faction_deal',
            $deal->id,
            $before,
            $deal->toArray()
        );

        return response()->json([
            'ok' => true,
            'data' => $this->formatDeal($deal),
        ]);
    }

    public function destroyDeal(Request $request, int $id): JsonResponse
    {
        $deal = ToolSubscriptionFactionDeal::query()
            ->with('faction:id,name')
            ->findOrFail($id);

        $snapshot = $deal->toArray();

        AdminActionLogger::log(
            $request,
            'tool_store',
            'delete_faction_deal',
            "Deleted faction deal: {$deal->faction->name} — {$deal->plan_key}",
            'tool_subscription_faction_deal',
            $deal->id,
            $snapshot,
            null
        );

        $deal->delete();

        return response()->json(['ok' => true]);
    }

    // -------------------------------------------------------------------------
    // Manual grant (testing / comped access)
    // -------------------------------------------------------------------------

    public function toggleSubscriberPreview(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->force_subscriber_tier = !$user->force_subscriber_tier;
        $user->save();

        return response()->json([
            'ok'   => true,
            'data' => ['force_subscriber_tier' => $user->force_subscriber_tier],
        ]);
    }

    public function toggleLockJoeFlags(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->lock_joe_flags = !$user->lock_joe_flags;
        $user->save();

        return response()->json([
            'ok'   => true,
            'data' => ['lock_joe_flags' => $user->lock_joe_flags],
        ]);
    }

    public function searchUsers(Request $request): JsonResponse
    {
        $q = trim($request->query('q', ''));

        if (strlen($q) < 2) {
            return response()->json(['ok' => true, 'data' => []]);
        }

        $users = User::where('swc_handle', 'like', $q . '%')
            ->orderBy('swc_handle')
            ->limit(10)
            ->get(['id', 'swc_handle']);

        return response()->json([
            'ok'   => true,
            'data' => $users->map(fn ($u) => ['id' => $u->id, 'swc_handle' => $u->swc_handle]),
        ]);
    }

    public function grantSubscription(Request $request): JsonResponse
    {
        $planKeys = ToolSubscriptionPlan::query()->pluck('key')->toArray();

        $data = $request->validate([
            'user_id'  => ['required', 'integer', Rule::exists('users', 'id')],
            'plan_key' => ['required', 'string', Rule::in($planKeys)],
            'months'   => ['required', 'integer', 'min:1', 'max:24'],
        ]);

        $user = User::findOrFail($data['user_id']);

        $now      = Carbon::now();
        $existing = ToolSubscription::where('subscriber_type', 'user')
            ->where('subscriber_id', $user->id)
            ->where('status', 'active')
            ->first();

        if ($existing) {
            $existing->update([
                'plan_key'           => $data['plan_key'],
                'current_period_end' => $now->copy()->addMonths($data['months']),
            ]);
            $sub = $existing->fresh();
        } else {
            $sub = ToolSubscription::create([
                'subscriber_type'      => 'user',
                'subscriber_id'        => $user->id,
                'plan_key'             => $data['plan_key'],
                'status'               => 'active',
                'price_paid_credits'   => 0,
                'current_period_start' => $now,
                'current_period_end'   => $now->copy()->addMonths($data['months']),
                'activated_by_user_id' => $request->user()->id,
                'meta'                 => ['granted_manually' => true, 'granted_by' => $request->user()->swc_handle],
            ]);
        }

        AdminActionLogger::log(
            $request,
            'tool_store',
            'manual_grant',
            "Manually granted '{$data['plan_key']}' subscription to {$user->swc_handle} for {$data['months']} month(s)",
            'tool_subscription',
            $sub->id,
            null,
            $sub->toArray()
        );

        return response()->json([
            'ok'   => true,
            'data' => [
                'user'               => ['id' => $user->id, 'swc_handle' => $user->swc_handle],
                'plan_key'           => $sub->plan_key,
                'status'             => $sub->status,
                'current_period_end' => $sub->current_period_end?->toIso8601String(),
            ],
        ]);
    }

    public function grantFactionSubscription(Request $request): JsonResponse
    {
        $planKeys = ToolSubscriptionPlan::query()->pluck('key')->toArray();

        $data = $request->validate([
            'faction_id' => ['required', 'integer', Rule::exists('factions', 'id')],
            'plan_key'   => ['required', 'string', Rule::in($planKeys)],
            'months'     => ['required', 'integer', 'min:1', 'max:24'],
            'seat_count' => ['required', 'integer', 'min:1', 'max:500'],
            'manager_user_id' => ['required', 'integer', Rule::exists('users', 'id')],
        ]);

        $faction = Faction::findOrFail($data['faction_id']);
        $manager = User::findOrFail($data['manager_user_id']);
        $now     = Carbon::now();

        $existing = ToolSubscription::where('subscriber_type', 'faction')
            ->where('subscriber_id', $faction->id)
            ->where('status', 'active')
            ->first();

        if ($existing) {
            $existing->update([
                'plan_key'             => $data['plan_key'],
                'seat_count'           => $data['seat_count'],
                'current_period_end'   => $now->copy()->addMonths($data['months']),
                'activated_by_user_id' => $manager->id,
            ]);
            $sub = $existing->fresh();
        } else {
            $sub = ToolSubscription::create([
                'subscriber_type'      => 'faction',
                'subscriber_id'        => $faction->id,
                'plan_key'             => $data['plan_key'],
                'status'               => 'active',
                'price_paid_credits'   => 0,
                'seat_count'           => $data['seat_count'],
                'current_period_start' => $now,
                'current_period_end'   => $now->copy()->addMonths($data['months']),
                'activated_by_user_id' => $manager->id,
                'meta'                 => ['granted_manually' => true, 'granted_by' => $request->user()->swc_handle],
            ]);
        }

        // Auto-grant the manager as a member
        ToolSubscriptionMember::firstOrCreate([
            'tool_subscription_id' => $sub->id,
            'user_id'              => $manager->id,
        ]);

        AdminActionLogger::log(
            $request,
            'tool_store',
            'manual_faction_grant',
            "Manually granted '{$data['plan_key']}' faction subscription to {$faction->name} ({$data['seat_count']} seats, managed by {$manager->swc_handle})",
            'tool_subscription',
            $sub->id,
            null,
            $sub->toArray()
        );

        return response()->json([
            'ok'   => true,
            'data' => [
                'faction'            => ['id' => $faction->id, 'name' => $faction->name],
                'manager'            => ['id' => $manager->id, 'swc_handle' => $manager->swc_handle],
                'plan_key'           => $sub->plan_key,
                'seat_count'         => $sub->seat_count,
                'current_period_end' => $sub->current_period_end?->toIso8601String(),
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Formatting helpers
    // -------------------------------------------------------------------------

    private function formatPlan(ToolSubscriptionPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'key' => $plan->key,
            'label' => $plan->label,
            'description' => $plan->description,
            'monthly_price_credits' => $plan->monthly_price_credits,
            'is_active' => $plan->is_active,
            'updated_by' => $plan->updatedBy ? ['id' => $plan->updatedBy->id, 'swc_handle' => $plan->updatedBy->swc_handle] : null,
            'updated_at' => $plan->updated_at?->toIso8601String(),
        ];
    }

    private function formatTier(ToolSubscriptionPlanSeatTier $tier): array
    {
        return [
            'id'                     => $tier->id,
            'plan_key'               => $tier->plan_key,
            'min_seats'              => $tier->min_seats,
            'price_per_seat_credits' => $tier->price_per_seat_credits,
        ];
    }

    private function formatDeal(ToolSubscriptionFactionDeal $deal): array
    {
        return [
            'id'                     => $deal->id,
            'faction'                => $deal->faction ? ['id' => $deal->faction->id, 'name' => $deal->faction->name, 'abbreviation' => $deal->faction->abbreviation] : null,
            'plan_key'               => $deal->plan_key,
            'override_price_credits' => $deal->override_price_credits,
            'per_seat_price_credits' => $deal->per_seat_price_credits,
            'max_seats'              => $deal->max_seats,
            'notes'                  => $deal->notes,
            'set_by'                 => $deal->setBy ? ['id' => $deal->setBy->id, 'swc_handle' => $deal->setBy->swc_handle] : null,
            'updated_at'             => $deal->updated_at?->toIso8601String(),
        ];
    }
}
