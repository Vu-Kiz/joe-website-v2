<?php

namespace App\Support\Payments;

use App\Models\Payment\ManualPaymentTemplate;
use App\Models\Payment\PaymentItem;
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

            $payment = $this->generatePaymentForTemplate($template, $now);

            if ($payment) {
                $created->push($payment);
            }
        }

        return $created;
    }

    public function generatePaymentForTemplate(
        ManualPaymentTemplate $template,
        ?Carbon $now = null,
        bool $force = false
    ): ?PaymentItem {
        $now = ($now ?? now())->copy();
        $today = $now->toDateString();
        $currentPeriod = $now->format('Y-m');

        if (($template->status ?? 'active') !== 'active') {
            return null;
        }

        if ($template->start_date && $template->start_date->toDateString() > $today) {
            return null;
        }

        if ($template->end_date && $template->end_date->toDateString() < $today) {
            return null;
        }

        if (!$force && !$this->isDueThisMonth($template, $now)) {
            return null;
        }

        if (($template->last_generated_period ?? null) === $currentPeriod) {
            $existing = PaymentItem::query()
                ->where('source_type', 'manual_template')
                ->where('source_id', $template->id)
                ->where('status', 'pending')
                ->where('meta->period', $currentPeriod)
                ->first();

            if ($existing) {
                return $existing;
            }
        }

        return $this->createPaymentFromTemplate($template, $now, $currentPeriod);
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
            ->first();

        if ($existing) {
            if ($existing->status === 'pending' && (string) data_get($existing->meta, 'period', '') === $period) {
                $template->forceFill([
                    'last_generated_period' => $period,
                ])->save();

                return $existing;
            }

            $baseAmount = (int) ($template->amount ?? 0);
            $bonusAmount = (int) ($template->bonus_amount ?? 0);
            $totalAmount = (int) ($template->total_amount ?: ($baseAmount + $bonusAmount));

            if ($totalAmount <= 0) {
                return null;
            }

            $communication = trim((string) ($template->communication_prefix ?? $template->name ?? 'Manual payment'));

            $existing->forceFill([
                'tool_key' => 'manual_payments',
                'payer_subject_type' => $template->payer_subject_type,
                'payer_subject_id' => $template->payer_subject_id,
                'payer_label' => $template->payer_label,
                'payee_subject_type' => $template->payee_subject_type ?: 'user',
                'payee_subject_id' => $template->payee_subject_id,
                'payee_swc_uid' => $template->payee_swc_uid,
                'payee_handle' => $template->payee_handle,
                'payee_label' => $template->payee_label,
                'amount' => $baseAmount,
                'bonus_amount' => $bonusAmount,
                'total_amount' => $totalAmount,
                'status' => 'pending',
                'paid_at' => null,
                'meta' => [
                    'period' => $period,
                    'template_name' => $template->name,
                    'base_amount' => $baseAmount,
                    'bonus_amount' => $bonusAmount,
                    'communication_prefix' => $communication !== '' ? $communication : null,
                    'notes' => $template->notes,
                    'generated_at' => $now->toIso8601String(),
                ],
            ])->save();

            $template->forceFill([
                'last_generated_period' => $period,
            ])->save();

            return $existing->fresh();
        }

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

        $baseAmount = (int) ($template->amount ?? 0);
        $bonusAmount = (int) ($template->bonus_amount ?? 0);
        $totalAmount = (int) ($template->total_amount ?: ($baseAmount + $bonusAmount));

        if ($totalAmount <= 0) {
            return null;
        }

        $communication = trim((string) ($template->communication_prefix ?? $template->name ?? 'Manual payment'));

        $payment = PaymentItem::create([
            'tool_key'           => 'manual_payments',
            'payer_subject_type' => $template->payer_subject_type,
            'payer_subject_id'   => $template->payer_subject_id,
            'payer_label'        => $template->payer_label,

            'payee_subject_type' => $template->payee_subject_type ?: 'user',
            'payee_subject_id'   => $template->payee_subject_id,
            'payee_swc_uid'      => $template->payee_swc_uid,
            'payee_handle'       => $template->payee_handle,
            'payee_label'        => $template->payee_label,

            'amount'             => $baseAmount,
            'bonus_amount'       => $bonusAmount,
            'total_amount'       => $totalAmount,
            'status'             => 'pending',
            'source_type'        => 'manual_template',
            'source_id'          => $template->id,
            'meta'               => [
                'period' => $period,
                'template_name' => $template->name,
                'base_amount' => $baseAmount,
                'bonus_amount' => $bonusAmount,
                'communication_prefix' => $communication !== '' ? $communication : null,
                'notes' => $template->notes,
                'generated_at' => $now->toIso8601String(),
            ],
        ]);

        $template->forceFill([
            'last_generated_period' => $period,
        ])->save();

        return $payment;
    }
}
