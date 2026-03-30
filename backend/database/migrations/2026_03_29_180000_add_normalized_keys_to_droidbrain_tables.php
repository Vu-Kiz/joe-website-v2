<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('droidbrain_npcs') && !Schema::hasColumn('droidbrain_npcs', 'race_id')) {
            Schema::table('droidbrain_npcs', function (Blueprint $table) {
                $table->unsignedBigInteger('race_id')->nullable()->after('race_name');
                $table->index('race_id', 'droidbrain_npcs_race_id_index');
            });
        }

        $this->createOrReplaceNpcsLatestView();
        $this->createOrReplacePlanetsLatestView();
    }

    public function down(): void
    {
        $this->createOrReplaceLegacyNpcsLatestView();
        $this->createOrReplaceLegacyPlanetsLatestView();

        if (Schema::hasTable('droidbrain_npcs') && Schema::hasColumn('droidbrain_npcs', 'race_id')) {
            Schema::table('droidbrain_npcs', function (Blueprint $table) {
                $table->dropIndex('droidbrain_npcs_race_id_index');
                $table->dropColumn('race_id');
            });
        }
    }

    protected function createOrReplaceNpcsLatestView(): void
    {
        DB::statement(<<<'SQL'
CREATE OR REPLACE VIEW `droidbrain_npcs_latest` AS
SELECT
    n.id,
    n.file_id,
    n.snapshot_unixtime,
    n.entity_uid,
    n.entity_id,
    n.name,
    n.infotext,
    n.owner_name,
    n.owner_type,
    n.owner_uid,
    n.commander_name,
    n.commander_type,
    n.commander_uid,
    n.supervisor_name,
    n.supervisor_type,
    n.supervisor_uid,
    n.sector_uid,
    n.sector_name,
    n.system_uid,
    n.system_name,
    n.planet_uid,
    n.planet_name,
    n.city_uid,
    n.city_name,
    n.galx,
    n.galy,
    n.sysx,
    n.sysy,
    n.surfx,
    n.surfy,
    n.groundx,
    n.groundy,
    n.class_name,
    n.race_name,
    n.race_id,
    n.hp,
    n.hp_max,
    n.xp,
    n.xp_level,
    n.container,
    n.container_type_uid,
    n.container_type_name,
    n.container_type,
    n.container_uid,
    n.container_class_name,
    n.container_name,
    n.protected,
    n.tags
FROM droidbrain_npcs n
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_time
    FROM droidbrain_npcs
    GROUP BY entity_uid
) latest ON n.entity_uid = latest.entity_uid AND n.snapshot_unixtime = latest.max_time
SQL);
    }

    protected function createOrReplaceLegacyNpcsLatestView(): void
    {
        DB::statement(<<<'SQL'
CREATE OR REPLACE VIEW `droidbrain_npcs_latest` AS
SELECT
    n.id,
    n.file_id,
    n.snapshot_unixtime,
    n.entity_uid,
    n.entity_id,
    n.name,
    n.infotext,
    n.owner_name,
    n.owner_type,
    n.owner_uid,
    n.commander_name,
    n.commander_type,
    n.commander_uid,
    n.supervisor_name,
    n.supervisor_type,
    n.supervisor_uid,
    n.sector_uid,
    n.sector_name,
    n.system_uid,
    n.system_name,
    n.planet_uid,
    n.planet_name,
    n.city_uid,
    n.city_name,
    n.galx,
    n.galy,
    n.sysx,
    n.sysy,
    n.surfx,
    n.surfy,
    n.groundx,
    n.groundy,
    n.class_name,
    n.race_name,
    n.hp,
    n.hp_max,
    n.xp,
    n.xp_level,
    n.container,
    n.container_type_uid,
    n.container_type_name,
    n.container_type,
    n.container_uid,
    n.container_class_name,
    n.container_name,
    n.protected,
    n.tags
FROM droidbrain_npcs n
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_time
    FROM droidbrain_npcs
    GROUP BY entity_uid
) latest ON n.entity_uid = latest.entity_uid AND n.snapshot_unixtime = latest.max_time
SQL);
    }

    protected function createOrReplacePlanetsLatestView(): void
    {
        DB::statement(<<<'SQL'
CREATE OR REPLACE VIEW `droidbrain_planets_latest` AS
SELECT
    p.id,
    p.file_id,
    p.snapshot_unixtime,
    p.entity_uid,
    p.entity_id,
    p.name,
    p.sector_uid,
    p.sector_name,
    p.system_uid,
    p.system_name,
    p.type_id,
    p.planet_type_name,
    p.size,
    p.tax_level,
    p.morale,
    p.crime,
    p.er,
    p.civ_level,
    p.government,
    p.population,
    p.hirable_pop,
    p.galx,
    p.galy,
    p.sysx,
    p.sysy,
    p.tags
FROM droidbrain_planets p
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_time
    FROM droidbrain_planets
    GROUP BY entity_uid
) latest ON p.entity_uid = latest.entity_uid AND p.snapshot_unixtime = latest.max_time
SQL);
    }

    protected function createOrReplaceLegacyPlanetsLatestView(): void
    {
        DB::statement(<<<'SQL'
CREATE OR REPLACE VIEW `droidbrain_planets_latest` AS
SELECT
    p.id,
    p.file_id,
    p.snapshot_unixtime,
    p.entity_uid,
    p.entity_id,
    p.name,
    p.sector_uid,
    p.sector_name,
    p.system_uid,
    p.system_name,
    p.planet_type_name,
    p.size,
    p.tax_level,
    p.morale,
    p.crime,
    p.er,
    p.civ_level,
    p.government,
    p.population,
    p.hirable_pop,
    p.galx,
    p.galy,
    p.sysx,
    p.sysy,
    p.tags
FROM droidbrain_planets p
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_time
    FROM droidbrain_planets
    GROUP BY entity_uid
) latest ON p.entity_uid = latest.entity_uid AND p.snapshot_unixtime = latest.max_time
SQL);
    }
};
