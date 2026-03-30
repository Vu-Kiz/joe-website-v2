<?php

namespace App\Support\Factions;

use App\Support\Swc\SwcPrivilegeService;
use App\Models\User;

class FactionPermissionService
{
    public function __construct(
        protected SwcPrivilegeService $swcPrivilegeService
    ) {
    }

    public function canPayFromFaction(User $user, int $factionId): bool
    {
        $faction = $user->factions()
            ->where('faction_id', $factionId)
            ->first([
                'factions.id',
                'factions.name',
                'factions.swc_uid',
                'factions.abbreviation',
            ]);

        if (!$faction) {
            return false;
        }

        return $this->canPayFromFactionModel($user, $faction);
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
        return $user->factions()
            ->get([
                'factions.id',
                'factions.name',
                'factions.swc_uid',
                'factions.abbreviation',
            ])
            ->filter(fn ($faction) => $this->canPayFromFactionModel($user, $faction))
            ->values();
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

    protected function canPayFromFactionModel(User $user, $faction): bool
    {
        $check = $this->swcPrivilegeService->checkFactionPrivilege(
            user: $user,
            faction: $faction,
            privilegeGroup: 'finance',
            privilegeName: 'send_credits',
            refresh: false
        );

        return (bool) (($check['ok'] ?? false) && ($check['allowed'] ?? false));
    }
}
