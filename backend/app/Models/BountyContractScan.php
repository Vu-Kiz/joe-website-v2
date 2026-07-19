<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BountyContractScan extends Model
{
    protected $fillable = [
        'bounty_contract_id',
        'scan_galx',
        'scan_galy',
        'bearing_degrees',
        'range_band',
    ];

    protected $casts = [
        'bounty_contract_id' => 'integer',
        'scan_galx' => 'integer',
        'scan_galy' => 'integer',
        'bearing_degrees' => 'float',
    ];

    public function bountyContract(): BelongsTo
    {
        return $this->belongsTo(BountyContract::class);
    }
}
