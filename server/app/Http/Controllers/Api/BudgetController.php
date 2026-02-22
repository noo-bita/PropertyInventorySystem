<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SchoolBudget;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BudgetController extends Controller
{
    /**
     * Get current budget information
     */
    public function index(): JsonResponse
    {
        try {
            $budget = SchoolBudget::getCurrent();
            
            return response()->json([
                'total_budget' => (float) $budget->total_budget,
                'total_spent' => (float) $budget->total_spent,
                'remaining_balance' => (float) $budget->remaining_balance,
                'percentage_used' => $budget->total_budget > 0 
                    ? round(($budget->total_spent / $budget->total_budget) * 100, 2) 
                    : 0
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching budget: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch budget information',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update budget (Admin only)
     */
    public function update(Request $request): JsonResponse
    {
        // Get user from request attributes (set by AuthTokenMiddleware) or from token
        $user = $request->attributes->get('auth_user');
        if (!$user) {
            // Fallback: get user from token
            $auth = $request->header('Authorization');
            if ($auth && str_starts_with($auth, 'Bearer ')) {
                $token = substr($auth, 7);
                $user = User::where('api_token', $token)->first();
            }
        }
        
        if (!$user) {
            return response()->json([
                'error' => 'Unauthorized. Please log in to continue.'
            ], 401);
        }
        
        // Check if user is admin (case-insensitive check)
        if (strtoupper($user->role) !== 'ADMIN') {
            return response()->json([
                'error' => 'Unauthorized. Only administrators can update budget.'
            ], 403);
        }

        $request->validate([
            'total_budget' => 'required|numeric|min:0'
        ]);

        try {
            $budget = SchoolBudget::getCurrent();
            $oldBudget = $budget->total_budget;
            $newBudget = (float) $request->total_budget;
            
            // Update the budget
            $updated = $budget->updateBudget($newBudget);
            
            if (!$updated) {
                \Log::error('Failed to save budget update');
                return response()->json([
                    'error' => 'Failed to update budget',
                    'message' => 'Could not save budget changes to database'
                ], 500);
            }
            
            // Refresh the budget model to get latest values
            $budget->refresh();

            // Log activity
            try {
                ActivityLogService::log(
                    'updated',
                    'Budget',
                    "School budget updated from ₱" . number_format($oldBudget, 2) . " to ₱" . number_format($budget->total_budget, 2),
                    $user->id,
                    $user->first_name . ' ' . $user->last_name,
                    $user->role,
                    'School Budget',
                    $budget->id,
                    null,
                    $request
                );
            } catch (\Exception $logError) {
                // Don't fail the request if logging fails
                \Log::warning('Failed to log budget update activity: ' . $logError->getMessage());
            }

            return response()->json([
                'message' => 'Budget updated successfully',
                'budget' => [
                    'total_budget' => (float) $budget->total_budget,
                    'total_spent' => (float) $budget->total_spent,
                    'remaining_balance' => (float) $budget->remaining_balance,
                    'percentage_used' => $budget->total_budget > 0 
                        ? round(($budget->total_spent / $budget->total_budget) * 100, 2) 
                        : 0
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error updating budget: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'error' => 'Failed to update budget',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Recalculate total spent from existing inventory items (Admin only)
     */
    public function recalculate(Request $request): JsonResponse
    {
        // Get user from request attributes (set by AuthTokenMiddleware) or from token
        $user = $request->attributes->get('auth_user');
        if (!$user) {
            // Fallback: get user from token
            $auth = $request->header('Authorization');
            if ($auth && str_starts_with($auth, 'Bearer ')) {
                $token = substr($auth, 7);
                $user = User::where('api_token', $token)->first();
            }
        }
        
        if (!$user) {
            return response()->json([
                'error' => 'Unauthorized. Please log in to continue.'
            ], 401);
        }
        
        // Check if user is admin (case-insensitive check)
        if (strtoupper($user->role) !== 'ADMIN') {
            return response()->json([
                'error' => 'Unauthorized. Only administrators can recalculate budget.'
            ], 403);
        }

        try {
            $budget = SchoolBudget::getCurrent();
            $oldTotalSpent = $budget->total_spent;
            
            // Recalculate total spent from all inventory items
            $newTotalSpent = $budget->recalculateTotalSpent();
            
            // Refresh the budget model to get latest values
            $budget->refresh();

            // Log activity
            try {
                ActivityLogService::log(
                    'updated',
                    'Budget',
                    "Budget recalculated. Total spent updated from ₱" . number_format($oldTotalSpent, 2) . " to ₱" . number_format($newTotalSpent, 2),
                    $user->id,
                    $user->first_name . ' ' . $user->last_name,
                    $user->role,
                    'School Budget',
                    $budget->id,
                    null,
                    $request
                );
            } catch (\Exception $logError) {
                // Don't fail the request if logging fails
                \Log::warning('Failed to log budget recalculation activity: ' . $logError->getMessage());
            }

            return response()->json([
                'message' => 'Budget recalculated successfully',
                'budget' => [
                    'total_budget' => (float) $budget->total_budget,
                    'total_spent' => (float) $budget->total_spent,
                    'remaining_balance' => (float) $budget->remaining_balance,
                    'percentage_used' => $budget->total_budget > 0 
                        ? round(($budget->total_spent / $budget->total_budget) * 100, 2) 
                        : 0
                ],
                'previous_total_spent' => (float) $oldTotalSpent
            ]);
        } catch (\Exception $e) {
            \Log::error('Error recalculating budget: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'error' => 'Failed to recalculate budget',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reset budget - clear total spent and optionally set new budget (Admin only)
     */
    public function reset(Request $request): JsonResponse
    {
        // Get user from request attributes (set by AuthTokenMiddleware) or from token
        $user = $request->attributes->get('auth_user');
        if (!$user) {
            // Fallback: get user from token
            $auth = $request->header('Authorization');
            if ($auth && str_starts_with($auth, 'Bearer ')) {
                $token = substr($auth, 7);
                $user = User::where('api_token', $token)->first();
            }
        }
        
        if (!$user) {
            return response()->json([
                'error' => 'Unauthorized. Please log in to continue.'
            ], 401);
        }
        
        // Check if user is admin (case-insensitive check)
        if (strtoupper($user->role) !== 'ADMIN') {
            return response()->json([
                'error' => 'Unauthorized. Only administrators can reset budget.'
            ], 403);
        }

        $request->validate([
            'total_budget' => 'nullable|numeric|min:0'
        ]);

        try {
            $budget = SchoolBudget::getCurrent();
            $oldTotalBudget = $budget->total_budget;
            $oldTotalSpent = $budget->total_spent;
            
            // Reset total spent to 0
            $budget->total_spent = 0;
            
            // If new budget is provided, set it; otherwise keep the current budget
            if ($request->has('total_budget') && $request->total_budget !== null) {
                $budget->total_budget = (float) $request->total_budget;
            }
            
            // Recalculate remaining balance
            $budget->remaining_balance = $budget->total_budget;
            $budget->save();
            
            // Refresh the budget model to get latest values
            $budget->refresh();

            // Log activity
            try {
                $logMessage = "Budget reset. Total spent cleared from ₱" . number_format($oldTotalSpent, 2) . " to ₱0.00";
                if ($request->has('total_budget') && $request->total_budget !== null) {
                    $logMessage .= " | Total budget updated from ₱" . number_format($oldTotalBudget, 2) . " to ₱" . number_format($budget->total_budget, 2);
                }
                
                ActivityLogService::log(
                    'updated',
                    'Budget',
                    $logMessage,
                    $user->id,
                    $user->first_name . ' ' . $user->last_name,
                    $user->role,
                    'School Budget',
                    $budget->id,
                    null,
                    $request
                );
            } catch (\Exception $logError) {
                // Don't fail the request if logging fails
                \Log::warning('Failed to log budget reset activity: ' . $logError->getMessage());
            }

            return response()->json([
                'message' => 'Budget reset successfully',
                'budget' => [
                    'total_budget' => (float) $budget->total_budget,
                    'total_spent' => (float) $budget->total_spent,
                    'remaining_balance' => (float) $budget->remaining_balance,
                    'percentage_used' => 0
                ],
                'previous_total_spent' => (float) $oldTotalSpent,
                'previous_total_budget' => (float) $oldTotalBudget
            ]);
        } catch (\Exception $e) {
            \Log::error('Error resetting budget: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'error' => 'Failed to reset budget',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}

