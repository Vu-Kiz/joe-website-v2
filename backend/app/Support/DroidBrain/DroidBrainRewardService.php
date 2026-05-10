<?php

namespace App\Support\DroidBrain;

use App\Models\DroidBrainPaymentSetting;
use App\Models\Faction;
use App\Models\PaymentItem;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DroidBrainRewardService
{
    private const MODIFIED_ENTITY_MIN_AGE_SECONDS = 14 * 24 * 60 * 60;

    public function syncForFile(int $fileId, ?int $payerFactionId = null, bool $createPaymentItem = false): ?array
    {
        $file = DB::table('droidbrain_files')->where('id', $fileId)->first();
        if (!$file) {
            return null;
        }

        $uploader = DB::table('droidbrain_uploaders')->where('id', $file->uploader_id)->first();
        if (!$uploader || !$uploader->user_id) {
            return null;
        }
        $payeeHandle = $this->resolveUploaderSwcHandle($uploader);
        $payeeLabel = $this->resolveUploaderLabel($uploader);

        $systems = $this->collectTouchedSystems($fileId, $file);
        if ($systems->isEmpty()) {
            return null;
        }

        $payer = $this->resolvePayer($payerFactionId);
        $existingPaymentItem = PaymentItem::query()
            ->where('source_type', 'droidbrain_file')
            ->where('source_id', $fileId)
            ->first();

        $rewardedAt = now();
        $cooldownThreshold = $rewardedAt->copy()->subDays(7);
        $cooldownUntil = $rewardedAt->copy()->addDays(7);

        $logs = collect();
        $totalAmount = 0;

        DB::transaction(function () use (
            $systems,
            $fileId,
            $file,
            $cooldownThreshold,
            $cooldownUntil,
            $rewardedAt,
            &$logs,
            &$totalAmount
        ) {
            foreach ($systems as $system) {
                $previousReward = DB::table('droidbrain_reward_logs')
                    ->where('galx', $system['galx'])
                    ->where('galy', $system['galy'])
                    ->where('reward_status', 'rewarded')
                    ->where('rewarded_at', '>=', $cooldownThreshold)
                    ->orderByDesc('rewarded_at')
                    ->first();

                $amount = 0;
                $status = 'cooldown';
                $isNewSystem = $system['is_new_system'];

                if (!$previousReward) {
                    $status = 'rewarded';

                    if ($isNewSystem) {
                        if ($this->isOwnerOnlyNonSystem($system, $fileId, $file)) {
                            $status = 'no_reward';
                        } else {
                            $amount = 1000000;
                        }
                    } else {
                        $amount = ($system['new_entities_count'] * 5000) + ($system['modified_entities_count'] * 1000);
                        if ($amount <= 0) {
                            $status = 'no_reward';
                        }
                    }
                }

                $logPayload = [
                    'file_id' => $fileId,
                    'galx' => $system['galx'],
                    'galy' => $system['galy'],
                    'system_name' => $system['system_name'],
                    'snapshot_unixtime' => $file->snapshot_unix,
                    'reward_status' => $status,
                    'is_new_system' => $isNewSystem,
                    'new_entities_count' => $system['new_entities_count'],
                    'modified_entities_count' => $system['modified_entities_count'],
                    'unchanged_entities_count' => $system['unchanged_entities_count'],
                    'total_amount' => $amount,
                    'rewarded_at' => $status === 'rewarded' ? $rewardedAt : null,
                    'cooldown_until' => $status === 'cooldown' ? $previousReward?->cooldown_until ?? $cooldownUntil : null,
                    'meta' => json_encode([
                        'previous_reward_file_id' => $previousReward->file_id ?? null,
                        'cooldown_days' => 7,
                        'modified_too_recent_count' => (int) ($system['modified_too_recent_count'] ?? 0),
                    ], JSON_UNESCAPED_SLASHES),
                    'updated_at' => now(),
                ];

                DB::table('droidbrain_reward_logs')->updateOrInsert(
                    [
                        'file_id' => $fileId,
                        'galx' => $system['galx'],
                        'galy' => $system['galy'],
                    ],
                    $logPayload + ['created_at' => now()]
                );

                $log = DB::table('droidbrain_reward_logs')
                    ->where('file_id', $fileId)
                    ->where('galx', $system['galx'])
                    ->where('galy', $system['galy'])
                    ->first();

                $logs->push((array) $log);
                $totalAmount += $amount;
            }
        });

        $paymentItem = $existingPaymentItem;
        if ($createPaymentItem && $totalAmount > 0 && $payer && $payeeHandle !== null) {
            $paymentItem = PaymentItem::updateOrCreate(
                [
                    'source_type' => 'droidbrain_file',
                    'source_id' => $fileId,
                ],
                [
                    'tool_key' => 'droidbrain',
                    'payer_subject_type' => 'faction',
                    'payer_subject_id' => $payer->id,
                    'payer_label' => $payer->name,
                    'payee_subject_type' => 'user',
                    'payee_subject_id' => (int) $uploader->user_id,
                    'payee_swc_uid' => $uploader->swc_uid,
                    'payee_handle' => $payeeHandle,
                    'payee_label' => $payeeLabel,
                    'amount' => $totalAmount,
                    'bonus_amount' => 0,
                    'total_amount' => $totalAmount,
                    'status' => 'pending',
                    'meta' => [
                        'communication_prefix' => $this->buildCommunicationPrefix($logs),
                        'droidbrain_file_id' => $fileId,
                        'file_name' => $file->file_name,
                        'breakdown' => $logs->map(fn (array $log) => [
                            'system_name' => $log['system_name'],
                            'galx' => $log['galx'],
                            'galy' => $log['galy'],
                            'status' => $log['reward_status'],
                            'is_new_system' => (bool) $log['is_new_system'],
                            'new_entities_count' => (int) $log['new_entities_count'],
                            'modified_entities_count' => (int) $log['modified_entities_count'],
                            'unchanged_entities_count' => (int) $log['unchanged_entities_count'],
                            'total_amount' => (int) $log['total_amount'],
                        ])->values()->all(),
                    ],
                ]
            );

            DB::table('droidbrain_reward_logs')
                ->where('file_id', $fileId)
                ->where('reward_status', 'rewarded')
                ->update([
                    'payment_item_id' => $paymentItem->id,
                    'updated_at' => now(),
                ]);
        }

        return [
            'total_amount' => $totalAmount,
            'payment_item_id' => $paymentItem?->id,
            'payer_label' => $paymentItem?->payer_label ?? $payer?->name,
            'payee_handle' => $payeeHandle,
            'payee_label' => $payeeLabel,
            'systems' => $logs->map(fn (array $log) => [
                'system_name' => $log['system_name'],
                'galx' => (int) $log['galx'],
                'galy' => (int) $log['galy'],
                'status' => $log['reward_status'],
                'is_new_system' => (bool) $log['is_new_system'],
                'new_entities_count' => (int) $log['new_entities_count'],
                'modified_entities_count' => (int) $log['modified_entities_count'],
                'unchanged_entities_count' => (int) $log['unchanged_entities_count'],
                'total_amount' => (int) $log['total_amount'],
            ])->values()->all(),
        ];
    }

    protected function resolvePayer(?int $payerFactionId = null): ?Faction
    {
        if ($payerFactionId && $payerFactionId > 0) {
            return Faction::find($payerFactionId);
        }

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

    protected function collectTouchedSystems(int $fileId, object $file): Collection
    {
        $systems = DB::table('droidbrain_system_scans')
            ->where('file_id', $fileId)
            ->select('galx', 'galy', 'system_name')
            ->get()
            ->map(function ($row) use ($fileId, $file) {
                $counts = $this->collectSystemEntityCounts($fileId, (int) $row->galx, (int) $row->galy, $file->snapshot_unix ? (int) $file->snapshot_unix : null);
                $known = DB::table('droidbrain_known_systems')
                    ->where('galx', (int) $row->galx)
                    ->where('galy', (int) $row->galy)
                    ->first();

                return [
                    'galx' => (int) $row->galx,
                    'galy' => (int) $row->galy,
                    'system_name' => $row->system_name,
                    'is_new_system' => $known && (int) $known->first_seen_file_id === $fileId,
                    'new_entities_count' => $counts['new'],
                    'modified_entities_count' => $counts['modified'],
                    'modified_too_recent_count' => $counts['modified_too_recent'],
                    'unchanged_entities_count' => $counts['unchanged'],
                ];
            });

        return $systems->unique(fn (array $row) => $row['galx'] . ':' . $row['galy'])->values();
    }

    protected function collectSystemEntityCounts(int $fileId, int $galx, int $galy, ?int $snapshotUnix): array
    {
        $rows = collect()
            ->concat(
                DB::table('droidbrain_ships')
                    ->where('file_id', $fileId)
                    ->where('galx', $galx)
                    ->where('galy', $galy)
                    ->get(['entity_uid', 'owner_name', 'name', 'galx', 'galy'])
                    ->map(fn ($row) => ['table' => 'droidbrain_ships'] + (array) $row)
            )
            ->concat(
                DB::table('droidbrain_stations')
                    ->where('file_id', $fileId)
                    ->where('galx', $galx)
                    ->where('galy', $galy)
                    ->get(['entity_uid', 'owner_name', 'name', 'galx', 'galy'])
                    ->map(fn ($row) => ['table' => 'droidbrain_stations'] + (array) $row)
            );

        $counts = ['new' => 0, 'modified' => 0, 'modified_too_recent' => 0, 'unchanged' => 0];

        foreach ($rows as $row) {
            $state = $this->classifyEntityState(
                $row['table'],
                (string) $row['entity_uid'],
                (string) ($row['owner_name'] ?? ''),
                (string) ($row['name'] ?? ''),
                $galx,
                $galy,
                $snapshotUnix
            );

            $counts[$state]++;
        }

        return $counts;
    }

    protected function classifyEntityState(
        string $table,
        string $entityUid,
        string $ownerName,
        string $name,
        int $galx,
        int $galy,
        ?int $snapshotUnix
    ): string {
        $latest = DB::table($table)
            ->where('entity_uid', $entityUid)
            ->when($snapshotUnix !== null, fn ($query) => $query->where('snapshot_unixtime', '<', $snapshotUnix))
            ->orderByDesc('snapshot_unixtime')
            ->first(['snapshot_unixtime']);

        if (!$latest) {
            return 'new';
        }

        $same = DB::table($table)
            ->where('entity_uid', $entityUid)
            ->where('owner_name', $ownerName)
            ->where('name', $name)
            ->where('galx', $galx)
            ->where('galy', $galy)
            ->when($snapshotUnix !== null, fn ($query) => $query->where('snapshot_unixtime', '<', $snapshotUnix))
            ->exists();

        if ($same) {
            return 'unchanged';
        }

        if ($snapshotUnix === null || !is_numeric((string) $latest->snapshot_unixtime)) {
            return 'modified_too_recent';
        }

        $ageSeconds = (int) $snapshotUnix - (int) $latest->snapshot_unixtime;
        if ($ageSeconds < self::MODIFIED_ENTITY_MIN_AGE_SECONDS) {
            return 'modified_too_recent';
        }

        return 'modified';
    }

    protected function isOwnerOnlyNonSystem(array $system, int $fileId, object $file): bool
    {
        $galx = $system['galx'];
        $galy = $system['galy'];

        $isRealSystem = DB::table('swc_systems')
            ->where('galx', $galx)
            ->where('galy', $galy)
            ->exists();

        if ($isRealSystem) {
            return false;
        }

        $uploaderSwcUid = $file->uploader_swc_uid;
        if (!$uploaderSwcUid) {
            return true;
        }

        $ships = DB::table('droidbrain_ships')
            ->where('file_id', $fileId)
            ->where('galx', $galx)
            ->where('galy', $galy)
            ->get(['owner_uid']);

        if ($ships->isEmpty()) {
            return true;
        }

        return $ships->every(fn ($ship) => $ship->owner_uid === $uploaderSwcUid);
    }

    protected function buildCommunicationPrefix(Collection $logs): string
    {
        $parts = $logs
            ->where('reward_status', 'rewarded')
            ->map(function (array $log) {
                $label = trim((string) ($log['system_name'] ?? 'Unknown system'));
                $coords = '(' . $log['galx'] . ',' . $log['galy'] . ')';

                if (!empty($log['is_new_system'])) {
                    return $label . ' ' . $coords . ' new system';
                }

                $detail = [];
                if ((int) ($log['new_entities_count'] ?? 0) > 0) {
                    $detail[] = (int) $log['new_entities_count'] . ' new';
                }
                if ((int) ($log['modified_entities_count'] ?? 0) > 0) {
                    $detail[] = (int) $log['modified_entities_count'] . ' updated';
                }

                return trim($label . ' ' . $coords . ' ' . implode(', ', $detail));
            })
            ->filter()
            ->values();

        $prefix = 'DroidBrain reward';
        if ($parts->isNotEmpty()) {
            $prefix .= ': ' . $parts->implode('; ');
        }

        if (function_exists('mb_strimwidth')) {
            return mb_strimwidth($prefix, 0, 180, '...');
        }

        return strlen($prefix) > 180 ? substr($prefix, 0, 177) . '...' : $prefix;
    }

    protected function resolveUploaderSwcHandle(object $uploader): ?string
    {
        $user = User::query()->find((int) $uploader->user_id);
        if (!$user) {
            return null;
        }

        $swcHandle = trim((string) ($user->swc_handle ?? ''));
        return $swcHandle !== '' ? $swcHandle : null;
    }

    protected function resolveUploaderLabel(object $uploader): string
    {
        $swcHandle = $this->resolveUploaderSwcHandle($uploader);
        if ($swcHandle !== null) {
            return $swcHandle;
        }

        $stored = trim((string) ($uploader->handle ?? ''));
        if ($stored !== '') {
            return $stored;
        }

        $user = User::query()->find((int) $uploader->user_id);
        if ($user) {
            $candidates = [
                $user->discord_global_name ?? null,
                $user->discord_username ?? null,
            ];

            foreach ($candidates as $candidate) {
                $value = trim((string) $candidate);
                if ($value !== '') {
                    return $value;
                }
            }
        }

        return 'User #' . (int) $uploader->user_id;
    }
}
