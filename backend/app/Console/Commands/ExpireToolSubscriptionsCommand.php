<?php

namespace App\Console\Commands;

use App\Models\ToolSubscription;
use App\Models\ToolSubscriptionMember;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpireToolSubscriptionsCommand extends Command
{
    protected $signature = 'tool-subscriptions:expire';
    protected $description = 'Expire active subscriptions past their period end and remove faction member grants.';

    public function handle(): int
    {
        $now = now();

        $expired = ToolSubscription::query()
            ->where('status', 'active')
            ->where('current_period_end', '<=', $now)
            ->get();

        if ($expired->isEmpty()) {
            return self::SUCCESS;
        }

        foreach ($expired as $sub) {
            DB::transaction(function () use ($sub) {
                ToolSubscriptionMember::where('tool_subscription_id', $sub->id)->delete();
                $sub->update(['status' => 'expired']);
            });
        }

        $this->info("Expired {$expired->count()} subscription(s).");

        return self::SUCCESS;
    }
}
