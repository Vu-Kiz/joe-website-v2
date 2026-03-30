<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE swc_ship_types MODIFY weight_tonnes DECIMAL(18,2) NULL');
        DB::statement('ALTER TABLE swc_ship_types MODIFY volume_m3 DECIMAL(18,2) NULL');
        DB::statement('ALTER TABLE swc_ship_types MODIFY weight_capacity_tonnes DECIMAL(18,2) NULL');
        DB::statement('ALTER TABLE swc_ship_types MODIFY volume_capacity_m3 DECIMAL(18,2) NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE swc_ship_types MODIFY weight_tonnes FLOAT NULL');
        DB::statement('ALTER TABLE swc_ship_types MODIFY volume_m3 FLOAT NULL');
        DB::statement('ALTER TABLE swc_ship_types MODIFY weight_capacity_tonnes FLOAT NULL');
        DB::statement('ALTER TABLE swc_ship_types MODIFY volume_capacity_m3 FLOAT NULL');
    }
};
