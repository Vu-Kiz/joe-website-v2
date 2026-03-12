<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Models\JobAssignment;
use App\Support\Jobs\JobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobsController extends Controller
{
    public function __construct(
        protected JobService $jobService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Job::query()
            ->with('assignments')
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('scope') && $user) {
            if ($request->string('scope') === 'mine_posted') {
                $query->where('created_by_user_id', $user->id);
            }

            if ($request->string('scope') === 'mine_taken') {
                $query->where(function ($q) use ($user) {
                    $q->where('assigned_to_user_id', $user->id)
                      ->orWhereHas('assignments', function ($q2) use ($user) {
                          $q2->where('worker_user_id', $user->id);
                      });
                });
            }
        }

        return response()->json([
            'ok' => true,
            'data' => $query->get(),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $job = Job::with('assignments')->findOrFail($id);

        return response()->json([
            'ok' => true,
            'data' => $job,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'job_mode' => ['required', 'in:single,multi,open_ended'],
            'pay_type' => ['required', 'in:fixed,per_day_hyper'],
            'reward_amount' => ['required', 'integer', 'min:0'],
            'bonus_amount' => ['nullable', 'integer', 'min:0'],
            'bonus_reward' => ['nullable', 'string', 'max:255'],
            'bonus_note' => ['nullable', 'string', 'max:255'],
            'payer_subject_type' => ['required', 'in:user,faction'],
            'payer_subject_id' => ['nullable', 'integer'],
            'payer_label' => ['nullable', 'string', 'max:150'],
        ]);

        $job = $this->jobService->createJob($user, $data);

        return response()->json([
            'ok' => true,
            'data' => $job,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $user = $request->user();

        if (!$user || (int) $job->created_by_user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'bonus_amount' => ['sometimes', 'integer', 'min:0'],
            'bonus_reward' => ['nullable', 'string', 'max:255'],
            'bonus_note' => ['nullable', 'string', 'max:255'],
        ]);

        $job->update($data);

        return response()->json([
            'ok' => true,
            'data' => $job->fresh(),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $user = $request->user();

        if (!$user || (int) $job->created_by_user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $job->delete();

        return response()->json([
            'ok' => true,
        ]);
    }

    public function take(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $job = $this->jobService->takeSingleJob($job, $user);

        return response()->json([
            'ok' => true,
            'data' => $job,
        ]);
    }

    public function complete(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'days_taken' => ['nullable', 'integer', 'min:0'],
        ]);

        $job = $this->jobService->completeSingleJob($job, $user, $data['days_taken'] ?? null);

        return response()->json([
            'ok' => true,
            'data' => $job,
        ]);
    }

    public function close(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $job = $this->jobService->closeOpenEndedJob($job, $user);

        return response()->json([
            'ok' => true,
            'data' => $job,
        ]);
    }

    public function join(Request $request, int $id): JsonResponse
    {
        $job = Job::findOrFail($id);
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $assignment = $this->jobService->createAssignment($job, $user);

        return response()->json([
            'ok' => true,
            'data' => $assignment,
        ], 201);
    }

    public function completeAssignment(Request $request, int $id): JsonResponse
    {
        $assignment = JobAssignment::with('job')->findOrFail($id);
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $data = $request->validate([
            'days_taken' => ['nullable', 'integer', 'min:0'],
        ]);

        $assignment = $this->jobService->completeAssignment($assignment, $user, $data['days_taken'] ?? null);

        return response()->json([
            'ok' => true,
            'data' => $assignment,
        ]);
    }
}