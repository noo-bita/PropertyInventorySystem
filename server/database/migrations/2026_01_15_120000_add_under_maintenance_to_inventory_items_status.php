<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Modify the status enum to include 'Under Maintenance'
        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN status ENUM('Available', 'Low Stock', 'Out of Stock', 'Under Maintenance') DEFAULT 'Available'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to original enum values
        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN status ENUM('Available', 'Low Stock', 'Out of Stock') DEFAULT 'Available'");
    }
};

