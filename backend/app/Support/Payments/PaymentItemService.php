<?php

namespace App\Support\Payments;

use App\Models\Job;
use App\Models\JobAssignment;
use App\Models\PaymentItem;

class PaymentItemService
{
    public function syncForCompletedJob(Job $job, bool $includeBonus = true): PaymentItem
    {
        $appliedBonusAmount = $includeBonus ? (int) $job->bonus_amount : 0;
        $total = $this->calculateTotal(
            (int) $job->reward_amount,
            $appliedBonusAmount,
            (string) $job->pay_type,
            $job->days_taken
        );

        return PaymentItem::updateOrCreate(
            [
                'source_type' => 'job',
                'source_id' => $job->id,
            ],
            [
                'tool_key' => 'jobs',
                'payer_subject_type' => $job->payer_subject_type,
                'payer_subject_id' => $job->payer_subject_id,
                'payer_label' => $job->payer_label,
                'payee_subject_type' => 'user',
                'payee_subject_id' => $job->assigned_to_user_id,
                'payee_swc_uid' => $job->assigned_to_swc_uid,
                'payee_handle' => $job->assigned_to_handle,
                'payee_label' => $job->assigned_to_handle,
                'amount' => (int) $job->reward_amount,
                'bonus_amount' => $appliedBonusAmount,
                'total_amount' => $total,
                'status' => 'pending',
                'meta' => [
                    'job_id' => $job->id,
                    'job_title' => $job->title,
                    'job_mode' => $job->job_mode,
                    'pay_type' => $job->pay_type,
                    'days_taken' => $job->days_taken,
                    'bonus_awarded' => $includeBonus,
                ],
            ]
        );
    }

    public function syncForCompletedAssignment(JobAssignment $assignment, bool $includeBonus = true): PaymentItem
    {
        $job = $assignment->job;
        $appliedBonusAmount = $includeBonus ? (int) $job->bonus_amount : 0;

        $total = $this->calculateTotal(
            (int) $job->reward_amount,
            $appliedBonusAmount,
            (string) $job->pay_type,
            $assignment->days_taken
        );

        return PaymentItem::updateOrCreate(
            [
                'source_type' => 'job_assignment',
                'source_id' => $assignment->id,
            ],
            [
                'tool_key' => 'jobs',
                'payer_subject_type' => $job->payer_subject_type,
                'payer_subject_id' => $job->payer_subject_id,
                'payer_label' => $job->payer_label,
                'payee_subject_type' => 'user',
                'payee_subject_id' => $assignment->worker_user_id,
                'payee_swc_uid' => $assignment->worker_swc_uid,
                'payee_handle' => $assignment->worker_handle,
                'payee_label' => $assignment->worker_handle,
                'amount' => (int) $job->reward_amount,
                'bonus_amount' => $appliedBonusAmount,
                'total_amount' => $total,
                'status' => 'pending',
                'meta' => [
                    'job_id' => $job->id,
                    'job_title' => $job->title,
                    'assignment_id' => $assignment->id,
                    'job_mode' => $job->job_mode,
                    'pay_type' => $job->pay_type,
                    'days_taken' => $assignment->days_taken,
                    'bonus_awarded' => $includeBonus,
                ],
            ]
        );
    }

    protected function calculateTotal(int $rewardAmount, int $bonusAmount, string $payType, ?int $daysTaken): int
    {
        if ($payType === 'per_day_hyper') {
            return max(0, $rewardAmount * max(0, (int) $daysTaken)) + max(0, $bonusAmount);
        }

        return max(0, $rewardAmount) + max(0, $bonusAmount);
    }
}
