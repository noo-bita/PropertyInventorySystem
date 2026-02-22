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
        Schema::table('suppliers', function (Blueprint $table) {
            $table->timestamp('deactivated_at')->nullable()->after('status');
        });

        Schema::table('donors', function (Blueprint $table) {
            $table->timestamp('deactivated_at')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('deactivated_at');
        });

        Schema::table('donors', function (Blueprint $table) {
            $table->dropColumn('deactivated_at');
        });
    }
};
