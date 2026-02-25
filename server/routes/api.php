<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PrototypeController;
use App\Http\Controllers\Api\UsersController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\ItemRequestsController;
use App\Http\Controllers\Api\CustomRequestsController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\DonorController;
use App\Http\Controllers\Api\BudgetController;
use App\Http\Middleware\AuthTokenMiddleware;
use App\Http\Middleware\CorsMiddleware;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Apply CORS middleware to all API routes
Route::middleware([CorsMiddleware::class])->group(function () {
    Route::get('/health', [PrototypeController::class, 'health']);
    Route::get('/sample', [PrototypeController::class, 'sampleData']);

    // Simple auth
    Route::post('/login', [UsersController::class, 'login']);
    Route::post('/logout', [UsersController::class, 'logout']);

    // Users API routes - all now public for testing
    // (will be protected again once authentication is implemented)

    // Public users - all endpoints (temporary for testing)
    Route::get('/users', [UsersController::class, 'index']);
    Route::post('/users', [UsersController::class, 'store']);
    Route::get('/users/{user}', [UsersController::class, 'show']);
    Route::put('/users/{user}', [UsersController::class, 'update']);
    Route::delete('/users/{user}', [UsersController::class, 'destroy']);
    Route::patch('/users/{id}/restore', [UsersController::class, 'restore']);
    Route::delete('/users/{id}/force-delete', [UsersController::class, 'forceDelete']);

    // Dashboard routes - protected
    Route::middleware([AuthTokenMiddleware::class])->group(function () {
        Route::get('/dashboard/admin', [DashboardController::class, 'admin']);
        Route::get('/dashboard/teacher', [DashboardController::class, 'teacher']);
    });

    // Inventory protected routes
    Route::middleware([AuthTokenMiddleware::class])->group(function () {
        Route::post('/inventory', [InventoryController::class, 'store']);
        Route::put('/inventory/{inventoryItem}', [InventoryController::class, 'update']);
        Route::delete('/inventory/{inventoryItem}', [InventoryController::class, 'destroy']);
        Route::post('/inventory/bulk-delete', [InventoryController::class, 'bulkDelete']);
        Route::post('/inventory/bulk-update', [InventoryController::class, 'bulkUpdate']);
        Route::post('/inventory/{inventoryItem}/mark-repaired', [InventoryController::class, 'markRepaired']);
        Route::post('/inventory/cleanup-consumable-serial-numbers', [InventoryController::class, 'cleanupConsumableSerialNumbers']);

        // Requests protected routes
        Route::post('/requests', [ItemRequestsController::class, 'store']);
        Route::post('/requests/{itemRequest}/approve-and-assign', [ItemRequestsController::class, 'approveAndAssign']);
        Route::post('/requests/{itemRequest}/assign', [ItemRequestsController::class, 'assign']);
        Route::post('/requests/{itemRequest}/return', [ItemRequestsController::class, 'markReturned']);
        Route::post('/requests/{itemRequest}/teacher-return', [ItemRequestsController::class, 'teacherReturnItem']);
        Route::patch('/requests/{itemRequest}/status', [ItemRequestsController::class, 'updateStatus']);
        Route::post('/requests/{itemRequest}/custom-response', [ItemRequestsController::class, 'respondToCustomRequest']);
        Route::delete('/requests/{itemRequest}', [ItemRequestsController::class, 'destroy']);
        
        // Return inspection routes - Admin/Custodian only
        Route::get('/requests/pending-inspection', [ItemRequestsController::class, 'getPendingInspectionItems']);
        Route::post('/requests/{itemRequest}/inspection/accept', [ItemRequestsController::class, 'acceptReturn']);
        Route::post('/requests/{itemRequest}/inspection/reject', [ItemRequestsController::class, 'rejectReturn']);
        Route::post('/requests/{itemRequest}/inspection/damaged', [ItemRequestsController::class, 'markAsDamaged']);
        Route::post('/requests/{itemRequest}/inspection/maintenance', [ItemRequestsController::class, 'sendForMaintenance']);

        // Custom Requests protected routes
        Route::get('/custom-requests', [CustomRequestsController::class, 'index']);
        Route::post('/custom-requests', [CustomRequestsController::class, 'store']);
        Route::get('/custom-requests/{customRequest}', [CustomRequestsController::class, 'show']);
        Route::put('/custom-requests/{customRequest}', [CustomRequestsController::class, 'update']);
        Route::delete('/custom-requests/{customRequest}', [CustomRequestsController::class, 'destroy']);
        Route::post('/custom-requests/{customRequest}/respond', [CustomRequestsController::class, 'respondToCustomRequest']);
        Route::post('/custom-requests/{customRequest}/update-purchasing', [CustomRequestsController::class, 'updatePurchasingRequest']);

        // Reports protected routes
        Route::get('/reports', [ReportsController::class, 'index']);
        Route::post('/reports', [ReportsController::class, 'store']);
        Route::get('/reports/{report}', [ReportsController::class, 'show']);
        Route::put('/reports/{report}', [ReportsController::class, 'update']);
        Route::delete('/reports/{report}', [ReportsController::class, 'destroy']);
        Route::post('/reports/{report}/respond', [ReportsController::class, 'respondToReport']);
        Route::post('/reports/generate', [ReportsController::class, 'generate']);
        Route::post('/reports/download', [ReportsController::class, 'download']); // DOCX download
        Route::post('/reports/download-pdf', [ReportsController::class, 'downloadPdf']); // PDF download
        Route::post('/reports/download-excel', [ReportsController::class, 'downloadExcel']); // Excel download

        // Activity Log routes - Admin only
        Route::get('/activity-logs', [ActivityLogController::class, 'index']);
        Route::get('/activity-logs/filter-options', [ActivityLogController::class, 'getFilterOptions']);

        // Suppliers routes - Admin only
        // IMPORTANT: /suppliers/active must come BEFORE /suppliers/{supplier} to avoid route conflicts
        Route::get('/suppliers/active', [SupplierController::class, 'active']);
        Route::get('/suppliers', [SupplierController::class, 'index']);
        Route::post('/suppliers', [SupplierController::class, 'store']);
        Route::get('/suppliers/{supplier}', [SupplierController::class, 'show']);
        Route::put('/suppliers/{supplier}', [SupplierController::class, 'update']);
        Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy']);

        // Donors routes - Admin only
        // IMPORTANT: /donors/active must come BEFORE /donors/{donor} to avoid route conflicts
        Route::get('/donors/active', [DonorController::class, 'active']);
        Route::get('/donors', [DonorController::class, 'index']);
        Route::post('/donors', [DonorController::class, 'store']);
        Route::get('/donors/{donor}', [DonorController::class, 'show']);
        Route::put('/donors/{donor}', [DonorController::class, 'update']);
        Route::delete('/donors/{donor}', [DonorController::class, 'destroy']);

        // Budget routes - View for all authenticated users, Update for Admin only
        Route::get('/budget', [BudgetController::class, 'index']);
        Route::put('/budget', [BudgetController::class, 'update']);
        Route::post('/budget/recalculate', [BudgetController::class, 'recalculate']);
        Route::post('/budget/reset', [BudgetController::class, 'reset']);
    });

    // Public inventory reads
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/inventory/search', [InventoryController::class, 'search']);
    Route::get('/inventory/{inventoryItem}', [InventoryController::class, 'show']);

    // Public request read
    Route::get('/requests', [ItemRequestsController::class, 'index']);
    Route::get('/requests/overdue', [ItemRequestsController::class, 'getOverdueItems']);
    Route::get('/requests/teacher-assigned', [ItemRequestsController::class, 'getTeacherAssignedItems']);
    Route::patch('/requests/{itemRequest}/return-status', [ItemRequestsController::class, 'updateReturnStatus']);
});


