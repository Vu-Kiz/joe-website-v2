<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_sector_cell_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sector_id')->nullable()->constrained('swc_sectors')->nullOnDelete();
            $table->string('sector_uid')->index();
            $table->integer('galx')->index();
            $table->integer('galy')->index();
            $table->string('marker_type', 40)->nullable()->index();
            $table->string('label')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['sector_uid', 'galx', 'galy']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_sector_cell_annotations');
    }
};
