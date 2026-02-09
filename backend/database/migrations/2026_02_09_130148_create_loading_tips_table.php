<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loading_tips', function (Blueprint $table) {
            $table->id(); // int(10) unsigned, auto-increment, primary key
            $table->text('tip'); // tip text NOT NULL

            // Match the old behaviour: created_at with CURRENT_TIMESTAMP default
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loading_tips');
    }
};
