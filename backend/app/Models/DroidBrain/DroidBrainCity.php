<?php

namespace App\Models\DroidBrain;

use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class DroidBrainCity extends Model
{
    use Searchable;

    protected $table = 'droidbrain_cities';
    public $timestamps = false;

    public function getScoutKey(): string
    {
        return str_replace(':', '_', (string) $this->entity_uid);
    }

    public function getScoutKeyName(): string
    {
        return 'entity_uid';
    }

    public function toSearchableArray(): array
    {
        return [
            'entity_uid'  => $this->entity_uid,
            'name'        => $this->name,
            'owner_name'  => $this->owner_name,
            'system_name' => $this->system_name,
            'planet_name' => $this->planet_name,
        ];
    }
}
