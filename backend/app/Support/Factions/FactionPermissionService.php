<?php

namespace App\Support\Factions;

use App\Models\User;

class FactionPermissionService
{
    public function canPayFromFaction(User $user, int $factionId): bool
    {
        if ($user->is_sysadmin) {
            return true;
        }

        return $user->factions()
            ->where('faction_id', $factionId)
            ->wherePivot('can_pay_from_faction', true)
            ->exists();
    }

    public function canViewFactionPayments(User $user, int $factionId): bool
    {
        if ($user->is_sysadmin) {
            return true;
        }

        return $user->factions()
            ->where('faction_id', $factionId)
            ->wherePivot('can_view_payments', true)
            ->exists();
    }

    public function canManageManualPayments(User $user, int $factionId): bool
    {
        if ($user->is_sysadmin) {
            return true;
        }

        return $user->factions()
            ->where('faction_id', $factionId)
            ->wherePivot('can_manage_manual_payments', true)
            ->exists();
    }

    public function getPayableFactions(User $user)
    {
        if ($user->is_sysadmin) {
            return $user->factions()->get([
                'factions.id',
                'factions.name',
                'factions.swc_uid',
                'factions.abbreviation',
            ]);
        }

        return $user->factions()
            ->wherePivot('can_pay_from_faction', true)
            ->get([
                'factions.id',
                'factions.name',
                'factions.swc_uid',
                'factions.abbreviation',
            ]);
    }

    public function getManualManageableFactions(User $user)
    {
        if ($user->is_sysadmin) {
            return $user->factions()->get([
                'factions.id',
                'factions.name',
                'factions.swc_uid',
                'factions.abbreviation',
            ]);
        }

        return $user->factions()
            ->wherePivot('can_manage_manual_payments', true)
            ->get([
                'factions.id',
                'factions.name',
                'factions.swc_uid',
                'factions.abbreviation',
            ]);
    }
}