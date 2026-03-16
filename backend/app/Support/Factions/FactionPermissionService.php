<?php

namespace App\Support\Factions;

use App\Models\User;

class FactionPermissionService
{
    public function canPayFromFaction(User $user, int $factionId): bool
    {
        return $user->factions()
            ->where('faction_id', $factionId)
            ->wherePivot('can_pay_from_faction', true)
            ->exists();
    }

    public function canViewFactionPayments(User $user, int $factionId): bool
    {
        return $user->factions()
            ->where('faction_id', $factionId)
            ->wherePivot('can_view_payments', true)
            ->exists();
    }

    public function getPayableFactions(User $user)
    {
        return $user->factions()
            ->wherePivot('can_pay_from_faction', true)
            ->get([
                'factions.id',
                'factions.name',
                'factions.swc_uid',
                'factions.abbreviation',
            ]);
    }
}