<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WeatherSetupSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('hot_adjectives')->insert([
            ['word' => 'warm', 'min_temp' => 34, 'max_temp' => 38],
            ['word' => 'hot', 'min_temp' => 39, 'max_temp' => 44],
            ['word' => 'scorching', 'min_temp' => 45, 'max_temp' => 50],
            ['word' => 'blistering', 'min_temp' => 51, 'max_temp' => 57],
        ]);

        DB::table('weather_advice')->insert([
            ['advice' => 'Keep your hood up and avoid the midday dunes.', 'weight' => 2, 'is_active' => 1],
            ['advice' => 'Stay near shade, coolant, or a reliable cantina.', 'weight' => 2, 'is_active' => 1],
            ['advice' => 'Hydration is advised before crossing open sands.', 'weight' => 1, 'is_active' => 1],
            ['advice' => 'Sand exposure remains high; eye protection is recommended.', 'weight' => 1, 'is_active' => 1],
        ]);
    }
}