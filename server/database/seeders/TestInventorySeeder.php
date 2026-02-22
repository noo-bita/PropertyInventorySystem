<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\InventoryItem;
use App\Models\SchoolBudget;
use Illuminate\Support\Facades\DB;

class TestInventorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Delete all existing inventory items
        echo "Deleting all existing inventory items...\n";
        InventoryItem::truncate();
        echo "All items deleted.\n\n";

        // Get current budget
        $budget = SchoolBudget::getCurrent();
        echo "Current Budget Status:\n";
        echo "  Total Budget: ₱" . number_format($budget->total_budget, 2) . "\n";
        echo "  Total Spent: ₱" . number_format($budget->total_spent, 2) . "\n";
        echo "  Remaining: ₱" . number_format($budget->remaining_balance, 2) . "\n\n";

        // Sample items data - mix of purchased and donated
        $items = [
            // Electronics - Purchased (will deduct from budget)
            [
                'name' => 'Laptop',
                'category' => 'Electronics',
                'secondary_category' => 'Office Supplies',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Office',
                'description' => 'Dell Inspiron 15 - For office use',
                'serial_number' => 'SN-LAPTOP-001',
                'purchase_date' => '2025-01-15',
                'purchase_price' => 45000.00,
                'purchase_type' => 'purchased',
                'supplier' => 'Tech Solutions Inc.',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            [
                'name' => 'Mouse A4tech',
                'category' => 'Electronics',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Computer Lab',
                'description' => 'Wireless optical mouse',
                'serial_number' => 'SN-MOUSE-001',
                'purchase_date' => '2025-01-16',
                'purchase_price' => 500.00,
                'purchase_type' => 'purchased',
                'supplier' => 'Computer Store',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            [
                'name' => 'Mouse A4tech',
                'category' => 'Electronics',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Computer Lab',
                'description' => 'Wireless optical mouse',
                'serial_number' => 'SN-MOUSE-002',
                'purchase_date' => '2025-01-16',
                'purchase_price' => 500.00,
                'purchase_type' => 'purchased',
                'supplier' => 'Computer Store',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            [
                'name' => 'Mouse A4tech',
                'category' => 'Electronics',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Computer Lab',
                'description' => 'Wireless optical mouse',
                'serial_number' => 'SN-MOUSE-003',
                'purchase_date' => '2025-01-16',
                'purchase_price' => 500.00,
                'purchase_type' => 'purchased',
                'supplier' => 'Computer Store',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            [
                'name' => 'Printer',
                'category' => 'Electronics',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Office',
                'description' => 'HP LaserJet Pro',
                'serial_number' => 'SN-PRINTER-001',
                'purchase_date' => '2025-01-17',
                'purchase_price' => 12000.00,
                'purchase_type' => 'purchased',
                'supplier' => 'Office Equipment Co.',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            // Electronics - Donated (will NOT deduct from budget)
            [
                'name' => 'Tablet',
                'category' => 'Electronics',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Library',
                'description' => 'Samsung Galaxy Tab - For student use',
                'serial_number' => 'SN-TABLET-001',
                'purchase_date' => '2025-01-18',
                'purchase_price' => 0.00,
                'purchase_type' => 'donated',
                'supplier' => 'Tech Donors Foundation',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            [
                'name' => 'Tablet',
                'category' => 'Electronics',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Library',
                'description' => 'Samsung Galaxy Tab - For student use',
                'serial_number' => 'SN-TABLET-002',
                'purchase_date' => '2025-01-18',
                'purchase_price' => 0.00,
                'purchase_type' => 'donated',
                'supplier' => 'Tech Donors Foundation',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            // Furniture - Purchased
            [
                'name' => 'Office Chair',
                'category' => 'Furniture',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Office',
                'description' => 'Ergonomic office chair',
                'serial_number' => 'SN-CHAIR-001',
                'purchase_date' => '2025-01-19',
                'purchase_price' => 3500.00,
                'purchase_type' => 'purchased',
                'supplier' => 'Furniture World',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            [
                'name' => 'Office Chair',
                'category' => 'Furniture',
                'quantity' => 1,
                'available' => 1,
                'location' => 'Office',
                'description' => 'Ergonomic office chair',
                'serial_number' => 'SN-CHAIR-002',
                'purchase_date' => '2025-01-19',
                'purchase_price' => 3500.00,
                'purchase_type' => 'purchased',
                'supplier' => 'Furniture World',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
            // Office Supplies - Donated
            [
                'name' => 'Steel Series Mousepad',
                'category' => 'Office Supplies',
                'quantity' => 2,
                'available' => 2,
                'location' => 'Computer Lab',
                'description' => 'Large gaming mousepad',
                'serial_number' => 'SN-MOUSEPAD-001',
                'purchase_date' => '2025-01-20',
                'purchase_price' => 0.00,
                'purchase_type' => 'donated',
                'supplier' => 'Gaming Gear Donors',
                'added_by' => 'Admin User',
                'status' => 'Available',
                'last_updated' => now()->toDateString()
            ],
        ];

        echo "Creating test inventory items...\n\n";
        $totalPurchased = 0;
        $purchasedCount = 0;
        $donatedCount = 0;

        foreach ($items as $itemData) {
            $item = InventoryItem::create($itemData);
            
            // Deduct from budget if purchased
            if ($itemData['purchase_type'] === 'purchased' && $itemData['purchase_price'] > 0) {
                try {
                    $budget = SchoolBudget::getCurrent();
                    $budget->deduct((float) $itemData['purchase_price']);
                    $totalPurchased += (float) $itemData['purchase_price'];
                    $purchasedCount++;
                    echo "✓ Created: {$itemData['name']} (Serial: {$itemData['serial_number']}) - Purchased: ₱" . number_format($itemData['purchase_price'], 2) . "\n";
                } catch (\Exception $e) {
                    echo "✗ Failed to deduct budget for {$itemData['name']}: " . $e->getMessage() . "\n";
                }
            } else {
                $donatedCount++;
                echo "✓ Created: {$itemData['name']} (Serial: {$itemData['serial_number']}) - Donated\n";
            }
        }

        // Refresh budget to get latest values
        $budget->refresh();

        echo "\n" . str_repeat("=", 60) . "\n";
        echo "SUMMARY:\n";
        echo str_repeat("=", 60) . "\n";
        echo "Total Items Created: " . count($items) . "\n";
        echo "  - Purchased Items: {$purchasedCount}\n";
        echo "  - Donated Items: {$donatedCount}\n";
        echo "Total Amount Deducted: ₱" . number_format($totalPurchased, 2) . "\n\n";
        
        echo "Updated Budget Status:\n";
        echo "  Total Budget: ₱" . number_format($budget->total_budget, 2) . "\n";
        echo "  Total Spent: ₱" . number_format($budget->total_spent, 2) . "\n";
        echo "  Remaining: ₱" . number_format($budget->remaining_balance, 2) . "\n";
        echo str_repeat("=", 60) . "\n";
    }
}

