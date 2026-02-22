<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('school_budget', function (Blueprint $table) {
            $table->id();
            $table->decimal('total_budget', 15, 2)->default(0);
            $table->decimal('total_spent', 15, 2)->default(0);
            $table->decimal('remaining_balance', 15, 2)->default(0);
            $table->timestamps();
        });

        // Insert initial budget record
        DB::table('school_budget')->insert([
            'total_budget' => 0,
            'total_spent' => 0,
            'remaining_balance' => 0,
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('school_budget');
    }
};

