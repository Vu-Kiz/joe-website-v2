<?php

namespace App\Models\DroidBrain;

use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class DroidBrainPlanet extends Model
{
    use Searchable;

    protected $table = 'droidbrain_planets';
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
            'entity_uid'       => $this->entity_uid,
            'name'             => $this->name,
            'government'       => $this->government,
            'planet_type_name' => $this->planet_type_name,
            'system_name'      => $this->system_name,
            'sector_name'      => $this->sector_name,
        ];
    }
}
