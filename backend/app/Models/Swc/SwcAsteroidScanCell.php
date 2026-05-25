<?php

namespace App\Models\Swc;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcAsteroidScanCell extends Model
{
    protected $fillable = [
        'asteroid_scan_id',
        'cell_x',
        'cell_y',
        'tile_code',
        'tile_name',
        'tile_payload',
    ];

    protected $casts = [
        'tile_payload' => 'array',
    ];

    public function scan(): BelongsTo
    {
        return $this->belongsTo(SwcAsteroidScan::class, 'asteroid_scan_id');
    }
}
