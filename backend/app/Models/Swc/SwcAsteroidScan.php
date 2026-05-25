<?php

namespace App\Models\Swc;
use App\Models\User;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SwcAsteroidScan extends Model
{
    protected $fillable = [
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
        'source_kind',
        'source_filename',
        'source_event_type',
        'source_event_uid',
        'reported_has_asteroids',
        'scanned_at',
        'uploaded_at',
        'uploaded_by',
        'map_width',
        'map_height',
        'asteroid_map',
        'raw_payload',
        'raw_xml',
        'notes',
        'last_processed_at',
    ];

    protected $casts = [
        'reported_has_asteroids' => 'boolean',
        'scanned_at' => 'datetime',
        'uploaded_at' => 'datetime',
        'asteroid_map' => 'array',
        'raw_payload' => 'array',
        'last_processed_at' => 'datetime',
    ];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(SwcSector::class, 'sector_id');
    }

    public function system(): BelongsTo
    {
        return $this->belongsTo(SwcSystem::class, 'system_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function cells(): HasMany
    {
        return $this->hasMany(SwcAsteroidScanCell::class, 'asteroid_scan_id');
    }
}
