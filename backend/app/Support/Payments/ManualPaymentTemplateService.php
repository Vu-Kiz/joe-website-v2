<?php

namespace App\Support\Payments;

use App\Models\ManualPaymentTemplate;
use App\Models\PaymentItem;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ManualPaymentTemplateService
{
    public function generatePaymentsForDueTemplates(?Carbon $now = null): Collection
    {
        $now = ($now ?? now())->copy();
        $today = $now->toDateString();
        $currentPeriod = $now->format('Y-m');

        $templates = ManualPaymentTemplate::query()
            ->where('status', 'active')
            ->whereDate('start_date', '<=', $today)
            ->where(function ($q) use ($today) {
                $q->whereNull('end_date')
                  ->orWhereDate('end_date', '>=', $today);
            })
            ->get();

        $created = collect();

        foreach ($templates as $template) {
            if (!$this->isDueThisMonth($template, $now)) {
                continue;
            }

            if (($template->last_generated_period ?? null) === $currentPeriod) {
                continue;
            }

            $payment = $this->createPaymentFromTemplate($template, $now, $currentPeriod);

            if ($payment) {
                $created->push($payment);
            }
        }

        return $created;
    }

    protected function isDueThisMonth(ManualPaymentTemplate $template, Carbon $now): bool
    {
        if (($template->frequency ?? 'monthly') !== 'monthly') {
            return false;
        }

        $day = max(1, min(31, (int) ($template->day_of_month ?? 1)));
        $dueDay = min($day, $now->copy()->endOfMonth()->day);

        return $now->day >= $dueDay;
    }

    protected function createPaymentFromTemplate(
        ManualPaymentTemplate $template,
        Carbon $now,
        string $period
    ): ?PaymentItem {
        $existing = PaymentItem::query()
            ->where('source_type', 'manual_template')
            ->where('source_id', $template->id)
            ->where('status', 'pending')
            ->where('meta->period', $period)
            ->first();

        if ($existing) {
            $template->forceFill([
                'last_generated_period' => $period,
            ])->save();

            return $existing;
        }

        $amount = (int) ($template->total_amount ?: (($template->amount ?? 0) + ($template->bonus_amount ?? 0)));

        if ($amount <= 0) {
            return null;
        }

        $communication = trim((string) ($template->communication_prefix ?? $template->name ?? 'Manual payment'));

        $payment = PaymentItem::create([
            'payer_subject_type' => $template->payer_subject_type,
            'payer_subject_id'   => $template->payer_subject_id,
            'payer_label'        => $template->payer_label,

            'payee_subject_type' => $template->payee_subject_type ?: 'user',
            'payee_subject_id'   => $template->payee_subject_id,
            'payee_swc_uid'      => $template->payee_swc_uid,
            'payee_handle'       => $template->payee_handle,
            'payee_label'        => $template->payee_label,

            'amount'             => $amount,
            'reason'             => $template->name,
            'communication'      => $communication,
            'status'             => 'pending',
            'due_at'             => $now,
            'source_type'        => 'manual_template',
            'source_id'          => $template->id,
            'meta'               => [
                'period' => $period,
                'template_name' => $template->name,
                'base_amount' => (int) ($template->amount ?? 0),
                'bonus_amount' => (int) ($template->bonus_amount ?? 0),
                'notes' => $template->notes,
            ],
        ]);

        $template->forceFill([
            'last_generated_period' => $period,
        ])->save();

        return $payment;
    }
}