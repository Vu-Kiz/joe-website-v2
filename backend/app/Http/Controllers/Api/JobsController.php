<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobsController extends Controller
{
    /**
     * GET /api/jobs
     * List jobs – stub data for now.
     */
    public function index(): JsonResponse
    {
        // TODO: replace with Job::query()->latest()->paginate(...)
        $jobs = [
            [
                'id'          => 1,
                'title'       => 'Escort convoy from Tatooine to Corellia',
                'status'      => 'open',
                'reward'      => 2500000,
                'currency'    => 'credits',
                'created_at'  => now()->subDays(2)->toIso8601String(),
                'updated_at'  => now()->subDay()->toIso8601String(),
            ],
            [
                'id'          => 2,
                'title'       => 'Salvage operation in Outer Rim',
                'status'      => 'in_progress',
                'reward'      => 5000000,
                'currency'    => 'credits',
                'created_at'  => now()->subDays(5)->toIso8601String(),
                'updated_at'  => now()->toIso8601String(),
            ],
        ];

        return response()->json([
            'data' => $jobs,
        ]);
    }

    /**
     * GET /api/jobs/{id}
     * Show a single job – stub detail.
     */
    public function show(int $id): JsonResponse
    {
        // TODO: replace with Job::findOrFail($id)
        $job = [
            'id'          => $id,
            'title'       => "Example Job #{$id}",
            'description' => 'This is a placeholder job. Replace with real data from the database.',
            'status'      => 'open',
            'reward'      => 1000000,
            'currency'    => 'credits',
            'created_at'  => now()->subDays(3)->toIso8601String(),
            'updated_at'  => now()->toIso8601String(),
        ];

        return response()->json([
            'data' => $job,
        ]);
    }

    /**
     * POST /api/jobs
     * Create a job (stub – no DB write yet).
     */
    public function store(Request $request): JsonResponse
    {
        // TODO: validate + persist:
        // $data = $request->validate([...]);
        // $job  = Job::create($data);

        $data = $request->only(['title', 'description', 'reward', 'currency']);

        return response()->json([
            'message' => 'Job creation stub – implement persistence later.',
            'input'   => $data,
        ], 201);
    }

    /**
     * PUT /api/jobs/{id}
     * Update a job (stub – no DB write yet).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        // TODO: validate + update:
        // $data = $request->validate([...]);
        // $job  = Job::findOrFail($id);
        // $job->update($data);

        $data = $request->only(['title', 'description', 'reward', 'currency', 'status']);

        return response()->json([
            'message' => 'Job update stub – implement persistence later.',
            'id'      => $id,
            'input'   => $data,
        ]);
    }

    /**
     * DELETE /api/jobs/{id}
     * Delete a job (stub – no DB delete yet).
     */
    public function destroy(int $id): JsonResponse
    {
        // TODO: Job::findOrFail($id)->delete();

        return response()->json([
            'message' => 'Job delete stub – implement persistence later.',
            'id'      => $id,
        ]);
    }
}
