<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('user_name')->nullable();
            $table->string('user_role')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('action'); // e.g., 'created', 'updated', 'deleted', 'login', 'logout'
            $table->string('module'); // e.g., 'inventory', 'user', 'request', 'report', 'auth'
            $table->string('description'); // Human-readable description
            $table->string('affected_item')->nullable(); // e.g., item name, user email, request ID
            $table->unsignedBigInteger('affected_item_id')->nullable(); // ID of affected item
            $table->text('metadata')->nullable(); // JSON for additional data
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();

            // Indexes for better query performance
            $table->index('user_id');
            $table->index('user_role');
            $table->index('module');
            $table->index('action');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};


