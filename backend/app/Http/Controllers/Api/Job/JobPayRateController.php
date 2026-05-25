<?php

namespace App\Http\Controllers\Api\Job;

use App\Http\Controllers\Controller;
use App\Models\Faction;
use App\Models\Job\JobPayRate;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobPayRateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = JobPayRate::query()->orderBy('name');

        if (!($user && ((bool) $user->is_admin || (bool) $user->is_sysadmin))) {
            $query->where('status', 'active');
        }

        return response()->json([
            'ok' => true,
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || !((bool) $user->is_admin || (bool) $user->is_sysadmin)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'unit_label' => ['required', 'string', 'max:100'],
            'base_rate' => ['required', 'integer', 'min:0'],
            'bonus_rate' => ['nullable', 'integer', 'min:0'],
            'bonus_description' => ['nullable', 'string', 'max:255'],
            'payer_subject_type' => ['required', 'in:user,faction'],
            'payer_subject_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        [$payerLabel, $payerSubjectId] = $this->resolvePayer(
            $validated['payer_subject_type'],
            $validated['payer_subject_id'] ?? null
        );

        $rate = JobPayRate::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'unit_label' => $validated['unit_label'],
            'base_rate' => (int) $validated['base_rate'],
            'bonus_rate' => isset($validated['bonus_rate']) ? (int) $validated['bonus_rate'] : null,
            'bonus_description' => $validated['bonus_description'] ?? null,
            'payer_subject_type' => $validated['payer_subject_type'],
            'payer_subject_id' => $payerSubjectId,
            'payer_label' => $payerLabel,
            'status' => $validated['status'] ?? 'active',
            'created_by_user_id' => $user->id,
        ]);

        return response()->json([
            'ok' => true,
            'data' => $rate,
        ], 201);
    }

    public function update(Request $request, JobPayRate $jobPayRate): JsonResponse
    {
        $user = $request->user();

        if (!$user || !((bool) $user->is_admin || (bool) $user->is_sysadmin)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'unit_label' => ['sometimes', 'string', 'max:100'],
            'base_rate' => ['sometimes', 'integer', 'min:0'],
            'bonus_rate' => ['nullable', 'integer', 'min:0'],
            'bonus_description' => ['nullable', 'string', 'max:255'],
            'payer_subject_type' => ['sometimes', 'in:user,faction'],
            'payer_subject_id' => ['nullable', 'integer'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        if (array_key_exists('payer_subject_type', $validated)) {
            [$payerLabel, $payerSubjectId] = $this->resolvePayer(
                $validated['payer_subject_type'],
                $validated['payer_subject_id'] ?? null
            );
            $jobPayRate->payer_subject_type = $validated['payer_subject_type'];
            $jobPayRate->payer_subject_id = $payerSubjectId;
            $jobPayRate->payer_label = $payerLabel;
        }

        foreach (['name', 'description', 'unit_label', 'bonus_description', 'status'] as $field) {
            if (array_key_exists($field, $validated)) {
                $jobPayRate->{$field} = $validated[$field];
            }
        }

        foreach (['base_rate', 'bonus_rate'] as $field) {
            if (array_key_exists($field, $validated)) {
                $jobPayRate->{$field} = isset($validated[$field]) ? (int) $validated[$field] : null;
            }
        }

        $jobPayRate->save();

        return response()->json([
            'ok' => true,
            'data' => $jobPayRate->fresh(),
        ]);
    }

    public function destroy(Request $request, JobPayRate $jobPayRate): JsonResponse
    {
        $user = $request->user();

        if (!$user || !((bool) $user->is_admin || (bool) $user->is_sysadmin)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($jobPayRate->claims()->exists()) {
            return response()->json([
                'message' => 'This pay rate is already used by one or more pay claims and cannot be deleted. Set it to inactive instead.',
            ], 409);
        }

        try {
            $jobPayRate->delete();
        } catch (QueryException) {
            return response()->json([
                'message' => 'This pay rate is in use and cannot be deleted. Set it to inactive instead.',
            ], 409);
        }

        return response()->json(['ok' => true]);
    }

    protected function resolvePayer(string $type, ?int $id): array
    {
        if ($type === 'faction') {
            $faction = Faction::query()->find($id);
            return [
                $faction?->name ?? 'Unknown Faction',
                $id,
            ];
        }

        $user = User::query()->find($id);
        return [
            $user?->swc_handle ?? ('User #' . $id),
            $id,
        ];
    }
}
