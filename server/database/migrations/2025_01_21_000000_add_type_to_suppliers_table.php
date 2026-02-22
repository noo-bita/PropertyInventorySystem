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
            $table->enum('type', ['SUPPLIER', 'DONOR'])->default('SUPPLIER')->after('status');
        });
        
        // Update existing suppliers to have type = SUPPLIER
        \DB::table('suppliers')->whereNull('type')->update(['type' => 'SUPPLIER']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};

