<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Scout\Searchable;

class SwcSystem extends Model
{
    use Searchable;
    public function getScoutKey(): string
    {
        return str_replace(':', '_', (string) $this->uid);
    }

    public function getScoutKeyName(): string
    {
        return 'uid';
    }

    public function toSearchableArray(): array
    {
        return [
            'uid'         => $this->uid,
            'name'        => $this->name,
            'sector_name' => $this->sector_name,
            'owner_name'  => $this->owner_name,
            'galx'        => $this->galx,
            'galy'        => $this->galy,
        ];
    }

    protected $fillable = [
        'uid',
        'identifier',
        'name',
        'sector_id',
        'sector_uid',
        'sector_name',
        'owner_uid',
        'owner_name',
        'galx',
        'galy',
        'sysx',
        'sysy',
        'last_pulled_at',
    ];

    protected $casts = [
        'last_pulled_at' => 'datetime',
    ];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(SwcSector::class, 'sector_id');
    }

    public function planets(): HasMany
    {
        return $this->hasMany(SwcPlanet::class, 'system_id');
    }

    public function stations(): HasMany
    {
        return $this->hasMany(SwcStation::class, 'system_id');
    }

    public function hyperlanes(): HasMany
    {
        return $this->hasMany(SwcHyperlane::class, 'source_system_id');
    }

    public function asteroidScans(): HasMany
    {
        return $this->hasMany(SwcAsteroidScan::class, 'system_id');
    }
}
