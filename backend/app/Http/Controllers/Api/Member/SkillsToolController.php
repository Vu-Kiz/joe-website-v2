<?php

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Models\SkillsToolMemberSkillSnapshot;
use App\Models\User;
use App\Support\Swc\SwcSkillsToolService;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SkillsToolController extends Controller
{
    protected const SNAPSHOT_TTL_HOURS = 24;

    public function __construct(
        protected SwcSkillsToolService $swcSkillsToolService
    ) {
    }

    public function mySkills(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!$user->swc_character_id) {
            return response()->json([
                'ok' => false,
                'message' => 'No SWC character linked to your account.',
            ], 422);
        }

        $snapshot = SkillsToolMemberSkillSnapshot::query()
            ->where('user_id', $user->id)
            ->first();

        if (!$this->isSnapshotFresh($snapshot)) {
            $refresh = $this->refreshMemberSnapshot($user, $snapshot);
            $snapshot = $refresh['snapshot'];
        }

        $row = $this->buildRosterMatrixRow($user, $snapshot);

        return response()->json([
            'ok' => true,
            'data' => $row,
            'skill_plan' => $snapshot?->skill_plan ?? null,
        ]);
    }

    public function getPlan(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $snapshot = SkillsToolMemberSkillSnapshot::query()
            ->where('user_id', $user->id)
            ->first();

        return response()->json([
            'ok' => true,
            'skill_plan' => $snapshot?->skill_plan ?? null,
        ]);
    }

    public function savePlan(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $plan = $request->input('plan');

        if (!is_array($plan)) {
            return response()->json([
                'ok' => false,
                'message' => 'Invalid plan data.',
            ], 422);
        }

        SkillsToolMemberSkillSnapshot::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['skill_plan' => $plan]
        );

        return response()->json(['ok' => true]);
    }

    public function members(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $members = User::query()
            ->where('is_joe_member', true)
            ->whereNotNull('swc_character_id')
            ->orderByRaw('COALESCE(swc_handle, "") asc')
            ->get([
                'id',
                'swc_handle',
                'swc_character_id',
                'swc_avatar_url',
            ]);

        $this->refreshRosterSnapshots($members);

        $data = $members
            ->map(fn (User $member) => [
                'id' => $member->id,
                'handle' => $member->swc_handle,
                'swc_character_id' => $member->swc_character_id,
                'swc_uid' => $member->swc_character_id ? ('1:' . $member->swc_character_id) : null,
                'avatar_url' => $member->swc_avatar_url,
            ])
            ->values();

        return response()->json([
            'ok' => true,
            'data' => $data,
        ]);
    }

    public function rosterMatrix(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $members = User::query()
            ->where('is_joe_member', true)
            ->whereNotNull('swc_character_id')
            ->orderByRaw('COALESCE(swc_handle, "") asc')
            ->get([
                'id',
                'swc_handle',
                'swc_character_id',
                'swc_avatar_url',
            ]);

        $this->refreshRosterSnapshots($members);

        $snapshots = SkillsToolMemberSkillSnapshot::query()
            ->whereIn('user_id', $members->pluck('id')->all())
            ->get()
            ->keyBy('user_id');

        $data = $members->map(function (User $member) use ($snapshots) {
            /** @var SkillsToolMemberSkillSnapshot|null $snapshot */
            $snapshot = $snapshots->get($member->id);
            return $this->buildRosterMatrixRow($member, $snapshot);
        })->values();

        return response()->json([
            'ok' => true,
            'generated_at' => now()->toIso8601String(),
            'data' => $data,
        ]);
    }

    public function memberSkills(Request $request, string $uid): JsonResponse
    {
        $actor = $request->user();

        if (!$actor) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $normalizedUid = $this->normalizeUidInput($uid);
        if ($normalizedUid === '') {
            return response()->json([
                'ok' => false,
                'message' => 'A character UID or handle is required.',
            ], 422);
        }

        $targetMember = $this->resolveTargetMember($normalizedUid);
        if (!$targetMember) {
            return response()->json([
                'ok' => false,
                'message' => 'No matching member was found for that UID or handle.',
            ], 404);
        }

        $biometricsEnabled = (bool) (($targetMember->member_tool_preferences['fleet_command'] ?? true) !== false);
        if (!$biometricsEnabled) {
            return response()->json([
                'ok' => false,
                'message' => 'This member has not enabled Biometrics sharing.',
            ], 403);
        }

        $snapshot = SkillsToolMemberSkillSnapshot::query()
            ->where('user_id', $targetMember->id)
            ->first();
        $refreshResult = null;

        if (!$this->isSnapshotFresh($snapshot)) {
            $refresh = $this->refreshMemberSnapshot($targetMember, $snapshot);
            $snapshot = $refresh['snapshot'];
            $refreshResult = $refresh['result'];
        }

        if (!$snapshot || !is_array($snapshot->skills_payload)) {
            $status = (int) (($refreshResult['status'] ?? null) ?: 502);

            return response()->json([
                'ok' => false,
                'message' => (string) (($refreshResult['message'] ?? null) ?: 'No Biometrics snapshot is available for this member yet.'),
                'upstream_status' => $refreshResult['upstream_status'] ?? null,
            ], $status >= 400 ? $status : 502);
        }

        return response()->json([
            'ok' => true,
            'uid' => $snapshot->swc_uid,
            'auth_mode' => $snapshot->auth_mode ?? 'oauth',
            'fetched_at' => $snapshot->fetched_at?->toIso8601String(),
            'data' => $snapshot->skills_payload,
        ]);
    }

    protected function refreshRosterSnapshots(EloquentCollection $members): void
    {
        /** @var User $member */
        foreach ($members as $member) {
            $snapshot = SkillsToolMemberSkillSnapshot::query()
                ->where('user_id', $member->id)
                ->first();

            if ($this->isSnapshotFresh($snapshot)) {
                continue;
            }

            $this->refreshMemberSnapshot($member, $snapshot);
        }
    }

    /**
     * @return array{snapshot: SkillsToolMemberSkillSnapshot|null, result: array|null}
     */
    protected function refreshMemberSnapshot(User $member, ?SkillsToolMemberSkillSnapshot $existingSnapshot = null): array
    {
        $canonicalUid = '1:' . (string) $member->swc_character_id;
        $lockKey = sprintf('skills_tool_refresh_member:%d', (int) $member->id);
        $lock = Cache::lock($lockKey, 45);

        if (!$lock->get()) {
            $latest = SkillsToolMemberSkillSnapshot::query()->where('user_id', $member->id)->first();
            return [
                'snapshot' => $latest ?: $existingSnapshot,
                'result' => null,
            ];
        }

        try {
            $snapshot = SkillsToolMemberSkillSnapshot::query()
                ->where('user_id', $member->id)
                ->first();

            if ($this->isSnapshotFresh($snapshot)) {
                return [
                    'snapshot' => $snapshot,
                    'result' => null,
                ];
            }

            $result = $this->swcSkillsToolService->fetchCharacterSkills($member, $canonicalUid);
            $now = now();

            $data = [
                'swc_character_id' => (int) $member->swc_character_id,
                'swc_uid' => $canonicalUid,
                'swc_handle' => $member->swc_handle,
                'last_attempted_at' => $now,
                'upstream_status' => (int) (($result['status'] ?? null) ?: 0) ?: null,
                'auth_mode' => isset($result['auth_mode']) ? (string) $result['auth_mode'] : null,
                'error_message' => null,
            ];

            if (($result['ok'] ?? false) === true) {
                $data['skills_payload'] = $result['data'] ?? null;
                $data['fetched_at'] = $now;
            } else {
                $data['error_message'] = (string) (($result['message'] ?? null) ?: 'Failed to refresh Biometrics snapshot.');
            }

            SkillsToolMemberSkillSnapshot::query()->updateOrCreate(
                ['user_id' => $member->id],
                $data
            );

            $fresh = SkillsToolMemberSkillSnapshot::query()
                ->where('user_id', $member->id)
                ->first();

            return [
                'snapshot' => $fresh,
                'result' => $result,
            ];
        } finally {
            $lock->release();
        }
    }

    protected function isSnapshotFresh(?SkillsToolMemberSkillSnapshot $snapshot): bool
    {
        if (!$snapshot || !$snapshot->fetched_at || !is_array($snapshot->skills_payload)) {
            return false;
        }

        return $snapshot->fetched_at->gte(now()->subHours(self::SNAPSHOT_TTL_HOURS));
    }

    protected function buildRosterMatrixRow(User $member, ?SkillsToolMemberSkillSnapshot $snapshot): array
    {
        $payload = is_array($snapshot?->skills_payload) ? $snapshot->skills_payload : null;
        $strength = $this->extractSkillValueFromPayload($payload, 'strength');
        $dexterity = $this->extractSkillValueFromPayload($payload, 'dexterity');
        $speed = $this->extractSkillValueFromPayload($payload, 'speed');
        $dodge = $this->extractSkillValueFromPayload($payload, 'dodge');
        $projectile = $this->extractSkillValueFromPayload($payload, 'projectile');
        $nonProjectile = $this->extractSkillValueFromPayload($payload, 'nonProjectile');

        $fighterPiloting = $this->extractSkillValueFromPayload($payload, 'fighterPiloting');
        $fighterCombat = $this->extractSkillValueFromPayload($payload, 'fighterCombat');
        $capitalPiloting = $this->extractSkillValueFromPayload($payload, 'capitalPiloting');
        $capitalCombat = $this->extractSkillValueFromPayload($payload, 'capitalCombat');
        $spaceCommand = $this->extractSkillValueFromPayload($payload, 'spaceCommand');

        $vehiclePiloting = $this->extractSkillValueFromPayload($payload, 'vehiclePiloting');
        $vehicleCombat = $this->extractSkillValueFromPayload($payload, 'vehicleCombat');
        $infantryCommand = $this->extractSkillValueFromPayload($payload, 'infantryCommand');
        $vehicleCommand = $this->extractSkillValueFromPayload($payload, 'vehicleCommand');
        $heavyWeapons = $this->extractSkillValueFromPayload($payload, 'heavyWeapons');

        $medical = $this->extractSkillValueFromPayload($payload, 'medical');
        $diplomacy = $this->extractSkillValueFromPayload($payload, 'diplomacy');
        $crafting = $this->extractSkillValueFromPayload($payload, 'crafting');
        $management = $this->extractSkillValueFromPayload($payload, 'management');
        $perception = $this->extractSkillValueFromPayload($payload, 'perception');
        $stealth = $this->extractSkillValueFromPayload($payload, 'stealth');

        $rndHull = $this->extractSkillValueFromPayload($payload, 'rndHull');
        $rndElectronics = $this->extractSkillValueFromPayload($payload, 'rndElectronics');
        $rndEngines = $this->extractSkillValueFromPayload($payload, 'rndEngines');
        $rndWeapons = $this->extractSkillValueFromPayload($payload, 'rndWeapons');
        $repair = $this->extractSkillValueFromPayload($payload, 'repair');
        $compOps = $this->extractSkillValueFromPayload($payload, 'compOps');

        $fighterGarrisonScore = $this->sumSkills([$fighterPiloting, $fighterCombat, $spaceCommand]);

        return [
            'id' => $member->id,
            'handle' => $member->swc_handle,
            'swc_character_id' => $member->swc_character_id,
            'swc_uid' => $member->swc_character_id ? ('1:' . $member->swc_character_id) : null,
            'avatar_url' => $member->swc_avatar_url,
            'strength' => $strength,
            'dexterity' => $dexterity,
            'speed' => $speed,
            'dodge' => $dodge,
            'projectile' => $projectile,
            'non_projectile' => $nonProjectile,
            'fighter_piloting' => $fighterPiloting,
            'fighter_combat' => $fighterCombat,
            'capital_piloting' => $capitalPiloting,
            'capital_combat' => $capitalCombat,
            'space_command' => $spaceCommand,
            'vehicle_piloting' => $vehiclePiloting,
            'vehicle_combat' => $vehicleCombat,
            'infantry_command' => $infantryCommand,
            'vehicle_command' => $vehicleCommand,
            'heavy_weapons' => $heavyWeapons,
            'medical' => $medical,
            'diplomacy' => $diplomacy,
            'crafting' => $crafting,
            'management' => $management,
            'perception' => $perception,
            'stealth' => $stealth,
            'rnd_hull' => $rndHull,
            'rnd_electronics' => $rndElectronics,
            'rnd_engines' => $rndEngines,
            'rnd_weapons' => $rndWeapons,
            'repair' => $repair,
            'comp_ops' => $compOps,
            'fighter_garrison_score' => $fighterGarrisonScore,
            'has_snapshot' => is_array($payload),
            'fetched_at' => $snapshot?->fetched_at?->toIso8601String(),
            'snapshot_error' => $snapshot?->error_message,
        ];
    }

    protected function extractSkillValueFromPayload(?array $payload, string $skillType): ?int
    {
        if (!$payload) {
            return null;
        }

        $groups = data_get($payload, 'swcapi.skills');
        if (!is_array($groups)) {
            return null;
        }

        foreach ($groups as $groupRows) {
            if (!is_array($groupRows)) {
                continue;
            }

            foreach ($groupRows as $row) {
                if (!is_array($row)) {
                    continue;
                }

                $skills = data_get($row, 'skill');
                if (!is_array($skills)) {
                    continue;
                }

                foreach ($skills as $entry) {
                    if (!is_array($entry)) {
                        continue;
                    }

                    $type = trim((string) data_get($entry, 'attributes.type', ''));
                    if ($type !== $skillType) {
                        continue;
                    }

                    $value = data_get($entry, 'value');
                    if ($value === null || $value === '') {
                        return null;
                    }

                    return is_numeric((string) $value) ? (int) $value : null;
                }
            }
        }

        return null;
    }

    protected function sumSkills(array $values): ?int
    {
        $hasAny = false;
        $total = 0;

        foreach ($values as $value) {
            if ($value === null) {
                continue;
            }

            $hasAny = true;
            $total += (int) $value;
        }

        return $hasAny ? $total : null;
    }

    protected function resolveTargetMember(string $uid): ?User
    {
        $candidate = $this->normalizeUidInput($uid);
        if ($candidate === '') {
            return null;
        }

        $candidateLower = strtolower($candidate);
        $characterId = null;

        if (str_starts_with($candidateLower, '1:')) {
            $suffix = substr($candidate, 2);
            if ($suffix !== '' && ctype_digit($suffix)) {
                $characterId = (int) $suffix;
            }
        } elseif (ctype_digit($candidate)) {
            $characterId = (int) $candidate;
        }

        $query = User::query()
            ->where('is_joe_member', true)
            ->whereNotNull('swc_character_id');

        if ($characterId !== null) {
            return $query
                ->where('swc_character_id', $characterId)
                ->first();
        }

        return $query
            ->whereRaw('LOWER(COALESCE(swc_handle, "")) = ?', [strtolower($candidate)])
            ->first();
    }

    protected function normalizeUidInput(string $value): string
    {
        $normalized = trim(urldecode($value));

        // Accept pasted SWC path fragments like /character/1:12345/skills/
        if (preg_match('#character/([^/]+)/skills#i', $normalized, $matches) === 1) {
            $normalized = (string) ($matches[1] ?? $normalized);
        }

        // Strip wrapping slashes that users may paste accidentally.
        $normalized = trim($normalized, "/ \t\n\r\0\x0B");

        return $normalized;
    }
}
