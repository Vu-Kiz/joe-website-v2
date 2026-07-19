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
        'valid_terrain_cell_count',
        'terrain_cell_count',
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
        'valid_terrain_cell_count' => 'integer',
        'terrain_cell_count' => 'integer',
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

    // Terrain codes nothing should ever be considered to "occupy" — Ocean, River, Volcanic.
    public const EXCLUDED_TERRAIN_CODES = ['g', 'h', 'm'];

    /**
     * Counts cells in a terrain grid that are not excluded terrain and not inside a city.
     * Pure function over raw decoded arrays so it can be reused by sync and backfill code
     * without needing a hydrated model.
     *
     * @param array $terrainGrid Decoded `terrain_grid` array: [{x,y,code,...}, ...]
     * @param array $cities Decoded `cities` array: [{x,y,...}, ...]
     * @return array{valid: int, total: int}
     */
    public static function computeTerrainCellCounts(array $terrainGrid, array $cities): array
    {
        if ($terrainGrid === []) {
            return ['valid' => 0, 'total' => 0];
        }

        $cityCells = [];
        foreach ($cities as $city) {
            if (isset($city['x'], $city['y'])) {
                $cityCells[$city['x'] . ':' . $city['y']] = true;
            }
        }

        $valid = 0;
        foreach ($terrainGrid as $cell) {
            $code = $cell['code'] ?? null;
            $key = ($cell['x'] ?? null) . ':' . ($cell['y'] ?? null);
            if (in_array($code, self::EXCLUDED_TERRAIN_CODES, true) || isset($cityCells[$key])) {
                continue;
            }
            $valid++;
        }

        return ['valid' => $valid, 'total' => count($terrainGrid)];
    }
}
