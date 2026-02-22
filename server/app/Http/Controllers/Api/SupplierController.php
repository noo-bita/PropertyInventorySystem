<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class SupplierController extends Controller
{
    /**
     * Display a listing of suppliers with optional filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query();

        // Search by supplier name or company name
        if ($request->has('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('supplier_name', 'like', "%{$search}%")
                  ->orWhere('company_name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->query('status'));
        }

        // Get only active suppliers (for dropdowns)
        if ($request->has('active_only') && $request->query('active_only') === 'true') {
            $query->active();
        }

        // Sorting
        $sortBy = $request->query('sort_by', 'created_at');
        $sortOrder = $request->query('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->query('per_page', 15);
        $suppliers = $query->paginate($perPage);

        return response()->json($suppliers);
    }

    /**
     * Store a newly created supplier.
     */
    public function store(Request $request): JsonResponse
    {
        // Validate request
        $validated = $request->validate([
            'supplier_name' => 'required|string|max:255',
            'company_name' => 'nullable|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'contact_number' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'business_registration_number' => 'nullable|string|max:255|unique:suppliers,business_registration_number',
            'notes' => 'nullable|string',
            'status' => 'nullable|in:active,inactive',
            'type' => 'nullable|in:SUPPLIER,DONOR,supplier,donor',
        ]);

        // Check for duplicate supplier name
        $existingSupplier = Supplier::where('supplier_name', $validated['supplier_name'])->first();
        if ($existingSupplier) {
            return response()->json([
                'message' => 'A supplier with this name already exists.',
                'errors' => ['supplier_name' => ['A supplier with this name already exists.']]
            ], 422);
        }

        // Set default status
        $validated['status'] = $validated['status'] ?? 'active';
        // Normalize type to uppercase and set default
        if (isset($validated['type'])) {
            $validated['type'] = strtoupper($validated['type']);
        } else {
            $validated['type'] = 'SUPPLIER'; // Default to SUPPLIER
        }
        $validated['date_added'] = now()->toDateString();

        // Create supplier
        $supplier = Supplier::create($validated);

        // Log activity
        $user = Auth::user();
        ActivityLogService::log(
            'created',
            'Suppliers',
            "Supplier '{$supplier->supplier_name}' created",
            $user?->id,
            $user ? $user->first_name . ' ' . $user->last_name : null,
            $user?->role,
            $supplier->supplier_name,
            $supplier->id,
            null,
            $request
        );

        return response()->json($supplier, 201);
    }

    /**
     * Display the specified supplier.
     */
    public function show(Supplier $supplier): JsonResponse
    {
        return response()->json($supplier);
    }

    /**
     * Update the specified supplier.
     */
    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        try {
            // Validate request
            $validated = $request->validate([
                'supplier_name' => 'required|string|max:255',
                'company_name' => 'nullable|string|max:255',
                'contact_person' => 'nullable|string|max:255',
                'contact_number' => 'nullable|string|max:50',
                'email' => 'nullable|email|max:255',
                'address' => 'nullable|string',
                'business_registration_number' => 'nullable|string|max:255|unique:suppliers,business_registration_number,' . $supplier->id,
                'notes' => 'nullable|string',
                'status' => 'nullable|in:active,inactive',
                'type' => 'nullable|in:SUPPLIER,DONOR,supplier,donor',
            ]);

            // Normalize type to uppercase if provided
            if (isset($validated['type'])) {
                $validated['type'] = strtoupper($validated['type']);
            }

            // Check for duplicate supplier name (excluding current supplier)
            $existingSupplier = Supplier::where('supplier_name', $validated['supplier_name'])
                ->where('id', '!=', $supplier->id)
                ->first();
            if ($existingSupplier) {
                return response()->json([
                    'message' => 'A supplier with this name already exists.',
                    'errors' => ['supplier_name' => ['A supplier with this name already exists.']]
                ], 422);
            }

            // Update supplier
            $supplier->update($validated);

            // Log activity
            $user = Auth::user();
            ActivityLogService::log(
                'updated',
                'Suppliers',
                "Supplier '{$supplier->supplier_name}' updated",
                $user?->id,
                $user ? $user->first_name . ' ' . $user->last_name : null,
                $user?->role,
                $supplier->supplier_name,
                $supplier->id,
                null,
                $request
            );

            return response()->json($supplier);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error updating supplier: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Failed to update supplier',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove (hard delete) the specified supplier.
     */
    public function destroy(Request $request, Supplier $supplier): JsonResponse
    {
        $supplierName = $supplier->supplier_name;
        $supplierId = $supplier->id;

        // Hard delete (permanently remove)
        $supplier->forceDelete();

        // Log activity
        $user = Auth::user();
        ActivityLogService::log(
            'deleted',
            'Suppliers',
            "Supplier '{$supplierName}' deleted permanently",
            $user?->id,
            $user ? $user->first_name . ' ' . $user->last_name : null,
            $user?->role,
            $supplierName,
            $supplierId,
            null,
            $request
        );

        return response()->json(['message' => 'Supplier deleted successfully'], 200);
    }

    /**
     * Get active suppliers only (for dropdowns).
     */
    public function active(Request $request): JsonResponse
    {
        try {
            $query = Supplier::active()->orderBy('supplier_name', 'asc');

            // Check if type column exists in database schema
            $hasTypeColumn = Schema::hasColumn('suppliers', 'type');

            // Filter by type if provided and column exists
            if ($request->has('type') && $hasTypeColumn) {
                $type = strtoupper($request->query('type'));
                $query->where('type', $type);
            }

            // Get suppliers - only select type if column exists
            $columns = ['id', 'supplier_name', 'company_name'];
            if ($hasTypeColumn) {
                $columns[] = 'type';
            }
            $suppliers = $query->get($columns);

            // Ensure type field exists in response (default to 'SUPPLIER' if column doesn't exist)
            $suppliers = $suppliers->map(function ($supplier) use ($hasTypeColumn) {
                $supplierArray = $supplier->toArray();
                if (!$hasTypeColumn || !isset($supplierArray['type'])) {
                    $supplierArray['type'] = 'SUPPLIER';
                } else {
                    // Normalize type to uppercase
                    $supplierArray['type'] = strtoupper($supplierArray['type']);
                }
                return $supplierArray;
            });

            return response()->json($suppliers);
        } catch (\Exception $e) {
            Log::error('Error fetching active suppliers: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json(['error' => 'Failed to fetch suppliers: ' . $e->getMessage()], 500);
        }
    }
}
