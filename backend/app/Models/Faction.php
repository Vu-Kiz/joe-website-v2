<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Faction extends Model
{
    protected $fillable = [
        'name',
        'swc_uid',
        'abbreviation',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot([
                'can_view_payments',
                'can_pay_from_faction',
                'can_mark_payments_paid',
                'can_manage_jobs',
            ])
            ->withTimestamps();
    }
}