<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriber_cell_records', function (Blueprint $table) {
            $table->id();
            // owner: either a user (individual sub) or a faction (faction sub)
            $table->string('owner_type', 16); // 'user' or 'faction'
            $table->unsignedBigInteger('owner_id');
            $table->string('sector_uid', 32)->nullable();
            $table->integer('galx');
            $table->integer('galy');
            $table->string('square_name', 64)->nullable();
            $table->boolean('is_system_searched')->default(false);
            $table->boolean('has_asteroids')->default(false);
            $table->boolean('planetoids_checked')->nullable();
            $table->string('planetoid_1_size', 8)->nullable();
            $table->string('planetoid_2_size', 8)->nullable();
            $table->boolean('has_ships')->nullable();
            $table->boolean('has_stations')->nullable();
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // one record per cell per owner
            $table->unique(['owner_type', 'owner_id', 'galx', 'galy']);
            $table->index(['galx', 'galy']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriber_cell_records');
    }
};
