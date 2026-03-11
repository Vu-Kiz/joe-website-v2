<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('swc_time_state', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('year');
            $table->unsignedInteger('day');
            $table->unsignedInteger('hours');
            $table->unsignedInteger('mins');
            $table->unsignedInteger('secs')->default(0);

            $table->unsignedBigInteger('swc_seconds')->default(0);

            $table->timestamp('refreshed_at');
            $table->timestamps(); // created_at, updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swc_time_state');
    }
};