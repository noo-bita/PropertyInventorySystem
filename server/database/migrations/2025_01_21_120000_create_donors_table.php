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
        Schema::create('donors', function (Blueprint $table) {
            $table->id();
            $table->string('supplier_name'); // Donor name (keeping same field name for consistency)
            $table->string('company_name')->nullable(); // Company / Organization name (optional)
            $table->string('contact_person')->nullable(); // Contact person (optional)
            $table->string('contact_number')->nullable(); // Contact number (optional)
            $table->string('email')->nullable(); // Email address (optional)
            $table->text('address')->nullable(); // Physical address
            $table->text('notes')->nullable(); // Notes / remarks
            $table->enum('status', ['active', 'inactive'])->default('active'); // Status
            $table->date('date_added')->default(now()); // Date added
            $table->timestamps();
            $table->softDeletes(); // Soft deletes for deactivation
            
            // Indexes for performance
            $table->index('supplier_name');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('donors');
    }
};

