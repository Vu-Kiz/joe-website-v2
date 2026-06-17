<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TosDocument extends Model
{
    protected $table = 'tos_documents';

    protected $fillable = [
        'version',
        'content',
        'is_active',
        'published_at',
    ];

    protected $casts = [
        'version'      => 'integer',
        'is_active'    => 'boolean',
        'published_at' => 'datetime',
    ];

    public static function activeVersion(): ?int
    {
        return static::where('is_active', true)->value('version');
    }

    public static function active(): ?static
    {
        return static::where('is_active', true)->first();
    }
}
