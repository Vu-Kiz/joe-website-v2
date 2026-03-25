<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SwcSectorCellAnnotation extends Model
{
    protected $fillable = [
        'sector_id',
        'sector_uid',
        'galx',
        'galy',
        'marker_type',
        'label',
        'notes',
        'created_by',
        'updated_by',
    ];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(SwcSector::class, 'sector_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
