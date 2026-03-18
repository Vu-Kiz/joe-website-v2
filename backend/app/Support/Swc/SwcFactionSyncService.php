<?php

namespace App\Support\Swc;

use App\Models\Faction;
use App\Models\User;

class SwcFactionSyncService
{
    /**
     * Sync factions directly from a SWC profile payload.
     */
    public function syncForUser(User $user, array $profile = []): void
    {
        $swcFactions = $this->extractFactionsFromProfile($profile);

        if (empty($swcFactions)) {
            return;
        }

        $this->syncUserFactions($user, $swcFactions);
    }

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

            $name = trim((string) ($factionData['value'] ?? $factionData['name'] ?? ''));
            $uidRaw = trim((string) (($factionData['attributes']['uid'] ?? $factionData['uid'] ?? '')));

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

    /**
     * @return array<int, mixed>
     */
    protected function extractFactionsFromProfile(array $profile): array
    {
        $candidates = [
            data_get($profile, 'swcapi.character.factions.faction'),
            data_get($profile, 'swcapi.character.factions'),
            data_get($profile, 'swcapi.character.faction'),
            data_get($profile, 'swcapi.factions.faction'),
            data_get($profile, 'swcapi.factions'),
        ];

        foreach ($candidates as $candidate) {
            if (is_array($candidate)) {
                if ($this->isAssoc($candidate)) {
                    if (isset($candidate['value']) || isset($candidate['name']) || isset($candidate['attributes'])) {
                        return [$candidate];
                    }
                }

                return array_values(array_filter($candidate, fn ($item) => is_array($item)));
            }
        }

        return [];
    }

    protected function isAssoc(array $array): bool
    {
        return array_keys($array) !== range(0, count($array) - 1);
    }

    protected function guessAbbreviation(string $name): string
    {
        return match ($name) {
            'Jawa Offworld Enterprises' => 'JOE',
            'Jawa Offworld Enterprises: GARRY' => 'GARRY',
            'Jawa Offworld Enterprises: RAID' => 'RAID',
            'Anarchy Industries' => 'AI',
            'Jawa Offworld Enterprises: RICH' => 'RICH',
            'Jawa Outer Colonies' => 'JOC',
            'Twin Suns Trading' => 'TST',
            default => strtoupper(substr($name, 0, 8)),
        };
    }
}