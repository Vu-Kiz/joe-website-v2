<?php

namespace App\Models\ToolStore;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolSubscriptionMemberRevocation extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tool_subscription_id',
        'user_id',
        'revoked_at',
    ];

    protected $casts = [
        'revoked_at' => 'datetime',
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
