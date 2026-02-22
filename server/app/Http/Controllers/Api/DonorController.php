<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Donor;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class DonorController extends Controller
{
    /**
     * Display a listing of donors with optional filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Donor::query();

        // Search by donor name or company name
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

        // Sorting
        $sortBy = $request->query('sort_by', 'created_at');
        $sortOrder = $request->query('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->query('per_page', 15);
        $donors = $query->paginate($perPage);

        return response()->json($donors);
    }

    /**
     * Store a newly created donor.
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
            'notes' => 'nullable|string',
            'status' => 'nullable|in:active,inactive',
        ]);

        // Check for duplicate donor name
        $existingDonor = Donor::where('supplier_name', $validated['supplier_name'])->first();
        if ($existingDonor) {
            return response()->json([
                'message' => 'A donor with this name already exists.',
                'errors' => ['supplier_name' => ['A donor with this name already exists.']]
            ], 422);
        }

        // Set default status
        $validated['status'] = $validated['status'] ?? 'active';
        $validated['date_added'] = now()->toDateString();

        // Create donor
        $donor = Donor::create($validated);

        // Log activity
        $user = Auth::user();
        ActivityLogService::log(
            'created',
            'Donors',
            "Donor '{$donor->supplier_name}' created",
            $user?->id,
            $user ? $user->first_name . ' ' . $user->last_name : null,
            $user?->role,
            $donor->supplier_name,
            $donor->id,
            null,
            $request
        );

        return response()->json($donor, 201);
    }

    /**
     * Display the specified donor.
     */
    public function show(Donor $donor): JsonResponse
    {
        return response()->json($donor);
    }

    /**
     * Update the specified donor.
     */
    public function update(Request $request, Donor $donor): JsonResponse
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
                'notes' => 'nullable|string',
                'status' => 'nullable|in:active,inactive',
            ]);

            // Check for duplicate donor name (excluding current donor)
            $existingDonor = Donor::where('supplier_name', $validated['supplier_name'])
                ->where('id', '!=', $donor->id)
                ->first();
            if ($existingDonor) {
                return response()->json([
                    'message' => 'A donor with this name already exists.',
                    'errors' => ['supplier_name' => ['A donor with this name already exists.']]
                ], 422);
            }

            // Update donor
            $donor->update($validated);

            // Log activity
            $user = Auth::user();
            ActivityLogService::log(
                'updated',
                'Donors',
                "Donor '{$donor->supplier_name}' updated",
                $user?->id,
                $user ? $user->first_name . ' ' . $user->last_name : null,
                $user?->role,
                $donor->supplier_name,
                $donor->id,
                null,
                $request
            );

            return response()->json($donor);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error updating donor: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Failed to update donor',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove (hard delete) the specified donor.
     */
    public function destroy(Request $request, Donor $donor): JsonResponse
    {
        $donorName = $donor->supplier_name;
        $donorId = $donor->id;

        // Hard delete (permanently remove)
        $donor->forceDelete();

        // Log activity
        $user = Auth::user();
        ActivityLogService::log(
            'deleted',
            'Donors',
            "Donor '{$donorName}' deleted permanently",
            $user?->id,
            $user ? $user->first_name . ' ' . $user->last_name : null,
            $user?->role,
            $donorName,
            $donorId,
            null,
            $request
        );

        return response()->json(['message' => 'Donor deleted successfully'], 200);
    }

    /**
     * Get active donors only (for dropdowns).
     */
    public function active(Request $request): JsonResponse
    {
        try {
            $donors = Donor::active()->orderBy('supplier_name', 'asc')
                ->get(['id', 'supplier_name', 'company_name']);

            return response()->json($donors);
        } catch (\Exception $e) {
            Log::error('Error fetching active donors: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch donors'], 500);
        }
    }
}

