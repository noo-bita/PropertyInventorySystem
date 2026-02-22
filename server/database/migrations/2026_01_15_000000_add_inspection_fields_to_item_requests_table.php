<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // First, modify the status enum to include the new status
        // Note: MySQL doesn't support ALTER ENUM directly, so we need to use MODIFY COLUMN
        DB::statement("ALTER TABLE item_requests MODIFY COLUMN status ENUM('pending','approved','assigned','returned','returned_pending_inspection','overdue','rejected') DEFAULT 'pending'");
        
        // Add inspection-related fields
        Schema::table('item_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('inspected_by')->nullable()->after('returned_at');
            $table->enum('inspection_status', ['pending', 'accepted', 'damaged', 'under_maintenance'])->default('pending')->after('inspected_by');
            $table->text('damage_remarks')->nullable()->after('inspection_status');
            $table->text('damage_photo')->nullable()->after('damage_remarks'); // Store base64 or file path
            $table->timestamp('inspected_at')->nullable()->after('damage_photo');
        });
    }

    public function down(): void
    {
        Schema::table('item_requests', function (Blueprint $table) {
            $table->dropColumn([
                'inspected_by',
                'inspection_status',
                'damage_remarks',
                'damage_photo',
                'inspected_at'
            ]);
        });
        
        // Revert status enum (remove returned_pending_inspection)
        DB::statement("ALTER TABLE item_requests MODIFY COLUMN status ENUM('pending','approved','assigned','returned','overdue','rejected') DEFAULT 'pending'");
    }
};

