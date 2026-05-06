<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class DroidBrainVehicle extends Model
{
    use Searchable;

    protected $table = 'droidbrain_vehicles';
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
            'type_name'   => $this->type_name,
            'class_name'  => $this->class_name,
            'system_name' => $this->system_name,
            'planet_name' => $this->planet_name,
        ];
    }
}
