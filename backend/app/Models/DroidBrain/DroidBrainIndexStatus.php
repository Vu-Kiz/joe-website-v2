<?php

namespace App\Models\DroidBrain;

use Illuminate\Database\Eloquent\Model;

class DroidBrainIndexStatus extends Model
{
    protected $table = 'droidbrain_index_status';
    protected $primaryKey = 'tab';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $casts = [
        'is_dirty'   => 'boolean',
        'dirtied_at' => 'datetime',
        'indexed_at' => 'datetime',
    ];

    public static function markDirty(string $tab): void
    {
        static::where('tab', $tab)->update([
            'is_dirty'   => true,
            'dirtied_at' => now(),
        ]);
    }

    public static function markClean(string $tab): void
    {
        static::where('tab', $tab)->update([
            'is_dirty'   => false,
            'indexed_at' => now(),
        ]);
    }

    public static function allStatuses(): array
    {
        return static::all()->keyBy('tab')->map(fn ($row) => [
            'is_dirty'   => $row->is_dirty,
            'dirtied_at' => $row->dirtied_at?->toISOString(),
            'indexed_at' => $row->indexed_at?->toISOString(),
        ])->all();
    }
}
