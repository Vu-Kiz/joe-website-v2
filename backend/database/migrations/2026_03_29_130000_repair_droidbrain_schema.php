<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected array $latestNames = [
        'droidbrain_cities_latest',
        'droidbrain_npcs_latest',
        'droidbrain_planets_latest',
        'droidbrain_ships_latest',
        'droidbrain_stations_latest',
        'droidbrain_vehicles_latest',
    ];

    public function up(): void
    {
        $this->renameIncorrectLatestTablesToBackups();

        $this->createKnownSystemsTable();
        $this->createSystemScanTables();
        $this->createUploadDebugTables();

        $this->createCitiesTable();
        $this->createNpcsTable();
        $this->createPlanetsTable();
        $this->createShipsTable();
        $this->createStationsTable();
        $this->createVehiclesTable();

        $this->createLatestViews();
    }

    public function down(): void
    {
        foreach ($this->latestNames as $viewName) {
            if ($this->relationType($viewName) === 'VIEW') {
                DB::statement("DROP VIEW IF EXISTS `{$viewName}`");
            }
        }

        Schema::dropIfExists('droidbrain_vehicles');
        Schema::dropIfExists('droidbrain_stations');
        Schema::dropIfExists('droidbrain_ships');
        Schema::dropIfExists('droidbrain_planets');
        Schema::dropIfExists('droidbrain_npcs');
        Schema::dropIfExists('droidbrain_cities');
        Schema::dropIfExists('droidbrain_upload_debug_events');
        Schema::dropIfExists('droidbrain_upload_debug_requests');
        Schema::dropIfExists('droidbrain_system_scan_objects');
        Schema::dropIfExists('droidbrain_system_scans');
        Schema::dropIfExists('droidbrain_known_systems');

        foreach ($this->latestNames as $name) {
            $backupName = $this->backupName($name);
            if ($this->relationType($backupName) === 'BASE TABLE' && $this->relationType($name) === null) {
                Schema::rename($backupName, $name);
            }
        }
    }

    protected function renameIncorrectLatestTablesToBackups(): void
    {
        foreach ($this->latestNames as $name) {
            if ($this->relationType($name) !== 'BASE TABLE') {
                continue;
            }

            $backupName = $this->backupName($name);

            if ($this->relationType($backupName) === null) {
                Schema::rename($name, $backupName);
            }
        }
    }

    protected function createKnownSystemsTable(): void
    {
        if (Schema::hasTable('droidbrain_known_systems')) {
            return;
        }

        Schema::create('droidbrain_known_systems', function (Blueprint $table) {
            $table->id();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_name', 255);
            $table->integer('galx');
            $table->integer('galy');
            $table->foreignId('first_seen_file_id')->constrained('droidbrain_files');
            $table->timestamp('first_seen_at')->useCurrent();

            $table->unique(['galx', 'galy'], 'droidbrain_known_systems_coords_unique');
            $table->index('system_name', 'droidbrain_known_systems_name_index');
        });
    }

    protected function createSystemScanTables(): void
    {
        if (!Schema::hasTable('droidbrain_system_scans')) {
            Schema::create('droidbrain_system_scans', function (Blueprint $table) {
                $table->id();
                $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
                $table->integer('snapshot_unixtime')->index();
                $table->integer('galx');
                $table->integer('galy');
                $table->string('system_uid', 32)->nullable();
                $table->string('system_name', 255)->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index(['galx', 'galy'], 'droidbrain_system_scans_gal_index');
            });
        }

        if (!Schema::hasTable('droidbrain_system_scan_objects')) {
            Schema::create('droidbrain_system_scan_objects', function (Blueprint $table) {
                $table->id();
                $table->foreignId('scan_id')->constrained('droidbrain_system_scans')->cascadeOnDelete();
                $table->string('object_type', 50);
                $table->string('object_uid', 32)->nullable();
                $table->string('object_name', 255)->nullable();
                $table->integer('galx')->nullable();
                $table->integer('galy')->nullable();
                $table->integer('sysx')->nullable();
                $table->integer('sysy')->nullable();
                $table->longText('raw_json')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->index('object_type', 'droidbrain_system_scan_objects_type_index');
                $table->index('object_uid', 'droidbrain_system_scan_objects_uid_index');
            });
        }
    }

    protected function createUploadDebugTables(): void
    {
        if (!Schema::hasTable('droidbrain_upload_debug_requests')) {
            Schema::create('droidbrain_upload_debug_requests', function (Blueprint $table) {
                $table->id();
                $table->char('request_id', 32)->unique();
                $table->foreignId('uploader_id')->nullable()->constrained('droidbrain_uploaders')->nullOnDelete();
                $table->string('swc_uid', 32)->nullable();
                $table->boolean('is_guest')->default(false);
                $table->string('ip', 64)->nullable();
                $table->string('user_agent', 255)->nullable();
                $table->unsignedSmallInteger('http_code')->nullable();
                $table->unsignedInteger('success_count')->default(0);
                $table->unsignedInteger('error_count')->default(0);
                $table->timestamp('created_at')->useCurrent();

                $table->index('created_at', 'droidbrain_upload_debug_requests_created_at_index');
            });
        }

        if (!Schema::hasTable('droidbrain_upload_debug_events')) {
            Schema::create('droidbrain_upload_debug_events', function (Blueprint $table) {
                $table->id();
                $table->char('request_id', 32);
                $table->unsignedInteger('file_index')->nullable();
                $table->string('file_name', 255)->nullable();
                $table->enum('level', ['info', 'warn', 'error'])->default('info');
                $table->string('event_name', 64);
                $table->longText('context_json');
                $table->timestamp('created_at')->useCurrent();

                $table->index('request_id', 'droidbrain_upload_debug_events_request_id_index');
                $table->index(['request_id', 'file_index'], 'droidbrain_upload_debug_events_request_file_index');
                $table->index('created_at', 'droidbrain_upload_debug_events_created_at_index');
            });

            DB::statement(
                'ALTER TABLE `droidbrain_upload_debug_events` ADD CONSTRAINT `droidbrain_upload_debug_events_request_fk` FOREIGN KEY (`request_id`) REFERENCES `droidbrain_upload_debug_requests` (`request_id`) ON DELETE CASCADE'
            );
        }
    }

    protected function createCitiesTable(): void
    {
        if (Schema::hasTable('droidbrain_cities')) {
            return;
        }

        Schema::create('droidbrain_cities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
            $table->unsignedBigInteger('snapshot_unixtime')->index();
            $table->string('entity_uid', 32)->index();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('name', 255)->nullable()->index();
            $table->text('infotext')->nullable();
            $table->string('owner_name', 255)->nullable()->index();
            $table->integer('owner_type')->nullable();
            $table->string('owner_uid', 32)->nullable();
            $table->string('commander_name', 255)->nullable();
            $table->integer('commander_type')->nullable();
            $table->string('commander_uid', 32)->nullable();
            $table->string('sector_uid', 32)->nullable();
            $table->string('sector_name', 255)->nullable()->index();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_name', 255)->nullable()->index();
            $table->string('planet_uid', 32)->nullable();
            $table->string('planet_name', 255)->nullable()->index();
            $table->integer('galx')->nullable();
            $table->integer('galy')->nullable();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->integer('surfx')->nullable();
            $table->integer('surfy')->nullable();
            $table->boolean('visible')->nullable();
            $table->decimal('morale', 10, 4)->nullable();
            $table->decimal('crime', 10, 4)->nullable();
            $table->integer('container')->nullable();
            $table->string('container_type_uid', 32)->nullable();
            $table->string('container_type_name', 255)->nullable();
            $table->integer('container_type')->nullable();
            $table->string('container_uid', 32)->nullable();
            $table->string('container_class_name', 255)->nullable();
            $table->string('container_name', 255)->nullable();
            $table->boolean('protected')->nullable();
            $table->text('tags')->nullable();

            $table->index(['entity_uid', 'snapshot_unixtime'], 'droidbrain_cities_uid_time_index');
            $table->index(['planet_name', 'surfx', 'surfy'], 'droidbrain_cities_planet_coords_index');
        });
    }

    protected function createNpcsTable(): void
    {
        if (Schema::hasTable('droidbrain_npcs')) {
            return;
        }

        Schema::create('droidbrain_npcs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
            $table->unsignedBigInteger('snapshot_unixtime')->index();
            $table->string('entity_uid', 32)->index();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('name', 255)->nullable()->index();
            $table->text('infotext')->nullable();
            $table->string('owner_name', 255)->nullable()->index();
            $table->integer('owner_type')->nullable();
            $table->string('owner_uid', 32)->nullable();
            $table->string('commander_name', 255)->nullable();
            $table->integer('commander_type')->nullable();
            $table->string('commander_uid', 32)->nullable();
            $table->string('supervisor_name', 255)->nullable();
            $table->integer('supervisor_type')->nullable();
            $table->string('supervisor_uid', 32)->nullable();
            $table->string('sector_uid', 32)->nullable();
            $table->string('sector_name', 255)->nullable()->index();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_name', 255)->nullable()->index();
            $table->string('planet_uid', 32)->nullable();
            $table->string('planet_name', 255)->nullable()->index();
            $table->string('city_uid', 32)->nullable();
            $table->string('city_name', 255)->nullable();
            $table->integer('galx')->nullable();
            $table->integer('galy')->nullable();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->integer('surfx')->nullable();
            $table->integer('surfy')->nullable();
            $table->integer('groundx')->nullable();
            $table->integer('groundy')->nullable();
            $table->string('class_name', 255)->nullable()->index();
            $table->string('race_name', 255)->nullable()->index();
            $table->integer('hp')->nullable();
            $table->integer('hp_max')->nullable();
            $table->integer('xp')->nullable();
            $table->integer('xp_level')->nullable();
            $table->integer('container')->nullable();
            $table->string('container_type_uid', 32)->nullable();
            $table->string('container_type_name', 255)->nullable();
            $table->integer('container_type')->nullable();
            $table->string('container_uid', 32)->nullable();
            $table->string('container_class_name', 255)->nullable();
            $table->string('container_name', 255)->nullable();
            $table->boolean('protected')->nullable();
            $table->text('tags')->nullable();

            $table->index(['entity_uid', 'snapshot_unixtime'], 'droidbrain_npcs_uid_time_index');
        });
    }

    protected function createPlanetsTable(): void
    {
        if (Schema::hasTable('droidbrain_planets')) {
            return;
        }

        Schema::create('droidbrain_planets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
            $table->unsignedBigInteger('snapshot_unixtime')->index();
            $table->string('entity_uid', 32)->index();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('name', 255)->nullable()->index();
            $table->text('infotext')->nullable();
            $table->string('owner_name', 255)->nullable();
            $table->integer('owner_type')->nullable();
            $table->string('owner_uid', 32)->nullable();
            $table->string('commander_name', 255)->nullable();
            $table->integer('commander_type')->nullable();
            $table->string('commander_uid', 32)->nullable();
            $table->string('sector_uid', 32)->nullable();
            $table->string('sector_name', 255)->nullable()->index();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_name', 255)->nullable()->index();
            $table->string('type_name', 255)->nullable()->index();
            $table->integer('type_id')->nullable();
            $table->string('planet_type_name', 255)->nullable();
            $table->integer('size')->nullable();
            $table->decimal('tax_level', 10, 4)->nullable();
            $table->decimal('morale', 10, 4)->nullable();
            $table->decimal('crime', 10, 4)->nullable();
            $table->decimal('er', 10, 4)->nullable();
            $table->decimal('civ_level', 10, 4)->nullable();
            $table->string('government', 255)->nullable()->index();
            $table->unsignedBigInteger('population')->nullable();
            $table->unsignedBigInteger('hirable_population')->nullable();
            $table->unsignedBigInteger('hirable_pop')->nullable();
            $table->integer('galx')->nullable();
            $table->integer('galy')->nullable();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->text('tags')->nullable();

            $table->index(['entity_uid', 'snapshot_unixtime'], 'droidbrain_planets_uid_time_index');
        });
    }

    protected function createShipsTable(): void
    {
        if (Schema::hasTable('droidbrain_ships')) {
            return;
        }

        Schema::create('droidbrain_ships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
            $table->unsignedBigInteger('snapshot_unixtime')->index();
            $table->string('entity_uid', 32)->index();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('name', 255)->nullable()->index();
            $table->text('infotext')->nullable();
            $table->string('owner_name', 255)->nullable()->index();
            $table->integer('owner_type')->nullable();
            $table->string('owner_uid', 32)->nullable();
            $table->string('commander_name', 255)->nullable();
            $table->integer('commander_type')->nullable();
            $table->string('commander_uid', 32)->nullable();
            $table->string('pilot_name', 255)->nullable();
            $table->string('pilot_uid', 32)->nullable();
            $table->string('sector_uid', 32)->nullable();
            $table->string('sector_name', 255)->nullable()->index();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_name', 255)->nullable()->index();
            $table->string('planet_uid', 32)->nullable();
            $table->string('planet_name', 255)->nullable()->index();
            $table->string('city_uid', 32)->nullable();
            $table->string('city_name', 255)->nullable();
            $table->integer('galx')->nullable();
            $table->integer('galy')->nullable();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->integer('surfx')->nullable();
            $table->integer('surfy')->nullable();
            $table->integer('groundx')->nullable();
            $table->integer('groundy')->nullable();
            $table->string('class_name', 255)->nullable()->index();
            $table->integer('class_id')->nullable();
            $table->string('type_name', 255)->nullable()->index();
            $table->integer('type_id')->nullable();
            $table->integer('hull')->nullable();
            $table->integer('hull_max')->nullable();
            $table->integer('shield')->nullable();
            $table->integer('shield_max')->nullable();
            $table->integer('ionic')->nullable();
            $table->integer('ionic_max')->nullable();
            $table->integer('passengers_remaining')->nullable();
            $table->integer('passengers_total')->nullable();
            $table->decimal('volume_capacity_remaining', 20, 4)->nullable();
            $table->decimal('volume_capacity_total', 20, 4)->nullable();
            $table->decimal('weight_capacity_remaining', 20, 4)->nullable();
            $table->decimal('weight_capacity_total', 20, 4)->nullable();
            $table->integer('container')->nullable();
            $table->string('container_type_uid', 32)->nullable();
            $table->string('container_type_name', 255)->nullable();
            $table->integer('container_type')->nullable();
            $table->string('container_uid', 32)->nullable();
            $table->string('container_class_name', 255)->nullable();
            $table->string('container_name', 255)->nullable();
            $table->string('public_status', 255)->nullable();
            $table->boolean('protected')->nullable();
            $table->text('tags')->nullable();

            $table->index(['entity_uid', 'snapshot_unixtime'], 'droidbrain_ships_uid_time_index');
            $table->index(['type_name', 'class_name'], 'droidbrain_ships_type_class_index');
        });
    }

    protected function createStationsTable(): void
    {
        if (Schema::hasTable('droidbrain_stations')) {
            return;
        }

        Schema::create('droidbrain_stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
            $table->unsignedBigInteger('snapshot_unixtime')->index();
            $table->string('entity_uid', 32)->index();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('name', 255)->nullable()->index();
            $table->text('infotext')->nullable();
            $table->string('owner_name', 255)->nullable()->index();
            $table->integer('owner_type')->nullable();
            $table->string('owner_uid', 32)->nullable();
            $table->string('commander_name', 255)->nullable();
            $table->integer('commander_type')->nullable();
            $table->string('commander_uid', 32)->nullable();
            $table->string('sector_uid', 32)->nullable();
            $table->string('sector_name', 255)->nullable()->index();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_name', 255)->nullable()->index();
            $table->string('planet_uid', 32)->nullable();
            $table->string('planet_name', 255)->nullable()->index();
            $table->string('city_uid', 32)->nullable();
            $table->string('city_name', 255)->nullable();
            $table->integer('galx')->nullable();
            $table->integer('galy')->nullable();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->integer('surfx')->nullable();
            $table->integer('surfy')->nullable();
            $table->string('class_name', 255)->nullable()->index();
            $table->integer('class_id')->nullable();
            $table->string('type_name', 255)->nullable()->index();
            $table->integer('type_id')->nullable();
            $table->integer('hull')->nullable();
            $table->integer('hull_max')->nullable();
            $table->integer('shield')->nullable();
            $table->integer('shield_max')->nullable();
            $table->integer('ionic')->nullable();
            $table->integer('ionic_max')->nullable();
            $table->integer('passengers_remaining')->nullable();
            $table->integer('passengers_total')->nullable();
            $table->decimal('volume_capacity_remaining', 20, 4)->nullable();
            $table->decimal('volume_capacity_total', 20, 4)->nullable();
            $table->decimal('weight_capacity_remaining', 20, 4)->nullable();
            $table->decimal('weight_capacity_total', 20, 4)->nullable();
            $table->integer('container')->nullable();
            $table->string('container_type_uid', 32)->nullable();
            $table->string('container_type_name', 255)->nullable();
            $table->integer('container_type')->nullable();
            $table->string('container_uid', 32)->nullable();
            $table->string('container_class_name', 255)->nullable();
            $table->string('container_name', 255)->nullable();
            $table->string('public_status', 255)->nullable();
            $table->boolean('protected')->nullable();
            $table->text('tags')->nullable();
            $table->string('construction_status', 255)->nullable();
            $table->string('construction_delay_remaining', 64)->nullable();
            $table->string('construction_delay_total', 64)->nullable();
            $table->integer('construction_builders_working')->nullable();
            $table->string('production_status', 255)->nullable();
            $table->string('production_delay_remaining', 64)->nullable();
            $table->string('production_delay_total', 64)->nullable();
            $table->integer('production_workers_working')->nullable();
            $table->integer('production_quantity')->nullable();
            $table->integer('production_delay1')->nullable();
            $table->integer('production_delay2')->nullable();
            $table->string('tooled_to', 255)->nullable();

            $table->index(['entity_uid', 'snapshot_unixtime'], 'droidbrain_stations_uid_time_index');
        });
    }

    protected function createVehiclesTable(): void
    {
        if (Schema::hasTable('droidbrain_vehicles')) {
            return;
        }

        Schema::create('droidbrain_vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('file_id')->constrained('droidbrain_files')->cascadeOnDelete();
            $table->unsignedBigInteger('snapshot_unixtime')->index();
            $table->string('entity_uid', 32)->index();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('name', 255)->nullable()->index();
            $table->text('infotext')->nullable();
            $table->string('owner_name', 255)->nullable()->index();
            $table->integer('owner_type')->nullable();
            $table->string('owner_uid', 32)->nullable();
            $table->string('commander_name', 255)->nullable();
            $table->integer('commander_type')->nullable();
            $table->string('commander_uid', 32)->nullable();
            $table->string('pilot_name', 255)->nullable();
            $table->string('pilot_uid', 32)->nullable();
            $table->string('sector_uid', 32)->nullable();
            $table->string('sector_name', 255)->nullable()->index();
            $table->string('system_uid', 32)->nullable();
            $table->string('system_name', 255)->nullable()->index();
            $table->string('planet_uid', 32)->nullable();
            $table->string('planet_name', 255)->nullable()->index();
            $table->string('city_uid', 32)->nullable();
            $table->string('city_name', 255)->nullable();
            $table->integer('galx')->nullable();
            $table->integer('galy')->nullable();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->integer('surfx')->nullable();
            $table->integer('surfy')->nullable();
            $table->integer('groundx')->nullable();
            $table->integer('groundy')->nullable();
            $table->string('class_name', 255)->nullable()->index();
            $table->integer('class_id')->nullable();
            $table->string('type_name', 255)->nullable()->index();
            $table->integer('type_id')->nullable();
            $table->integer('hull')->nullable();
            $table->integer('hull_max')->nullable();
            $table->integer('shield')->nullable();
            $table->integer('shield_max')->nullable();
            $table->integer('ionic')->nullable();
            $table->integer('ionic_max')->nullable();
            $table->integer('passengers_remaining')->nullable();
            $table->integer('passengers_total')->nullable();
            $table->decimal('volume_capacity_remaining', 20, 4)->nullable();
            $table->decimal('volume_capacity_total', 20, 4)->nullable();
            $table->integer('container')->nullable();
            $table->string('container_type_uid', 32)->nullable();
            $table->string('container_type_name', 255)->nullable();
            $table->integer('container_type')->nullable();
            $table->string('container_uid', 32)->nullable();
            $table->string('container_class_name', 255)->nullable();
            $table->string('container_name', 255)->nullable();
            $table->string('public_status', 255)->nullable();
            $table->boolean('protected')->nullable();
            $table->text('tags')->nullable();

            $table->index(['entity_uid', 'snapshot_unixtime'], 'droidbrain_vehicles_uid_time_index');
        });
    }

    protected function createLatestViews(): void
    {
        $this->createView('droidbrain_cities_latest', <<<'SQL'
SELECT
    c.id,
    c.file_id,
    c.snapshot_unixtime,
    c.entity_uid,
    c.entity_id,
    c.name,
    c.infotext,
    c.owner_name,
    c.owner_type,
    c.owner_uid,
    c.commander_name,
    c.commander_type,
    c.commander_uid,
    c.sector_uid,
    c.sector_name,
    c.system_uid,
    c.system_name,
    c.planet_uid,
    c.planet_name,
    c.galx,
    c.galy,
    c.sysx,
    c.sysy,
    c.surfx,
    c.surfy,
    c.visible,
    c.morale,
    c.crime,
    c.protected,
    c.tags
FROM droidbrain_cities c
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_time
    FROM droidbrain_cities
    GROUP BY entity_uid
) latest ON c.entity_uid = latest.entity_uid AND c.snapshot_unixtime = latest.max_time
SQL);

        $this->createView('droidbrain_npcs_latest', <<<'SQL'
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

        $this->createView('droidbrain_planets_latest', <<<'SQL'
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

        $this->createView('droidbrain_ships_latest', <<<'SQL'
SELECT
    s.id,
    s.file_id,
    s.snapshot_unixtime,
    s.entity_uid,
    s.entity_id,
    s.name,
    s.infotext,
    s.owner_name,
    s.owner_type,
    s.owner_uid,
    s.commander_name,
    s.commander_type,
    s.commander_uid,
    s.pilot_name,
    s.pilot_uid,
    s.sector_uid,
    s.sector_name,
    s.system_uid,
    s.system_name,
    s.planet_uid,
    s.planet_name,
    s.city_uid,
    s.city_name,
    s.galx,
    s.galy,
    s.sysx,
    s.sysy,
    s.surfx,
    s.surfy,
    s.groundx,
    s.groundy,
    s.class_name,
    s.class_id,
    s.type_name,
    s.type_id,
    s.hull,
    s.hull_max,
    s.shield,
    s.shield_max,
    s.ionic,
    s.ionic_max,
    s.passengers_remaining,
    s.passengers_total,
    s.volume_capacity_remaining,
    s.volume_capacity_total,
    s.weight_capacity_remaining,
    s.weight_capacity_total,
    s.container,
    s.container_type_uid,
    s.container_type_name,
    s.container_type,
    s.container_uid,
    s.container_class_name,
    s.container_name,
    s.public_status,
    s.protected,
    s.tags
FROM droidbrain_ships s
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_snapshot
    FROM droidbrain_ships
    GROUP BY entity_uid
) latest ON s.entity_uid = latest.entity_uid AND s.snapshot_unixtime = latest.max_snapshot
SQL);

        $this->createView('droidbrain_stations_latest', <<<'SQL'
SELECT
    s.id,
    s.file_id,
    s.snapshot_unixtime,
    s.entity_uid,
    s.entity_id,
    s.name,
    s.infotext,
    s.owner_name,
    s.owner_type,
    s.owner_uid,
    s.commander_name,
    s.commander_type,
    s.commander_uid,
    s.sector_uid,
    s.sector_name,
    s.system_uid,
    s.system_name,
    s.planet_uid,
    s.planet_name,
    s.galx,
    s.galy,
    s.sysx,
    s.sysy,
    s.surfx,
    s.surfy,
    s.class_name,
    s.class_id,
    s.type_name,
    s.type_id,
    s.hull,
    s.hull_max,
    s.shield,
    s.shield_max,
    s.ionic,
    s.ionic_max,
    s.public_status,
    s.protected,
    s.tags,
    s.production_status,
    s.production_delay1,
    s.production_delay2,
    s.tooled_to
FROM droidbrain_stations s
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_time
    FROM droidbrain_stations
    GROUP BY entity_uid
) latest ON s.entity_uid = latest.entity_uid AND s.snapshot_unixtime = latest.max_time
SQL);

        $this->createView('droidbrain_vehicles_latest', <<<'SQL'
SELECT
    v.id,
    v.file_id,
    v.snapshot_unixtime,
    v.entity_uid,
    v.entity_id,
    v.name,
    v.infotext,
    v.owner_name,
    v.owner_type,
    v.owner_uid,
    v.commander_name,
    v.commander_type,
    v.commander_uid,
    v.pilot_name,
    v.pilot_uid,
    v.sector_uid,
    v.sector_name,
    v.system_uid,
    v.system_name,
    v.planet_uid,
    v.planet_name,
    v.city_uid,
    v.city_name,
    v.galx,
    v.galy,
    v.sysx,
    v.sysy,
    v.surfx,
    v.surfy,
    v.class_name,
    v.class_id,
    v.type_name,
    v.type_id,
    v.hull,
    v.hull_max,
    v.ionic,
    v.ionic_max,
    v.container,
    v.container_type_uid,
    v.container_type_name,
    v.container_type,
    v.container_uid,
    v.container_class_name,
    v.container_name,
    v.protected,
    v.tags
FROM droidbrain_vehicles v
INNER JOIN (
    SELECT entity_uid, MAX(snapshot_unixtime) AS max_time
    FROM droidbrain_vehicles
    GROUP BY entity_uid
) latest ON v.entity_uid = latest.entity_uid AND v.snapshot_unixtime = latest.max_time
SQL);
    }

    protected function createView(string $name, string $sql): void
    {
        if ($this->relationType($name) === 'VIEW') {
            DB::statement("DROP VIEW IF EXISTS `{$name}`");
        }

        DB::statement("CREATE VIEW `{$name}` AS {$sql}");
    }

    protected function backupName(string $name): string
    {
        return $name . '_legacy_table';
    }

    protected function relationType(string $name): ?string
    {
        $database = DB::getDatabaseName();
        $row = DB::selectOne(
            'SELECT TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
            [$database, $name]
        );

        return $row?->TABLE_TYPE ?? null;
    }
};
