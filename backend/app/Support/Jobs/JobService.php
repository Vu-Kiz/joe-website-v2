<?php

namespace App\Support\Jobs;

use App\Models\Job;
use App\Models\JobAssignment;
use App\Models\User;
use App\Support\Payments\PaymentItemService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class JobService
{
    public function __construct(
        protected PaymentItemService $paymentItemService
    ) {
    }

    public function createJob(User $user, array $data): Job
    {
        $payerType = $data['payer_subject_type'] ?? 'user';
        $payerId = $data['payer_subject_id'] ?? null;
        $payerLabel = $data['payer_label'] ?? ($user->swc_handle ?? 'Unknown');

        if ($payerType === 'user') {
            $payerId = $user->id;
            $payerLabel = $user->swc_handle ?? 'Unknown';
        }

        return Job::create([
            'title' => trim((string) ($data['title'] ?? '')),
            'description' => $data['description'] ?? null,
            'status' => 'open',
            'job_mode' => $data['job_mode'] ?? 'single',
            'pay_type' => $data['pay_type'] ?? 'fixed',
            'reward_amount' => (int) ($data['reward_amount'] ?? 0),
            'bonus_amount' => (int) ($data['bonus_amount'] ?? 0),
            'bonus_reward' => $data['bonus_reward'] ?? null,
            'bonus_note' => $data['bonus_note'] ?? null,
            'payer_subject_type' => $payerType,
            'payer_subject_id' => $payerId,
            'payer_label' => $payerLabel,
            'created_by_user_id' => $user->id,
            'created_by_swc_uid' => (string) ($user->swc_character_id ?? ''),
            'created_by_handle' => (string) ($user->swc_handle ?? 'Unknown'),
        ]);
    }

    public function takeSingleJob(Job $job, User $user): Job
    {
        if ($job->job_mode !== 'single') {
            throw new InvalidArgumentException('Only single jobs can be taken directly.');
        }

        if ($job->status !== 'open') {
            throw new InvalidArgumentException('This job is not open.');
        }

        $job->update([
            'status' => 'assigned',
            'assigned_to_user_id' => $user->id,
            'assigned_to_swc_uid' => (string) ($user->swc_character_id ?? ''),
            'assigned_to_handle' => (string) ($user->swc_handle ?? 'Unknown'),
        ]);

        return $job->fresh();
    }

    public function completeSingleJob(Job $job, User $user, ?int $daysTaken = null): Job
    {
        if ($job->job_mode !== 'single') {
            throw new InvalidArgumentException('Only single jobs can be completed this way.');
        }

        if ((int) $job->assigned_to_user_id !== (int) $user->id) {
            throw new InvalidArgumentException('You are not assigned to this job.');
        }

        return DB::transaction(function () use ($job, $daysTaken) {
            $job->update([
                'status' => 'completed',
                'days_taken' => $daysTaken,
                'completed_at' => now(),
            ]);

            $this->paymentItemService->syncForCompletedJob($job->fresh());

            return $job->fresh();
        });
    }

    public function createAssignment(Job $job, User $user): JobAssignment
    {
        if ($job->job_mode !== 'multi') {
            throw new InvalidArgumentException('Assignments are only for multi jobs.');
        }

        return JobAssignment::firstOrCreate(
            [
                'job_id' => $job->id,
                'worker_swc_uid' => (string) ($user->swc_character_id ?? ''),
            ],
            [
                'worker_user_id' => $user->id,
                'worker_handle' => (string) ($user->swc_handle ?? 'Unknown'),
                'status' => 'in_progress',
            ]
        );
    }

    public function completeAssignment(JobAssignment $assignment, User $user, ?int $daysTaken = null): JobAssignment
    {
        if ((int) $assignment->worker_user_id !== (int) $user->id) {
            throw new InvalidArgumentException('You do not own this assignment.');
        }

        return DB::transaction(function () use ($assignment, $daysTaken) {
            $assignment->update([
                'status' => 'completed',
                'days_taken' => $daysTaken,
                'completed_at' => now(),
            ]);

            $this->paymentItemService->syncForCompletedAssignment($assignment->fresh()->load('job'));

            return $assignment->fresh();
        });
    }

    public function closeOpenEndedJob(Job $job, User $user): Job
    {
        if ((int) $job->created_by_user_id !== (int) $user->id) {
            throw new InvalidArgumentException('Only the creator can close this job.');
        }

        if ($job->job_mode !== 'open_ended') {
            throw new InvalidArgumentException('Only open-ended jobs can be closed this way.');
        }

        $job->update([
            'status' => 'closed',
            'closed_at' => now(),
        ]);

        return $job->fresh();
    }
}