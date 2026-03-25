<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcStation extends Model
{
    protected $fillable = [
        'uid',
        'identifier',
        'name',
        'type_name',
        'station_type_id',
        'sector_id',
        'system_id',
        'sector_uid',
        'sector_name',
        'system_uid',
        'system_name',
        'galx',
        'galy',
        'sysx',
        'sysy',
        'owner_uid',
        'owner_name',
        'last_pulled_at',
    ];

    protected $casts = [
        'last_pulled_at' => 'datetime',
    ];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(SwcSector::class, 'sector_id');
    }

    public function system(): BelongsTo
    {
        return $this->belongsTo(SwcSystem::class, 'system_id');
    }

    public function stationType(): BelongsTo
    {
        return $this->belongsTo(SwcStationType::class, 'station_type_id');
    }
}
