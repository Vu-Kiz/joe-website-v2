<?php

namespace App\Console\Commands;

use App\Models\ToolSubscription;
use App\Models\ToolSubscriptionPlan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GrantToolSubscriptionCommand extends Command
{
    protected $signature = 'tool-store:grant
                            {username : The username of the user to grant access to}
                            {--plan=individual : The plan key (individual or faction)}
                            {--months=1 : Number of months to grant}';

    protected $description = 'Manually grant a tool subscription to a user (bypasses payment, for testing)';

    public function handle(): int
    {
        $username = $this->argument('username');
        $planKey  = $this->option('plan');
        $months   = (int) $this->option('months');

        $user = User::where('username', $username)->first();
        if (!$user) {
            $this->error("User '{$username}' not found.");
            return 1;
        }

        $plan = ToolSubscriptionPlan::where('key', $planKey)->first();
        if (!$plan) {
            $this->error("Plan '{$planKey}' not found. Available: " . ToolSubscriptionPlan::pluck('key')->join(', '));
            return 1;
        }

        $now = Carbon::now();

        $existing = ToolSubscription::where('subscriber_type', 'user')
            ->where('subscriber_id', $user->id)
            ->where('status', 'active')
            ->first();

        if ($existing) {
            $existing->update([
                'plan_key'            => $planKey,
                'current_period_end'  => $now->copy()->addMonths($months),
            ]);
            $this->info("Extended existing subscription for {$username} on plan '{$planKey}' until {$existing->current_period_end}.");
        } else {
            $sub = ToolSubscription::create([
                'subscriber_type'      => 'user',
                'subscriber_id'        => $user->id,
                'plan_key'             => $planKey,
                'status'               => 'active',
                'price_paid_credits'   => 0,
                'current_period_start' => $now,
                'current_period_end'   => $now->copy()->addMonths($months),
                'activated_by_user_id' => $user->id,
                'meta'                 => ['granted_manually' => true],
            ]);
            $this->info("Granted '{$planKey}' subscription to {$username} (ID {$sub->id}) until {$sub->current_period_end}.");
        }

        return 0;
    }
}
