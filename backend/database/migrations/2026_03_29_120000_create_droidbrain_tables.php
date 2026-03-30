<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('droidbrain_uploaders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('swc_uid', 40)->nullable()->index();
            $table->string('handle', 150)->nullable();
            $table->boolean('is_guest')->default(false);
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('droidbrain_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('uploader_id')->nullable()->constrained('droidbrain_uploaders')->nullOnDelete();
            $table->string('file_name', 255);
            $table->string('payload_type', 50)->nullable()->index();
            $table->string('inventory_version', 20)->nullable();
            $table->unsignedBigInteger('snapshot_unix')->nullable()->index();
            $table->string('uploader_swc_uid', 40)->nullable()->index();
            $table->string('uploader_handle', 150)->nullable();
            $table->string('file_hash', 64)->nullable()->index();
            $table->string('change_status', 30)->default('no_change')->index();
            $table->unsignedInteger('new_entities_count')->default(0);
            $table->unsignedInteger('modified_entities_count')->default(0);
            $table->unsignedInteger('unchanged_entities_count')->default(0);
            $table->longText('raw_xml')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        $this->createLatestEntityTable('droidbrain_ships_latest', function (Blueprint $table) {
            $table->string('type_name', 150)->nullable()->index();
            $table->string('class_name', 150)->nullable()->index();
            $table->string('sector_name', 150)->nullable()->index();
            $table->string('system_name', 150)->nullable()->index();
            $table->string('planet_name', 150)->nullable()->index();
            $table->string('owner_name', 150)->nullable()->index();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
        });

        $this->createLatestEntityTable('droidbrain_stations_latest', function (Blueprint $table) {
            $table->string('type_name', 150)->nullable()->index();
            $table->string('class_name', 150)->nullable()->index();
            $table->string('sector_name', 150)->nullable()->index();
            $table->string('system_name', 150)->nullable()->index();
            $table->string('planet_name', 150)->nullable()->index();
            $table->string('owner_name', 150)->nullable()->index();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
        });

        $this->createLatestEntityTable('droidbrain_planets_latest', function (Blueprint $table) {
            $table->string('type_name', 150)->nullable()->index();
            $table->string('sector_name', 150)->nullable()->index();
            $table->string('system_name', 150)->nullable()->index();
            $table->string('government', 150)->nullable()->index();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
        });

        $this->createLatestEntityTable('droidbrain_cities_latest', function (Blueprint $table) {
            $table->string('sector_name', 150)->nullable()->index();
            $table->string('system_name', 150)->nullable()->index();
            $table->string('planet_name', 150)->nullable()->index();
            $table->string('owner_name', 150)->nullable()->index();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
        });

        $this->createLatestEntityTable('droidbrain_vehicles_latest', function (Blueprint $table) {
            $table->string('type_name', 150)->nullable()->index();
            $table->string('class_name', 150)->nullable()->index();
            $table->string('sector_name', 150)->nullable()->index();
            $table->string('system_name', 150)->nullable()->index();
            $table->string('planet_name', 150)->nullable()->index();
            $table->string('owner_name', 150)->nullable()->index();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
        });

        $this->createLatestEntityTable('droidbrain_npcs_latest', function (Blueprint $table) {
            $table->string('race_name', 150)->nullable()->index();
            $table->string('class_name', 150)->nullable()->index();
            $table->string('sector_name', 150)->nullable()->index();
            $table->string('system_name', 150)->nullable()->index();
            $table->string('planet_name', 150)->nullable()->index();
            $table->string('owner_name', 150)->nullable()->index();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('droidbrain_npcs_latest');
        Schema::dropIfExists('droidbrain_vehicles_latest');
        Schema::dropIfExists('droidbrain_cities_latest');
        Schema::dropIfExists('droidbrain_planets_latest');
        Schema::dropIfExists('droidbrain_stations_latest');
        Schema::dropIfExists('droidbrain_ships_latest');
        Schema::dropIfExists('droidbrain_files');
        Schema::dropIfExists('droidbrain_uploaders');
    }

    private function createLatestEntityTable(string $tableName, callable $extraColumns): void
    {
        Schema::create($tableName, function (Blueprint $table) use ($extraColumns) {
            $table->id();
            $table->foreignId('file_id')->nullable()->constrained('droidbrain_files')->nullOnDelete();
            $table->string('entity_uid', 80)->unique();
            $table->string('identifier', 80)->nullable()->index();
            $table->string('name', 180)->nullable()->index();
            $extraColumns($table);
            $table->unsignedBigInteger('snapshot_unix')->nullable()->index();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }
};
