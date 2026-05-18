<?php

namespace App\Support\ToolStore;

use App\Models\ToolSubscription;
use App\Models\ToolSubscriptionMember;
use App\Models\User;

class ToolAccessService
{
    public const TIER_FULL   = 'full';
    public const TIER_PUBLIC = 'public';
    public const TIER_NONE   = 'none';

    public function tierForUser(?User $user): string
    {
        if (!$user) {
            return self::TIER_NONE;
        }

        if (!$user->force_subscriber_tier && ($user->is_joe_member || $user->is_intel || $user->is_admin || $user->is_sysadmin)) {
            return self::TIER_FULL;
        }

        if ($this->hasActiveSubscription($user)) {
            return self::TIER_PUBLIC;
        }

        return self::TIER_NONE;
    }

    public function hasActiveSubscription(User $user): bool
    {
        $now = now();

        // Direct user subscription
        if (ToolSubscription::query()
            ->where('subscriber_type', 'user')
            ->where('subscriber_id', $user->id)
            ->where('status', 'active')
            ->where('current_period_end', '>', $now)
            ->exists()) {
            return true;
        }

        // Faction subscription — user must be explicitly granted a seat by the faction leader
        return ToolSubscriptionMember::query()
            ->where('user_id', $user->id)
            ->whereHas('subscription', function ($q) use ($now) {
                $q->where('subscriber_type', 'faction')
                  ->where('status', 'active')
                  ->where('current_period_end', '>', $now);
            })
            ->exists();
    }

    public function activeSubscriptionFor(User $user): ?ToolSubscription
    {
        $now = now();

        $individual = ToolSubscription::query()
            ->where('subscriber_type', 'user')
            ->where('subscriber_id', $user->id)
            ->where('status', 'active')
            ->where('current_period_end', '>', $now)
            ->latest('id')
            ->first();

        if ($individual) {
            return $individual;
        }

        // Faction subscription the user has been granted a seat on
        $member = ToolSubscriptionMember::query()
            ->where('user_id', $user->id)
            ->with(['subscription' => function ($q) use ($now) {
                $q->where('subscriber_type', 'faction')
                  ->where('status', 'active')
                  ->where('current_period_end', '>', $now);
            }])
            ->get()
            ->map(fn ($m) => $m->subscription)
            ->filter()
            ->first();

        return $member ?: null;
    }
}
