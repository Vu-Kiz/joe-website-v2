<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Member;

use App\Http\Controllers\Controller;
use App\Models\BountyContract;
use App\Models\BountyContractScan;
use App\Models\Swc\SwcPlanet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BountyHuntingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $contracts = BountyContract::query()
            ->where('user_id', $user->id)
            ->with('scans')
            ->orderByRaw('deadline_at is null')
            ->orderBy('deadline_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $contracts->map(fn (BountyContract $contract) => $this->serializeContract($contract))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'target_name' => ['required', 'string', 'max:255'],
            'difficulty' => ['required', 'integer', 'min:1', 'max:5'],
            'contract_type' => ['required', 'string', 'in:kill,rescue'],
            'deadline_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'accepted_galx' => ['nullable', 'integer'],
            'accepted_galy' => ['nullable', 'integer'],
        ]);

        $contract = BountyContract::query()->create([
            ...$validated,
            'user_id' => $user->id,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Bounty contract added.',
            'data' => $this->serializeContract($contract),
        ]);
    }

    public function update(Request $request, BountyContract $bountyContract): JsonResponse
    {
        $user = $request->user();
        if ((int) $bountyContract->user_id !== (int) $user->id) {
            return response()->json(['message' => 'That bounty contract does not belong to you.'], 403);
        }

        $validated = $request->validate([
            'target_name' => ['sometimes', 'string', 'max:255'],
            'difficulty' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'contract_type' => ['sometimes', 'string', 'in:kill,rescue'],
            'status' => ['sometimes', 'string', 'in:active,completed,failed'],
            'deadline_at' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'estimated_galx' => ['sometimes', 'nullable', 'integer'],
            'estimated_galy' => ['sometimes', 'nullable', 'integer'],
        ]);

        $bountyContract->update($validated);

        return response()->json([
            'ok' => true,
            'message' => 'Bounty contract updated.',
            'data' => $this->serializeContract($bountyContract->fresh('scans')),
        ]);
    }

    public function destroy(Request $request, BountyContract $bountyContract): JsonResponse
    {
        $user = $request->user();
        if ((int) $bountyContract->user_id !== (int) $user->id) {
            return response()->json(['message' => 'That bounty contract does not belong to you.'], 403);
        }

        $bountyContract->delete();

        return response()->json([
            'ok' => true,
            'message' => 'Bounty contract deleted.',
        ]);
    }

    public function storeScan(Request $request, BountyContract $bountyContract): JsonResponse
    {
        $user = $request->user();
        if ((int) $bountyContract->user_id !== (int) $user->id) {
            return response()->json(['message' => 'That bounty contract does not belong to you.'], 403);
        }

        $validated = $request->validate([
            'scan_galx' => ['required', 'integer'],
            'scan_galy' => ['required', 'integer'],
            'bearing_degrees' => ['required', 'numeric', 'min:0', 'max:359.9'],
            'range_band' => ['nullable', 'string', 'in:bearing_only,inner,mid,outer,beyond_100'],
        ]);

        $bountyContract->scans()->create($validated);

        return response()->json([
            'ok' => true,
            'message' => 'Scan logged.',
            'data' => $this->serializeContract($bountyContract->fresh('scans')),
        ]);
    }

    public function updateScan(Request $request, BountyContract $bountyContract, BountyContractScan $scan): JsonResponse
    {
        $user = $request->user();
        if ((int) $bountyContract->user_id !== (int) $user->id) {
            return response()->json(['message' => 'That bounty contract does not belong to you.'], 403);
        }
        if ((int) $scan->bounty_contract_id !== (int) $bountyContract->id) {
            return response()->json(['message' => 'That scan does not belong to this contract.'], 404);
        }

        $validated = $request->validate([
            'scan_galx' => ['required', 'integer'],
            'scan_galy' => ['required', 'integer'],
            'bearing_degrees' => ['required', 'numeric', 'min:0', 'max:359.9'],
            'range_band' => ['nullable', 'string', 'in:bearing_only,inner,mid,outer,beyond_100'],
        ]);

        $scan->update($validated);

        return response()->json([
            'ok' => true,
            'message' => 'Scan updated.',
            'data' => $this->serializeContract($bountyContract->fresh('scans')),
        ]);
    }

    public function destroyScan(Request $request, BountyContract $bountyContract, BountyContractScan $scan): JsonResponse
    {
        $user = $request->user();
        if ((int) $bountyContract->user_id !== (int) $user->id) {
            return response()->json(['message' => 'That bounty contract does not belong to you.'], 403);
        }
        if ((int) $scan->bounty_contract_id !== (int) $bountyContract->id) {
            return response()->json(['message' => 'That scan does not belong to this contract.'], 404);
        }

        $scan->delete();

        return response()->json([
            'ok' => true,
            'message' => 'Scan deleted.',
            'data' => $this->serializeContract($bountyContract->fresh('scans')),
        ]);
    }

    // Targets only ever spawn on worlds owned by these two NPC factions (SWC docs §5.3).
    protected const CANDIDATE_OWNERS = ['Darkness', 'Quests'];

    // Nearest-worlds percentile per difficulty tier. Challenging/Daunting have no
    // documented distance restriction, so they return every qualifying world.
    protected const DISTANCE_PERCENTILE = [1 => 0.30, 2 => 0.50, 3 => 0.70, 4 => 1.0, 5 => 1.0];

    public function candidateWorlds(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'galx' => ['required', 'integer'],
            'galy' => ['required', 'integer'],
            'difficulty' => ['required', 'integer', 'min:1', 'max:5'],
        ]);

        $galx = $validated['galx'];
        $galy = $validated['galy'];
        $difficulty = $validated['difficulty'];

        // Selecting only the cached counts (not terrain_grid/cities) keeps this query cheap —
        // those JSON columns can run into the hundreds of KB per planet.
        $planets = SwcPlanet::query()
            ->whereIn('owner_name', self::CANDIDATE_OWNERS)
            ->whereNotNull('galx')
            ->whereNotNull('galy')
            ->get(['id', 'name', 'system_name', 'owner_name', 'planet_type_name', 'galx', 'galy', 'valid_terrain_cell_count', 'terrain_cell_count']);

        $candidates = [];
        foreach ($planets as $planet) {
            // Cache not yet backfilled for this planet — assume it qualifies rather than
            // silently excluding every un-cached world from the candidate list.
            $validCells = $planet->valid_terrain_cell_count ?? 1;
            $totalCells = $planet->terrain_cell_count ?? 1;
            if ($validCells === 0) {
                continue; // every cell is excluded terrain/city — can never host a target
            }

            $candidates[] = [
                'id' => $planet->id,
                'name' => $planet->system_name ?? $planet->name,
                'owner_name' => $planet->owner_name,
                'planet_type_name' => $planet->planet_type_name,
                'galx' => $planet->galx,
                'galy' => $planet->galy,
                'distance' => round(hypot($planet->galx - $galx, $planet->galy - $galy), 1),
                'valid_cell_count' => $validCells,
                'total_cell_count' => $totalCells,
            ];
        }

        usort($candidates, fn ($a, $b) => $a['distance'] <=> $b['distance']);

        $totalCandidates = count($candidates);
        $percentile = self::DISTANCE_PERCENTILE[$difficulty];
        $suggestedCount = $totalCandidates > 0 ? max(1, (int) ceil($totalCandidates * $percentile)) : 0;

        // Return the full sorted list — the Worlds tab only displays the nearest
        // `suggested_count` of them, but the Tracking tab needs the full list to
        // resolve a triangulated point to its nearest named world.
        return response()->json([
            'ok' => true,
            'data' => $candidates,
            'meta' => [
                'total_candidates' => $totalCandidates,
                'suggested_count' => $suggestedCount,
            ],
        ]);
    }

    protected function serializeContract(BountyContract $contract): array
    {
        return [
            'id' => $contract->id,
            'target_name' => $contract->target_name,
            'difficulty' => $contract->difficulty,
            'contract_type' => $contract->contract_type,
            'status' => $contract->status,
            'deadline_at' => $contract->deadline_at?->toISOString(),
            'notes' => $contract->notes,
            'accepted_galx' => $contract->accepted_galx,
            'accepted_galy' => $contract->accepted_galy,
            'estimated_galx' => $contract->estimated_galx,
            'estimated_galy' => $contract->estimated_galy,
            'scans' => $contract->scans->map(fn (BountyContractScan $scan) => [
                'id' => $scan->id,
                'scan_galx' => $scan->scan_galx,
                'scan_galy' => $scan->scan_galy,
                'bearing_degrees' => $scan->bearing_degrees,
                'range_band' => $scan->range_band,
                'created_at' => $scan->created_at?->toISOString(),
            ])->values(),
            'created_at' => $contract->created_at?->toISOString(),
            'updated_at' => $contract->updated_at?->toISOString(),
        ];
    }
}
