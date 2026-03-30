<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HyperPlan extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'from_system_identifier',
        'from_system_name',
        'to_system_identifier',
        'to_system_name',
        'ship_uid',
        'ship_name',
        'ship_class_name',
        'hyperspeed',
        'piloting_skill',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'hyperspeed' => 'integer',
        'piloting_skill' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
