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
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('supplier_name'); // Supplier name
            $table->string('company_name')->nullable(); // Company / Business name
            $table->string('contact_person')->nullable(); // Contact person
            $table->string('contact_number')->nullable(); // Contact number
            $table->string('email')->nullable(); // Email address
            $table->text('address')->nullable(); // Physical address
            $table->string('business_registration_number')->nullable(); // Business registration number
            $table->text('notes')->nullable(); // Notes / remarks
            $table->enum('status', ['active', 'inactive'])->default('active'); // Status
            $table->date('date_added')->default(now()); // Date added
            $table->timestamps();
            $table->softDeletes(); // Soft deletes for deactivation
            
            // Indexes for performance
            $table->index('supplier_name');
            $table->index('status');
            $table->index('business_registration_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
