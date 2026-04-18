<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WreckingHelperSetting extends Model
{
    use HasFactory;

    protected $table = 'wrecking_helper_settings';

    protected $fillable = [
        'user_id',
        'prefix',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
