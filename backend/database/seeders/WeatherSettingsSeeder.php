<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WeatherSettingsSeeder extends Seeder
{
    public function run(): void
    {
        if (!DB::table('weather_settings')->exists()) {
            DB::table('weather_settings')->insert([
                'min_temp' => 34,
                'max_temp' => 57,
            ]);
        }
    }
}