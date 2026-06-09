<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Scout\Searchable;

class SwcSector extends Model
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
            'uid'        => $this->uid,
            'name'       => $this->name,
            'owner_name' => $this->owner_name,
        ];
    }

    protected $fillable = [
        'uid',
        'name',
        'owner_uid',
        'owner_name',
        'population',
        'known_systems',
        'coordinate_count',
        'system_count',
        'color_r',
        'color_g',
        'color_b',
        'color_hex',
        'outline_coordinates',
        'bounds',
        'last_pulled_at',
    ];

    protected $casts = [
        'outline_coordinates' => 'array',
        'bounds' => 'array',
        'last_pulled_at' => 'datetime',
    ];

    public function systems(): HasMany
    {
        return $this->hasMany(SwcSystem::class, 'sector_id');
    }

    public function asteroidScans(): HasMany
    {
        return $this->hasMany(SwcAsteroidScan::class, 'sector_id');
    }
}
