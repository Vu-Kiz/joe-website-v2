<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_sector_search_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sector_id')->nullable()->constrained('swc_sectors')->nullOnDelete();
            $table->string('sector_uid')->index();
            $table->integer('galx')->index();
            $table->integer('galy')->index();
            $table->boolean('is_system_searched')->default(false);
            $table->boolean('has_asteroids')->default(false);
            $table->text('legacy_note')->nullable();
            $table->timestamp('legacy_recorded_at')->nullable();
            $table->string('legacy_player')->nullable();
            $table->string('legacy_icon')->nullable();
            $table->string('legacy_handle')->nullable();
            $table->string('legacy_tag')->nullable();
            $table->boolean('legacy_read')->default(false);
            $table->timestamps();

            $table->unique(['sector_uid', 'galx', 'galy']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_sector_search_records');
    }
};
