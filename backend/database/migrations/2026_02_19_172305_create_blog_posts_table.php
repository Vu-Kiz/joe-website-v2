<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('blog_posts')) return;

        Schema::create('blog_posts', function (Blueprint $table) {
            $table->id();

            $table->string('title', 255);
            $table->text('body');

            // Store BOTH: path (for deletes) and url (for easy frontend)
            $table->string('image_path', 255)->nullable();
            $table->string('image_url', 255)->nullable();

            $table->string('author_uid', 32);
            $table->string('author_handle', 100);

            $table->dateTime('created_at')->useCurrent();
            $table->string('cgt_created', 64)->nullable();

            // optional updated_at (handy for edits)
            $table->dateTime('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blog_posts');
    }
};
