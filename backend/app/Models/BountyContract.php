<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BountyContract extends Model
{
    protected $fillable = [
        'user_id',
        'target_name',
        'difficulty',
        'contract_type',
        'status',
        'deadline_at',
        'notes',
        'accepted_galx',
        'accepted_galy',
        'estimated_galx',
        'estimated_galy',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'difficulty' => 'integer',
        'deadline_at' => 'datetime',
        'accepted_galx' => 'integer',
        'accepted_galy' => 'integer',
        'estimated_galx' => 'integer',
        'estimated_galy' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scans(): HasMany
    {
        return $this->hasMany(BountyContractScan::class)->orderBy('created_at');
    }
}
