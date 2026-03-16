<?php

namespace App\Support\Swc;

use App\Models\Faction;
use App\Models\User;

class SwcFactionSyncService
{
    /**
     * @param array<int, mixed> $swcFactions
     */
    public function syncUserFactions(User $user, array $swcFactions): void
    {
        if (!method_exists($user, 'factions')) {
            return;
        }

        $existing = $user->factions()->get()->keyBy('id');
        $attachPayload = [];

        foreach ($swcFactions as $factionData) {
            if (!is_array($factionData)) {
                continue;
            }

            $name = trim((string) ($factionData['value'] ?? ''));
            $uidRaw = trim((string) (($factionData['attributes']['uid'] ?? '')));

            if ($name === '') {
                continue;
            }

            $swcUid = null;

            if ($uidRaw !== '' && str_contains($uidRaw, ':')) {
                $parts = explode(':', $uidRaw, 2);
                $maybe = $parts[1] ?? '';

                if (is_numeric($maybe)) {
                    $swcUid = (int) $maybe;
                }
            } elseif (is_numeric($uidRaw)) {
                $swcUid = (int) $uidRaw;
            }

            $faction = null;

            if ($swcUid !== null) {
                $faction = Faction::query()->where('swc_uid', $swcUid)->first();
            }

            if (!$faction) {
                $faction = Faction::query()->where('name', $name)->first();
            }

            if (!$faction) {
                $faction = new Faction();
            }

            $faction->name = $name;
            $faction->swc_uid = $swcUid;
            $faction->abbreviation = $faction->abbreviation ?: $this->guessAbbreviation($name);
            $faction->save();

            $existingPivot = $existing->get($faction->id)?->pivot;

            $attachPayload[$faction->id] = [
                'can_view_payments' => (bool) ($existingPivot?->can_view_payments ?? false),
                'can_pay_from_faction' => (bool) ($existingPivot?->can_pay_from_faction ?? false),
                'can_mark_payments_paid' => (bool) ($existingPivot?->can_mark_payments_paid ?? false),
                'can_manage_jobs' => (bool) ($existingPivot?->can_manage_jobs ?? false),
            ];
        }

        if (!empty($attachPayload)) {
            $user->factions()->syncWithoutDetaching($attachPayload);
        }
    }

    protected function guessAbbreviation(string $name): string
    {
        return match ($name) {
            'Jawa Offworld Enterprises' => 'JOE',
            'Jawa Offworld Enterprises: GARRY' => 'GARRY',
            'Jawa Offworld Enterprises: RAID' => 'RAID',
            'Anarchy Industries' => 'AI',
            default => strtoupper(substr($name, 0, 8)),
        };
    }
}