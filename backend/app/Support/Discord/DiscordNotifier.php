<?php

namespace App\Support\Discord;

use App\Models\Job;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;

class DiscordNotifier
{
    public function postJobCreated(Job $job): bool
    {
        $webhookUrl = trim((string) Config::get('services.jobs_discord.webhook_url', ''));
        if ($webhookUrl === '') {
            return false;
        }

        $baseUrl = rtrim(
            (string) Config::get('services.jobs_discord.frontend_url', Config::get('discord.frontend_url', '')),
            '/'
        );

        $reward = number_format((int) $job->reward_amount) . ' cr';
        if ($job->pay_type === 'per_day_hyper') {
            $reward .= ' / day';
        }

        $modeLabel = match ($job->job_mode) {
            'multi' => 'Multi',
            'open_ended' => 'Open-ended',
            default => 'Single',
        };

        $bonusLine = '';
        if ((int) $job->bonus_amount > 0) {
            $bonusLine = "\nBonus: " . number_format((int) $job->bonus_amount) . ' cr';
            if (is_string($job->bonus_reward) && trim($job->bonus_reward) !== '') {
                $bonusLine .= ' — ' . trim($job->bonus_reward);
            } elseif (is_string($job->bonus_note) && trim($job->bonus_note) !== '') {
                $bonusLine .= ' — ' . trim($job->bonus_note);
            }
        }

        $linkPath = '/members?members_view=jobs&jobs_view=open&job_id=' . $job->id;
        $link = $baseUrl !== '' ? $baseUrl . $linkPath : $linkPath;

        $content = sprintf(
            "**New Job Posted** (#%d)\n**%s**\nReward: %s\nMode: %s | Payer: %s\nPosted by: %s%s\n%s",
            (int) $job->id,
            trim((string) $job->title) !== '' ? trim((string) $job->title) : 'New job',
            $reward,
            $modeLabel,
            $job->payer_label ?: 'Unknown',
            $job->created_by_handle ?: 'Unknown',
            $bonusLine,
            $link
        );

        try {
            $response = Http::timeout(3)->post($webhookUrl, [
                'content' => $content,
            ]);

            return $response->successful();
        } catch (\Throwable) {
            return false;
        }
    }
}
