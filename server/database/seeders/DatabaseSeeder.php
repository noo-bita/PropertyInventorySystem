<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create default admin user
        User::create([
            'name' => 'Admin User',
            'email' => 'admin@inventory.com',
            'password' => bcrypt('admin123'),
            'role' => 'admin',
            'department' => 'IT Department',
            'employee_id' => 'ADMIN001',
            'phone' => '123-456-7890',
            'address' => 'Admin Office',
        ]);

        // Create a sample teacher user
        User::create([
            'name' => 'John Teacher',
            'email' => 'teacher@school.com',
            'password' => bcrypt('teacher123'),
            'role' => 'teacher',
            'department' => 'Mathematics',
            'employee_id' => 'TCH001',
            'phone' => '123-456-7891',
            'address' => 'Teacher Office',
        ]);
    }
}
