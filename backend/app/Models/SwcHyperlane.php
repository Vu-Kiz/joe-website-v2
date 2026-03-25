<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcHyperlane extends Model
{
    protected $fillable = [
        'uid',
        'source_system_id',
        'source_system_uid',
        'name',
        'destination_uid',
        'destination_name',
        'destination_galx',
        'destination_galy',
        'owner_name',
        'blocks',
        'modifier',
        'last_pulled_at',
    ];

    protected $casts = [
        'modifier' => 'float',
        'last_pulled_at' => 'datetime',
    ];

    public function sourceSystem(): BelongsTo
    {
        return $this->belongsTo(SwcSystem::class, 'source_system_id');
    }
}
