<?php

namespace App\Support\Universe;

use App\Models\DroidBrain\DroidBrainPaymentSetting;
use App\Models\Faction;
use App\Models\Payment\PaymentItem;
use App\Models\User;
use Illuminate\Support\Carbon;

class AstrogationRewardService
{
    private const NEW_DS_AMOUNT = 100000;
    private const NEW_AF_AMOUNT = 150000;
    private const UPDATED_AMOUNT = 100000;
    private const UPDATED_MIN_AGE_DAYS = 365;

    public function rewardForNewGrids(User $user, array $areas): ?PaymentItem
    {
        $newDsCount = 0;
        $newAfCount = 0;
        $updatedDsCount = 0;
        $updatedAfCount = 0;
        $breakdown = [];

        foreach ($areas as $area) {
            $action = (string) ($area['action'] ?? '');
            $isAsteroid = (bool) ($area['has_asteroids'] ?? false);
            $amount = 0;
            $rewardRule = null;

            if ($action === 'created') {
                if ($isAsteroid) {
                    $amount = self::NEW_AF_AMOUNT;
                    $newAfCount += 1;
                    $rewardRule = 'new_af';
                } else {
                    $amount = self::NEW_DS_AMOUNT;
                    $newDsCount += 1;
                    $rewardRule = 'new_ds';
                }
            } elseif ($action === 'updated' && $this->qualifiesUpdatedReward($area)) {
                $amount = self::UPDATED_AMOUNT;
                if ($isAsteroid) {
                    $updatedAfCount += 1;
                    $rewardRule = 'updated_af_1y';
                } else {
                    $updatedDsCount += 1;
                    $rewardRule = 'updated_ds_1y';
                }
            }

            if ($amount <= 0) {
                continue;
            }

            $breakdown[] = [
                'galx' => (int) $area['galx'],
                'galy' => (int) $area['galy'],
                'action' => $action,
                'square_name' => $area['square_name'] ?? null,
                'has_asteroids' => $isAsteroid,
                'reward_rule' => $rewardRule,
                'amount' => $amount,
            ];
        }

        $totalAmount = (int) collect($breakdown)->sum('amount');
        if ($totalAmount <= 0) {
            return null;
        }

        $payer = $this->resolvePayer();
        if (!$payer) {
            return null;
        }

        $swcHandle = trim((string) ($user->swc_handle ?? ''));
        if ($swcHandle === '') {
            return null;
        }

        $swcUid = $user->swc_character_id ? '1:' . $user->swc_character_id : null;

        $communicationPrefix = $this->buildCommunicationPrefix(
            $newDsCount,
            $newAfCount,
            $updatedDsCount,
            $updatedAfCount,
            $totalAmount
        );

        return PaymentItem::updateOrCreate(
            [
                'source_type' => 'astrogation_import',
                'source_id'   => $user->id,
                'status'      => 'pending',
            ],
            [
                'tool_key' => 'astrogation',
                'payer_subject_type' => 'faction',
                'payer_subject_id' => $payer->id,
                'payer_label' => $payer->name,
                'payee_subject_type' => 'user',
                'payee_subject_id' => $user->id,
                'payee_swc_uid' => $swcUid,
                'payee_handle' => $swcHandle,
                'payee_label' => $swcHandle,
                'amount' => $totalAmount,
                'bonus_amount' => 0,
                'total_amount' => $totalAmount,
                'meta' => [
                    'communication_prefix' => $communicationPrefix,
                    'normal_grid_count' => $newDsCount,
                    'asteroid_grid_count' => $newAfCount,
                    'new_ds_count' => $newDsCount,
                    'new_af_count' => $newAfCount,
                    'updated_ds_count' => $updatedDsCount,
                    'updated_af_count' => $updatedAfCount,
                    'breakdown' => $breakdown,
                ],
            ]
        );
    }

    protected function buildCommunicationPrefix(
        int $newDsCount,
        int $newAfCount,
        int $updatedDsCount,
        int $updatedAfCount,
        int $totalAmount
    ): string
    {
        $parts = [];
        if ($newDsCount > 0) {
            $parts[] = $newDsCount . ' new DS';
        }
        if ($newAfCount > 0) {
            $parts[] = $newAfCount . ' new AF';
        }
        if ($updatedDsCount > 0) {
            $parts[] = $updatedDsCount . ' updated DS (1y+)';
        }
        if ($updatedAfCount > 0) {
            $parts[] = $updatedAfCount . ' updated AF (1y+)';
        }

        $prefix = 'Astrogation search reward: ' . implode(', ', $parts);
        $prefix .= ' = ' . number_format($totalAmount) . ' credits';

        return $prefix;
    }

    protected function qualifiesUpdatedReward(array $area): bool
    {
        $previous = $this->parseTimestamp($area['previous_legacy_recorded_at'] ?? null);
        if (!$previous) {
            return false;
        }

        $current = $this->parseTimestamp($area['effective_legacy_recorded_at'] ?? null)
            ?? $this->parseTimestamp($area['imported_recorded_at'] ?? null);
        if (!$current || $current->lessThanOrEqualTo($previous)) {
            return false;
        }

        return $previous->diffInDays($current) >= self::UPDATED_MIN_AGE_DAYS;
    }

    protected function parseTimestamp(mixed $value): ?Carbon
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->utc();
        } catch (\Throwable) {
            return null;
        }
    }

    protected function resolvePayer(): ?Faction
    {
        $savedSettings = DroidBrainPaymentSetting::query()->latest('id')->first();
        if ($savedSettings?->default_payer_faction_id) {
            $faction = Faction::find((int) $savedSettings->default_payer_faction_id);
            if ($faction) {
                return $faction;
            }
        }

        $configuredId = (int) config('services.droidbrain_rewards.payer_faction_id');
        if ($configuredId > 0) {
            return Faction::find($configuredId);
        }

        $configuredUid = trim((string) config('services.droidbrain_rewards.payer_faction_swc_uid', ''));
        if ($configuredUid !== '') {
            $faction = Faction::query()->where('swc_uid', $configuredUid)->first();
            if ($faction) {
                return $faction;
            }
        }

        return Faction::query()
            ->where('abbreviation', 'JOE')
            ->orWhere('name', 'Jawa Offworld Enterprises')
            ->orWhere('swc_uid', '20:1376')
            ->first();
    }
}
