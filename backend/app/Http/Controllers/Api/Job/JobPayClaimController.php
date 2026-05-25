<?php

namespace App\Http\Controllers\Api\Job;

use App\Http\Controllers\Controller;
use App\Models\Job\JobPayClaim;
use App\Models\Job\JobPayRate;
use App\Models\Payment\PaymentItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobPayClaimController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $query = JobPayClaim::query()
            ->with('payRate')
            ->latest();

        if (!((bool) $user->is_admin || (bool) $user->is_sysadmin)) {
            $query->where('claimant_user_id', $user->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json([
            'ok' => true,
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validate([
            'job_pay_rate_id' => ['required', 'integer', 'exists:job_pay_rates,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'include_bonus' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $rate = JobPayRate::query()
            ->where('id', $validated['job_pay_rate_id'])
            ->where('status', 'active')
            ->first();

        if (!$rate) {
            return response()->json(['message' => 'That pay rate is not available.'], 422);
        }

        $quantity = (int) $validated['quantity'];
        $includeBonus = (bool) ($validated['include_bonus'] ?? false);

        $baseTotal = $quantity * (int) $rate->base_rate;
        $bonusTotal = ($includeBonus && $rate->bonus_rate) ? $quantity * (int) $rate->bonus_rate : 0;
        $totalAmount = $baseTotal + $bonusTotal;

        $claim = JobPayClaim::create([
            'job_pay_rate_id' => $rate->id,
            'claimant_user_id' => $user->id,
            'claimant_swc_uid' => $user->swc_character_id ? '1:' . $user->swc_character_id : null,
            'claimant_handle' => $user->swc_handle,
            'quantity' => $quantity,
            'include_bonus' => $includeBonus,
            'base_total' => $baseTotal,
            'bonus_total' => $bonusTotal,
            'total_amount' => $totalAmount,
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json([
            'ok' => true,
            'data' => $claim->load('payRate'),
        ], 201);
    }

    public function approve(Request $request, JobPayClaim $jobPayClaim): JsonResponse
    {
        $user = $request->user();

        if (!$user || !((bool) $user->is_admin || (bool) $user->is_sysadmin)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($jobPayClaim->status !== 'pending') {
            return response()->json(['message' => 'Only pending claims can be approved.'], 422);
        }

        $validated = $request->validate([
            'review_note' => ['nullable', 'string', 'max:500'],
        ]);

        $rate = $jobPayClaim->payRate;

        $paymentItem = PaymentItem::create([
            'tool_key' => 'job_pay_claims',
            'source_type' => 'job_pay_claim',
            'source_id' => $jobPayClaim->id,
            'payer_subject_type' => $rate->payer_subject_type,
            'payer_subject_id' => $rate->payer_subject_id,
            'payer_label' => $rate->payer_label,
            'payee_subject_type' => 'user',
            'payee_subject_id' => $jobPayClaim->claimant_user_id,
            'payee_swc_uid' => $jobPayClaim->claimant_swc_uid,
            'payee_handle' => $jobPayClaim->claimant_handle,
            'payee_label' => $jobPayClaim->claimant_handle,
            'amount' => (int) $jobPayClaim->base_total,
            'bonus_amount' => (int) $jobPayClaim->bonus_total,
            'total_amount' => (int) $jobPayClaim->total_amount,
            'status' => 'pending',
            'meta' => [
                'job_pay_claim_id' => $jobPayClaim->id,
                'job_pay_rate_id' => $rate->id,
                'job_pay_rate_name' => $rate->name,
                'quantity' => $jobPayClaim->quantity,
                'unit_label' => $rate->unit_label,
            ],
        ]);

        $jobPayClaim->update([
            'status' => 'approved',
            'reviewed_by_user_id' => $user->id,
            'reviewed_at' => now(),
            'review_note' => $validated['review_note'] ?? null,
            'payment_item_id' => $paymentItem->id,
        ]);

        return response()->json([
            'ok' => true,
            'data' => $jobPayClaim->fresh('payRate'),
        ]);
    }

    public function reject(Request $request, JobPayClaim $jobPayClaim): JsonResponse
    {
        $user = $request->user();

        if (!$user || !((bool) $user->is_admin || (bool) $user->is_sysadmin)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($jobPayClaim->status !== 'pending') {
            return response()->json(['message' => 'Only pending claims can be rejected.'], 422);
        }

        $validated = $request->validate([
            'review_note' => ['nullable', 'string', 'max:500'],
        ]);

        $jobPayClaim->update([
            'status' => 'rejected',
            'reviewed_by_user_id' => $user->id,
            'reviewed_at' => now(),
            'review_note' => $validated['review_note'] ?? null,
        ]);

        return response()->json([
            'ok' => true,
            'data' => $jobPayClaim->fresh('payRate'),
        ]);
    }
}
