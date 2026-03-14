<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenets_of_salvage', function (Blueprint $table) {
            $table->id();
            $table->string('title', 160);
            $table->text('body_bbcode');
            $table->integer('weight')->default(0)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenets_of_salvage');
    }
};