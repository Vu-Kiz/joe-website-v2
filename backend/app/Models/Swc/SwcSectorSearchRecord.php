<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcSectorSearchRecord extends Model
{
    protected $fillable = [
        'user_id',
        'sector_id',
        'sector_uid',
        'asteroid_uid',
        'galx',
        'galy',
        'square_name',
        'is_system_searched',
        'has_asteroids',
        'planetoids_checked',
        'planetoid_1_type',
        'planetoid_1_size',
        'planetoid_2_type',
        'planetoid_2_size',
        'has_ships',
        'has_stations',
        'legacy_note',
        'legacy_recorded_at',
        'rescan_due_at',
        'legacy_player',
        'legacy_icon',
        'legacy_handle',
        'legacy_tag',
        'legacy_read',
    ];

    protected $casts = [
        'is_system_searched' => 'boolean',
        'has_asteroids' => 'boolean',
        'planetoids_checked' => 'boolean',
        'has_ships' => 'boolean',
        'has_stations' => 'boolean',
        'legacy_recorded_at' => 'datetime',
        'rescan_due_at' => 'datetime',
        'legacy_read' => 'boolean',
    ];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(SwcSector::class, 'sector_id');
    }
}
