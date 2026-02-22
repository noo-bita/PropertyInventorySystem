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
        // Modify the status enum to include 'Damaged'
        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN status ENUM('Available', 'Low Stock', 'Out of Stock', 'Under Maintenance', 'Damaged') DEFAULT 'Available'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to previous enum values
        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN status ENUM('Available', 'Low Stock', 'Out of Stock', 'Under Maintenance') DEFAULT 'Available'");
    }
};

