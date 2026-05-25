<?php

namespace App\Support\Jobs;

use App\Models\Job\Job;
use App\Models\Job\JobAssignment;
use App\Models\Faction;
use App\Models\User;
use App\Support\Discord\DiscordNotifier;
use App\Support\Factions\FactionPermissionService;
use App\Support\Payments\PaymentItemService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JobService
{
    public function __construct(
        protected PaymentItemService $paymentItemService,
        protected FactionPermissionService $factionPermissionService,
        protected DiscordNotifier $discordNotifier
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
        } else {
            if (!$payerId) {
                throw ValidationException::withMessages([
                    'payer_subject_id' => 'Choose a faction payer.',
                ]);
            }

            if (!$this->factionPermissionService->canPayFromFaction($user, (int) $payerId)) {
                throw ValidationException::withMessages([
                    'payer_subject_id' => 'You cannot create jobs payable from that faction.',
                ]);
            }

            $faction = Faction::query()->find($payerId);

            if (!$faction) {
                throw ValidationException::withMessages([
                    'payer_subject_id' => 'That faction payer could not be found.',
                ]);
            }

            $payerLabel = $faction->name;
        }

        $job = Job::create([
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

        $this->discordNotifier->postJobCreated($job);

        return $job;
    }

    public function takeSingleJob(Job $job, User $user): Job
    {
        if ($job->job_mode !== 'single') {
            throw ValidationException::withMessages([
                'job' => 'Only single jobs can be taken directly.',
            ]);
        }

        if ($job->status !== 'open') {
            throw ValidationException::withMessages([
                'job' => 'This job is not open.',
            ]);
        }

        $job->update([
            'status' => 'assigned',
            'assigned_to_user_id' => $user->id,
            'assigned_to_swc_uid' => (string) ($user->swc_character_id ?? ''),
            'assigned_to_handle' => (string) ($user->swc_handle ?? 'Unknown'),
        ]);

        return $job->fresh();
    }

    public function completeSingleJob(Job $job, User $user, ?int $daysTaken = null, bool $includeBonus = false): Job
    {
        if ($job->job_mode !== 'single') {
            throw ValidationException::withMessages([
                'job' => 'Only single jobs can be completed this way.',
            ]);
        }

        if ((int) $job->assigned_to_user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'job' => 'You are not assigned to this job.',
            ]);
        }

        return DB::transaction(function () use ($job, $daysTaken, $includeBonus) {
            $meta = (array) ($job->meta ?? []);
            $meta['bonus_awarded'] = null;

            $job->update([
                'status' => 'completed',
                'days_taken' => $daysTaken,
                'completed_at' => now(),
                'meta' => $meta,
            ]);

            $this->paymentItemService->syncForCompletedJob($job->fresh(), $includeBonus);

            return $job->fresh();
        });
    }

    public function createAssignment(Job $job, User $user): JobAssignment
    {
        if ($job->job_mode !== 'multi') {
            throw ValidationException::withMessages([
                'job' => 'Assignments are only for multi jobs.',
            ]);
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

    public function completeAssignment(JobAssignment $assignment, User $user, ?int $daysTaken = null, bool $includeBonus = false): JobAssignment
    {
        if ((int) $assignment->worker_user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'assignment' => 'You do not own this assignment.',
            ]);
        }

        return DB::transaction(function () use ($assignment, $daysTaken, $includeBonus) {
            $meta = (array) ($assignment->meta ?? []);
            $meta['bonus_awarded'] = null;

            $assignment->update([
                'status' => 'completed',
                'days_taken' => $daysTaken,
                'completed_at' => now(),
                'meta' => $meta,
            ]);

            $this->paymentItemService->syncForCompletedAssignment($assignment->fresh()->load('job'), $includeBonus);

            return $assignment->fresh();
        });
    }

    public function setCompletedJobBonus(Job $job, User $user, bool $includeBonus): Job
    {
        if ((int) $job->created_by_user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'job' => 'Only the job poster can set the bonus.',
            ]);
        }

        if ($job->status !== 'completed') {
            throw ValidationException::withMessages([
                'job' => 'The job must be completed before the bonus can be set.',
            ]);
        }

        return DB::transaction(function () use ($job, $includeBonus) {
            $meta = (array) ($job->meta ?? []);
            $meta['bonus_awarded'] = $includeBonus;

            $job->update([
                'meta' => $meta,
            ]);

            $this->paymentItemService->syncForCompletedJob($job->fresh(), $includeBonus);

            return $job->fresh();
        });
    }

    public function setCompletedAssignmentBonus(JobAssignment $assignment, User $user, bool $includeBonus): JobAssignment
    {
        $job = $assignment->job;

        if ((int) $job->created_by_user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'assignment' => 'Only the job poster can set the bonus.',
            ]);
        }

        if ($assignment->status !== 'completed') {
            throw ValidationException::withMessages([
                'assignment' => 'The assignment must be completed before the bonus can be set.',
            ]);
        }

        return DB::transaction(function () use ($assignment, $includeBonus) {
            $meta = (array) ($assignment->meta ?? []);
            $meta['bonus_awarded'] = $includeBonus;

            $assignment->update([
                'meta' => $meta,
            ]);

            $this->paymentItemService->syncForCompletedAssignment($assignment->fresh()->load('job'), $includeBonus);

            return $assignment->fresh();
        });
    }

    public function closeOpenEndedJob(Job $job, User $user): Job
    {
        if ((int) $job->created_by_user_id !== (int) $user->id) {
            throw ValidationException::withMessages([
                'job' => 'Only the creator can close this job.',
            ]);
        }

        if ($job->job_mode !== 'open_ended') {
            throw ValidationException::withMessages([
                'job' => 'Only open-ended jobs can be closed this way.',
            ]);
        }

        $job->update([
            'status' => 'closed',
            'closed_at' => now(),
        ]);

        return $job->fresh();
    }
}
