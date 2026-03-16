<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swc_faction_privilege_cache', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('faction_id')->constrained()->cascadeOnDelete();

            $table->string('privilege_group', 100);
            $table->string('privilege_name', 100);

            $table->boolean('is_allowed')->default(false);
            $table->timestamp('checked_at')->nullable();
            $table->json('meta')->nullable();

            $table->timestamps();

            $table->unique(
                ['user_id', 'faction_id', 'privilege_group', 'privilege_name'],
                'swc_faction_priv_cache_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_faction_privilege_cache');
    }
};