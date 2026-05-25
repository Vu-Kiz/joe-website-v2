<?php

namespace App\Models\ToolStore;
use App\Models\Faction;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolStoreSetting extends Model
{
    protected $table = 'tool_store_settings';

    protected $fillable = ['payee_faction_id', 'payee_swc_handle'];

    protected $casts = ['payee_faction_id' => 'integer'];

    public function payeeFaction(): BelongsTo
    {
        return $this->belongsTo(Faction::class, 'payee_faction_id');
    }

    public static function current(): ?static
    {
        return static::query()->latest('id')->first();
    }
}
