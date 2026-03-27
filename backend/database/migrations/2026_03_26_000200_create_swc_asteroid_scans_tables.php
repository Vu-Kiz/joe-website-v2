<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_asteroid_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sector_id')->nullable()->constrained('swc_sectors')->nullOnDelete();
            $table->foreignId('system_id')->nullable()->constrained('swc_systems')->nullOnDelete();
            $table->string('sector_uid')->nullable()->index();
            $table->string('sector_name')->nullable();
            $table->string('system_uid')->nullable()->index();
            $table->string('system_name')->nullable()->index();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->string('source_kind', 40)->default('xml_upload')->index();
            $table->string('source_filename')->nullable();
            $table->string('source_event_type')->nullable()->index();
            $table->string('source_event_uid')->nullable()->index();
            $table->boolean('reported_has_asteroids')->nullable()->index();
            $table->timestamp('scanned_at')->nullable()->index();
            $table->timestamp('uploaded_at')->nullable()->index();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedSmallInteger('map_width')->nullable();
            $table->unsignedSmallInteger('map_height')->nullable();
            $table->json('asteroid_map')->nullable();
            $table->json('raw_payload')->nullable();
            $table->longText('raw_xml')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('last_processed_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('swc_asteroid_scan_cells', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asteroid_scan_id')->constrained('swc_asteroid_scans')->cascadeOnDelete();
            $table->integer('cell_x')->index();
            $table->integer('cell_y')->index();
            $table->string('tile_code', 32)->nullable()->index();
            $table->string('tile_name')->nullable();
            $table->json('tile_payload')->nullable();
            $table->timestamps();

            $table->unique(['asteroid_scan_id', 'cell_x', 'cell_y']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_asteroid_scan_cells');
        Schema::dropIfExists('swc_asteroid_scans');
    }
};
