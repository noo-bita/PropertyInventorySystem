<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use App\Models\InventoryItem;

class SchoolBudget extends Model
{
    protected $table = 'school_budget';

    protected $fillable = [
        'total_budget',
        'total_spent',
        'remaining_balance'
    ];

    protected $casts = [
        'total_budget' => 'decimal:2',
        'total_spent' => 'decimal:2',
        'remaining_balance' => 'decimal:2'
    ];

    /**
     * Get the current budget instance (singleton pattern)
     */
    public static function getCurrent(): self
    {
        return self::firstOrCreate([], [
            'total_budget' => 0,
            'total_spent' => 0,
            'remaining_balance' => 0
        ]);
    }

    /**
     * Update budget amount
     */
    public function updateBudget(float $newTotalBudget): bool
    {
        try {
            $this->total_budget = $newTotalBudget;
            $this->remaining_balance = $newTotalBudget - $this->total_spent;
            
            // Ensure remaining balance doesn't go negative
            if ($this->remaining_balance < 0) {
                $this->remaining_balance = 0;
            }
            
            $saved = $this->save();
            
            // Refresh the model to ensure we have the latest values
            $this->refresh();
            
            return $saved;
        } catch (\Exception $e) {
            \Log::error('Error updating budget in model: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Deduct from budget
     */
    public function deduct(float $amount): bool
    {
        if ($this->remaining_balance < $amount) {
            return false; // Insufficient funds
        }

        $this->total_spent += $amount;
        $this->remaining_balance -= $amount;
        $this->save();

        return true;
    }

    /**
     * Refund to budget (e.g., when item is deleted)
     */
    public function refund(float $amount): void
    {
        $this->total_spent = max(0, $this->total_spent - $amount);
        $this->remaining_balance = $this->total_budget - $this->total_spent;
        $this->save();
    }

    /**
     * Recalculate total spent from all inventory items
     * Excludes soft-deleted items (checks for deleted_at column)
     */
    public function recalculateTotalSpent(): float
    {
        // Check if deleted_at column exists in the table
        $hasDeletedAt = DB::getSchemaBuilder()->hasColumn('inventory_items', 'deleted_at');
        
        $query = InventoryItem::where('purchase_type', 'purchased')
            ->whereNotNull('purchase_price')
            ->where('purchase_price', '>', 0);
        
        // Exclude soft-deleted items if deleted_at column exists
        if ($hasDeletedAt) {
            $query->whereNull('deleted_at');
        }
        
        $totalSpent = $query->sum('purchase_price');

        $this->total_spent = (float) $totalSpent;
        $this->remaining_balance = max(0, $this->total_budget - $this->total_spent);
        $this->save();

        return $this->total_spent;
    }
}

