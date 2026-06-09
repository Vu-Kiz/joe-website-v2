<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Scout\Searchable;

class SwcPlanet extends Model
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
            'uid'              => $this->uid,
            'name'             => $this->name,
            'sector_name'      => $this->sector_name,
            'system_name'      => $this->system_name,
            'owner_name'       => $this->owner_name,
            'planet_type_name' => $this->planet_type_name,
            'galx'             => $this->galx,
            'galy'             => $this->galy,
        ];
    }

    protected $fillable = [
        'uid',
        'identifier',
        'name',
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
        'planet_type_uid',
        'planet_type_name',
        'planet_type_href',
        'size',
        'population',
        'previous_population',
        'previous_population_recorded_at',
        'terrain_map',
        'surface_bounds',
        'terrain_grid',
        'cities',
        'image_small_url',
        'image_large_url',
        'image_atmosphere_url',
        'image_stratosphere_url',
        'image_loworbit_url',
        'last_pulled_at',
    ];

    protected $casts = [
        'surface_bounds' => 'array',
        'terrain_grid' => 'array',
        'cities' => 'array',
        'previous_population_recorded_at' => 'datetime',
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
}
