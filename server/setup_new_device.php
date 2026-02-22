<?php
/**
 * Setup script for new device/database
 * Run this after cloning the project to set up the database and create admin user
 */

require_once 'vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Database configuration
$host = $_ENV['DB_HOST'] ?? '127.0.0.1';
$port = $_ENV['DB_PORT'] ?? '3306';
$database = $_ENV['DB_DATABASE'] ?? 'capstone_inventory';
$username = $_ENV['DB_USERNAME'] ?? 'root';
$password = $_ENV['DB_PASSWORD'] ?? '';

echo "🚀 Setting up Inventory Management System on new device...\n\n";

try {
    // Test database connection
    echo "1. Testing database connection...\n";
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$database", $username, $password);
    echo "✅ Database connection successful!\n\n";

    // Check if users table exists
    echo "2. Checking if users table exists...\n";
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() == 0) {
        echo "❌ Users table not found. Please run 'php artisan migrate' first.\n";
        exit(1);
    }
    echo "✅ Users table found!\n\n";

    // Check if admin user already exists
    echo "3. Checking for existing admin user...\n";
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND role = 'admin'");
    $stmt->execute(['admin@inventory.com']);

    if ($stmt->rowCount() > 0) {
        echo "✅ Admin user already exists!\n\n";
    } else {
        echo "4. Creating admin user...\n";

        // Create admin user
        $stmt = $pdo->prepare("
            INSERT INTO users (name, email, password, role, department, employee_id, phone, address, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");

        $hashedPassword = password_hash('admin123', PASSWORD_DEFAULT);
        $stmt->execute([
            'Admin User',
            'admin@inventory.com',
            $hashedPassword,
            'admin',
            'IT Department',
            'ADMIN001',
            '123-456-7890',
            'Admin Office'
        ]);

        echo "✅ Admin user created successfully!\n\n";
    }

    // Create sample teacher user
    echo "5. Creating sample teacher user...\n";
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute(['teacher@school.com']);

    if ($stmt->rowCount() == 0) {
        $stmt = $pdo->prepare("
            INSERT INTO users (name, email, password, role, department, employee_id, phone, address, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");

        $hashedPassword = password_hash('teacher123', PASSWORD_DEFAULT);
        $stmt->execute([
            'John Teacher',
            'teacher@school.com',
            $hashedPassword,
            'teacher',
            'Mathematics',
            'TCH001',
            '123-456-7891',
            'Teacher Office'
        ]);

        echo "✅ Sample teacher user created!\n\n";
    } else {
        echo "✅ Sample teacher user already exists!\n\n";
    }

    echo "🎉 Setup completed successfully!\n\n";
    echo "📋 Login Credentials:\n";
    echo "   Admin: admin@inventory.com / admin123\n";
    echo "   Teacher: teacher@school.com / teacher123\n\n";
    echo "🔧 Next steps:\n";
    echo "   1. Start the server: php artisan serve --host=127.0.0.1 --port=8000\n";
    echo "   2. Start the client: cd ../client && npm start\n";
    echo "   3. Open http://localhost:3000 in your browser\n\n";

} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
    echo "Please check your database configuration in .env file\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ Setup failed: " . $e->getMessage() . "\n";
    exit(1);
}

