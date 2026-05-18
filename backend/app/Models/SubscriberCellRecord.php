<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriberCellRecord extends Model
{
    protected $fillable = [
        'owner_type',
        'owner_id',
        'sector_uid',
        'galx',
        'galy',
        'square_name',
        'is_system_searched',
        'has_asteroids',
        'planetoids_checked',
        'planetoid_1_size',
        'planetoid_2_size',
        'has_ships',
        'has_stations',
        'updated_by_user_id',
    ];

    protected $casts = [
        'is_system_searched' => 'boolean',
        'has_asteroids'      => 'boolean',
        'planetoids_checked' => 'boolean',
        'has_ships'          => 'boolean',
        'has_stations'       => 'boolean',
    ];

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }
}
