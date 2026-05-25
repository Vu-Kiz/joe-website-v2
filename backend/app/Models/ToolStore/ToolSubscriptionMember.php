<?php

namespace App\Models\ToolStore;
use App\Models\User;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolSubscriptionMember extends Model
{
    protected $fillable = [
        'tool_subscription_id',
        'user_id',
    ];

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(ToolSubscription::class, 'tool_subscription_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
