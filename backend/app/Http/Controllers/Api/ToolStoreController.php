<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\SwcAuthorization;
use App\Models\ToolStoreSetting;
use App\Models\ToolSubscription;
use App\Models\ToolSubscriptionFactionDeal;
use App\Models\ToolSubscriptionMember;
use App\Models\ToolSubscriptionPlan;
use App\Models\ToolSubscriptionPlanSeatTier;
use App\Support\Admin\AdminActionLogger;
use App\Support\Swc\SwcAuthorizationService;
use App\Support\Swc\SwcCreditTransferService;
use App\Support\ToolStore\ToolAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ToolStoreController extends Controller
{
    public function __construct(
        protected ToolAccessService $toolAccessService,
        protected SwcCreditTransferService $swcCreditTransferService,
        protected SwcAuthorizationService $swcAuthorizationService
    ) {
    }

    // -------------------------------------------------------------------------
    // Public: plan catalog
    // -------------------------------------------------------------------------

    public function catalog(Request $request): JsonResponse
    {
        $plans = ToolSubscriptionPlan::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        $publicTools = collect(config('tools.tools'))
            ->filter(fn ($t) => $t['public'])
            ->values();

        $user = $request->user();
        $tier = $this->toolAccessService->tierForUser($user);
        $subscription = $user ? $this->toolAccessService->activeSubscriptionFor($user) : null;

        $hasPaymentsAccess = false;
        if ($user) {
            $paymentsToken = $this->swcAuthorizationService->getAccessToken($user, SwcAuthorization::CONTEXT_PAYMENTS);
            $hasPaymentsAccess = $paymentsToken !== null;
        }

        $seatTiersByPlan = ToolSubscriptionPlanSeatTier::query()
            ->orderBy('min_seats')
            ->get()
            ->groupBy('plan_key')
            ->map(fn ($tiers) => $tiers->map(fn ($t) => [
                'min_seats'              => $t->min_seats,
                'price_per_seat_credits' => $t->price_per_seat_credits,
            ])->values());

        return response()->json([
            'ok' => true,
            'data' => [
                'plans' => $plans->map(fn ($p) => [
                    'key' => $p->key,
                    'label' => $p->label,
                    'description' => $p->description,
                    'monthly_price_credits' => $p->monthly_price_credits,
                    'standard_price_credits' => $p->monthly_price_credits,
                    'has_faction_deal' => false,
                ]),
                'public_tools'  => $publicTools,
                'seat_tiers'    => $seatTiersByPlan,
                'tier'          => $tier,
                'subscription'  => $subscription ? $this->formatSubscription($subscription) : null,
                'has_payments_access' => $hasPaymentsAccess,
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Authenticated: subscribe
    // -------------------------------------------------------------------------

    public function subscribeQuote(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'plan_key'       => ['required', 'string', Rule::exists('tool_subscription_plans', 'key')],
            'subscriber_type'=> ['required', 'in:user,faction'],
            'faction_id'     => ['required_if:subscriber_type,faction', 'nullable', 'integer', 'exists:factions,id'],
            'seat_count'     => ['required_if:subscriber_type,faction', 'nullable', 'integer', 'min:1'],
        ]);

        $plan = ToolSubscriptionPlan::query()->where('key', $data['plan_key'])->where('is_active', true)->firstOrFail();

        $price         = $plan->monthly_price_credits;
        $seatCount     = null;
        $perSeat       = false;
        $perSeatPrice  = null;
        $deal          = null;

        if ($data['subscriber_type'] === 'faction' && !empty($data['faction_id'])) {
            $seatCount = (int) ($data['seat_count'] ?? 1);

            $deal = ToolSubscriptionFactionDeal::query()
                ->where('faction_id', $data['faction_id'])
                ->where('plan_key', $plan->key)
                ->first();

            if ($deal) {
                if ($deal->per_seat_price_credits !== null) {
                    if ($deal->max_seats !== null && $seatCount > $deal->max_seats) {
                        return response()->json([
                            'ok' => false,
                            'message' => "This deal allows a maximum of {$deal->max_seats} seats.",
                        ], 422);
                    }
                    $perSeatPrice = $deal->per_seat_price_credits;
                    $price        = $perSeatPrice * $seatCount;
                    $perSeat      = true;
                } elseif ($deal->override_price_credits !== null) {
                    // Flat bulk deal — fixed price regardless of seat count
                    $price = $deal->override_price_credits;
                }
            } else {
                // Volume tier pricing (auto-applies based on seat count)
                $tier         = ToolSubscriptionPlanSeatTier::bestFor($plan->key, $seatCount);
                $perSeatPrice = $tier ? $tier->price_per_seat_credits : $plan->monthly_price_credits;
                $price        = $perSeatPrice * $seatCount;
                $perSeat      = true;
            }
        }

        $settings = ToolStoreSetting::query()->with('payeeFaction')->latest('id')->first();
        $payeeConfigured = $settings && $settings->payee_faction_id && $settings->payeeFaction;

        return response()->json([
            'ok' => true,
            'data' => [
                'plan'            => ['key' => $plan->key, 'label' => $plan->label],
                'price_credits'   => $price,
                'subscriber_type' => $data['subscriber_type'],
                'faction_id'      => $data['faction_id'] ?? null,
                'seat_count'      => $seatCount,
                'per_seat'        => $perSeat,
                'per_seat_price'  => $perSeatPrice,
                'max_seats'       => $deal?->max_seats,
                'payee_configured'=> $payeeConfigured,
            ],
        ]);
    }

    public function subscribeSend(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'plan_key'        => ['required', 'string', Rule::exists('tool_subscription_plans', 'key')],
            'subscriber_type' => ['required', 'in:user,faction'],
            'faction_id'      => ['required_if:subscriber_type,faction', 'nullable', 'integer', 'exists:factions,id'],
            'seat_count'      => ['required_if:subscriber_type,faction', 'nullable', 'integer', 'min:1'],
        ]);

        $plan = ToolSubscriptionPlan::query()->where('key', $data['plan_key'])->where('is_active', true)->firstOrFail();

        $settings = ToolStoreSetting::query()->with('payeeFaction')->latest('id')->first();
        if (!$settings || !$settings->payee_faction_id || !$settings->payeeFaction) {
            return response()->json([
                'ok' => false,
                'message' => 'Subscriptions are not yet configured. Please contact an administrator.',
            ], 503);
        }

        if (!$user->swc_character_id) {
            return response()->json([
                'ok' => false,
                'message' => 'You must link your Star Wars Combine character before subscribing.',
            ], 422);
        }

        $price          = $plan->monthly_price_credits;
        $subscriberType = $data['subscriber_type'];
        $factionId      = $data['faction_id'] ?? null;
        $seatCount      = null;

        if ($subscriberType === 'faction' && $factionId) {
            $seatCount = (int) ($data['seat_count'] ?? 1);

            $deal = ToolSubscriptionFactionDeal::query()
                ->where('faction_id', $factionId)
                ->where('plan_key', $plan->key)
                ->first();

            if ($deal) {
                if ($deal->per_seat_price_credits !== null) {
                    if ($deal->max_seats !== null && $seatCount > $deal->max_seats) {
                        return response()->json([
                            'ok' => false,
                            'message' => "This deal allows a maximum of {$deal->max_seats} seats.",
                        ], 422);
                    }
                    $price = $deal->per_seat_price_credits * $seatCount;
                } elseif ($deal->override_price_credits !== null) {
                    $price = $deal->override_price_credits;
                }
            } else {
                $tier  = ToolSubscriptionPlanSeatTier::bestFor($plan->key, $seatCount);
                $price = ($tier ? $tier->price_per_seat_credits : $plan->monthly_price_credits) * $seatCount;
            }
        }

        if ($price <= 0) {
            return response()->json([
                'ok' => false,
                'message' => 'This plan has no price set. Please contact an administrator.',
            ], 422);
        }

        // 7-day cooldown after revocation
        $subscriberId = $subscriberType === 'faction' ? $factionId : $user->id;
        $recentRevoke = ToolSubscription::query()
            ->where('subscriber_type', $subscriberType)
            ->where('subscriber_id', $subscriberId)
            ->where('status', 'revoked')
            ->where('revoked_at', '>=', now()->subDays(7))
            ->exists();

        if ($recentRevoke) {
            return response()->json([
                'ok' => false,
                'message' => 'A subscription was recently revoked. You must wait 7 days before resubscribing.',
            ], 422);
        }

        $communicationRef = strtoupper(substr(md5(uniqid('sub_', true)), 0, 8));
        $communication = "Anarchy Industries — {$plan->label} [{$communicationRef}]";

        // Execute credit transfer
        try {
            $result = $this->swcCreditTransferService->sendCharacterCredits(
                actingUser: $user,
                senderCharacterId: (int) $user->swc_character_id,
                recipient: $settings->payeeFaction->name,
                amount: $price,
                reason: $communication
            );
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        // Activate subscription
        $subscription = DB::transaction(function () use ($plan, $subscriberType, $factionId, $user, $price, $seatCount, $result, $communicationRef, $subscriberId) {
            // Expire any existing active subscription for this subscriber+plan
            ToolSubscription::query()
                ->where('subscriber_type', $subscriberType)
                ->where('subscriber_id', $subscriberId)
                ->where('plan_key', $plan->key)
                ->where('status', 'active')
                ->update(['status' => 'expired']);

            $sub = ToolSubscription::create([
                'subscriber_type'      => $subscriberType,
                'subscriber_id'        => $subscriberId,
                'plan_key'             => $plan->key,
                'status'               => 'active',
                'price_paid_credits'   => $price,
                'seat_count'           => $seatCount,
                'current_period_start' => now(),
                'current_period_end'   => now()->addMonth(),
                'activated_by_user_id' => $user->id,
                'meta' => [
                    'reference'          => $communicationRef,
                    'swc_transaction_id' => $result['transaction_id'],
                ],
            ]);

            // Auto-grant the payer as the first member of a faction subscription
            if ($subscriberType === 'faction') {
                ToolSubscriptionMember::firstOrCreate([
                    'tool_subscription_id' => $sub->id,
                    'user_id'              => $user->id,
                ]);
            }

            return $sub;
        });

        return response()->json([
            'ok' => true,
            'data' => [
                'message' => 'Subscription activated successfully.',
                'subscription' => $this->formatSubscription($subscription),
                'transaction_id' => $result['transaction_id'],
            ],
        ]);
    }

    public function mySubscription(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $tier = $this->toolAccessService->tierForUser($user);
        $subscription = $this->toolAccessService->activeSubscriptionFor($user);

        return response()->json([
            'ok' => true,
            'data' => [
                'tier' => $tier,
                'subscription' => $subscription ? $this->formatSubscription($subscription) : null,
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Admin: payee settings
    // -------------------------------------------------------------------------

    public function getSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->is_sysadmin) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $settings = ToolStoreSetting::current();
        $factions = Faction::query()->orderBy('name')->get(['id', 'name', 'abbreviation', 'swc_uid']);

        return response()->json([
            'ok' => true,
            'data' => [
                'payee_faction_id' => $settings?->payee_faction_id,
                'factions' => $factions,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->is_sysadmin) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'payee_faction_id' => ['nullable', 'integer', 'exists:factions,id'],
        ]);

        $settings = ToolStoreSetting::current() ?? new ToolStoreSetting();
        $before = $settings->toArray();
        $settings->fill($data);
        $settings->save();

        AdminActionLogger::log(
            $request,
            'tool_store',
            'update_settings',
            'Updated tool store payee settings.',
            'tool_store_settings',
            $settings->id,
            $before,
            $settings->toArray()
        );

        return response()->json([
            'ok' => true,
            'data' => [
                'payee_faction_id' => $settings->payee_faction_id,
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function formatSubscription(ToolSubscription $sub): array
    {
        return [
            'id' => $sub->id,
            'plan_key' => $sub->plan_key,
            'subscriber_type' => $sub->subscriber_type,
            'subscriber_id' => $sub->subscriber_id,
            'status' => $sub->status,
            'price_paid_credits' => $sub->price_paid_credits,
            'current_period_start' => $sub->current_period_start?->toIso8601String(),
            'current_period_end' => $sub->current_period_end?->toIso8601String(),
        ];
    }
}
