<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('droidbrain_upload_queue_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('file_name', 255);
            $table->string('file_extension', 20)->nullable();
            $table->string('file_mime_type', 120)->nullable();
            $table->string('file_hash', 64)->nullable()->index();
            $table->string('status', 30)->default('queued')->index();
            $table->unsignedBigInteger('result_file_id')->nullable()->index();
            $table->json('result_payload')->nullable();
            $table->text('error_message')->nullable();
            $table->longText('raw_xml')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('droidbrain_upload_queue_items');
    }
};
