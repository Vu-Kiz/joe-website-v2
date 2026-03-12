<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('faction_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('faction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('can_view_payments')->default(false);
            $table->boolean('can_mark_payments_paid')->default(false);
            $table->boolean('can_manage_jobs')->default(false);
            $table->timestamps();

            $table->unique(['faction_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faction_user');
    }
};