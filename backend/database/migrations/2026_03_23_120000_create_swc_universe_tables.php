<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_sectors', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('name')->nullable()->index();
            $table->unsignedInteger('coordinate_count')->default(0);
            $table->unsignedInteger('system_count')->default(0);
            $table->unsignedSmallInteger('color_r')->nullable();
            $table->unsignedSmallInteger('color_g')->nullable();
            $table->unsignedSmallInteger('color_b')->nullable();
            $table->string('color_hex', 7)->nullable();
            $table->json('outline_coordinates')->nullable();
            $table->json('bounds')->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('swc_systems', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('identifier')->nullable()->index();
            $table->string('name')->nullable()->index();
            $table->foreignId('sector_id')->nullable()->constrained('swc_sectors')->nullOnDelete();
            $table->string('sector_uid')->nullable()->index();
            $table->string('sector_name')->nullable();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('swc_planets', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('identifier')->nullable()->index();
            $table->string('name')->nullable()->index();
            $table->foreignId('sector_id')->nullable()->constrained('swc_sectors')->nullOnDelete();
            $table->foreignId('system_id')->nullable()->constrained('swc_systems')->nullOnDelete();
            $table->string('sector_uid')->nullable()->index();
            $table->string('sector_name')->nullable();
            $table->string('system_uid')->nullable()->index();
            $table->string('system_name')->nullable();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->string('owner_uid')->nullable()->index();
            $table->string('owner_name')->nullable();
            $table->unsignedInteger('size')->nullable();
            $table->longText('terrain_map')->nullable();
            $table->json('surface_bounds')->nullable();
            $table->json('terrain_grid')->nullable();
            $table->json('cities')->nullable();
            $table->text('image_small_url')->nullable();
            $table->text('image_large_url')->nullable();
            $table->text('image_atmosphere_url')->nullable();
            $table->text('image_stratosphere_url')->nullable();
            $table->text('image_loworbit_url')->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('swc_stations', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->unique();
            $table->string('identifier')->nullable()->index();
            $table->string('name')->nullable()->index();
            $table->string('type_name')->nullable();
            $table->foreignId('sector_id')->nullable()->constrained('swc_sectors')->nullOnDelete();
            $table->foreignId('system_id')->nullable()->constrained('swc_systems')->nullOnDelete();
            $table->string('sector_uid')->nullable()->index();
            $table->string('sector_name')->nullable();
            $table->string('system_uid')->nullable()->index();
            $table->string('system_name')->nullable();
            $table->integer('galx')->nullable()->index();
            $table->integer('galy')->nullable()->index();
            $table->integer('sysx')->nullable();
            $table->integer('sysy')->nullable();
            $table->string('owner_uid')->nullable()->index();
            $table->string('owner_name')->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('swc_hyperlanes', function (Blueprint $table) {
            $table->id();
            $table->string('uid')->nullable()->index();
            $table->foreignId('source_system_id')->nullable()->constrained('swc_systems')->nullOnDelete();
            $table->string('source_system_uid')->nullable()->index();
            $table->string('name')->nullable();
            $table->string('destination_uid')->nullable()->index();
            $table->string('destination_name')->nullable();
            $table->integer('destination_galx')->nullable()->index();
            $table->integer('destination_galy')->nullable()->index();
            $table->string('owner_name')->nullable();
            $table->unsignedInteger('blocks')->nullable();
            $table->decimal('modifier', 8, 3)->nullable();
            $table->timestamp('last_pulled_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['source_system_uid', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_hyperlanes');
        Schema::dropIfExists('swc_stations');
        Schema::dropIfExists('swc_planets');
        Schema::dropIfExists('swc_systems');
        Schema::dropIfExists('swc_sectors');
    }
};
