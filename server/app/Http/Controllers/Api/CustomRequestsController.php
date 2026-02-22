<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomRequest;
use App\Models\InventoryItem;
use App\Models\SchoolBudget;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;


class CustomRequestsController extends Controller
{
    public function index(): JsonResponse
    {
        $customRequests = CustomRequest::orderByDesc('created_at')->get();
        return response()->json($customRequests);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'item_name' => 'required|string|max:255',
            'teacher_name' => 'required|string|max:255',
            'teacher_id' => 'nullable|integer',
            'quantity_requested' => 'required|integer|min:1',
            'estimated_cost' => 'nullable|numeric|min:0',
            'location' => 'required|string|max:255',
            'subject' => 'nullable|string|max:500',
            'description' => 'nullable|string', // Make description optional
            'notes' => 'nullable|string',
            'photo' => 'nullable|string|max:16777215', // Max for MEDIUMTEXT in MySQL
        ]);

        $data['status'] = 'pending';

        try {
            $customRequest = CustomRequest::create($data);
            return response()->json(['custom_request' => $customRequest], 201);
        } catch (\Exception $e) {
            Log::error('Error creating custom request: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to create custom request'], 500);
        }
    }

    public function show(CustomRequest $customRequest): JsonResponse
    {
        return response()->json($customRequest);
    }

    public function update(Request $request, CustomRequest $customRequest): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:pending,under_review,purchasing,approved,rejected',
            'admin_response' => 'nullable|string|max:1000'
        ]);

        $customRequest->update($data);
        return response()->json($customRequest);
    }

    public function destroy(CustomRequest $customRequest): JsonResponse
    {
        $customRequest->delete();
        return response()->json(['message' => 'Custom request deleted successfully']);
    }

    public function respondToCustomRequest(CustomRequest $customRequest, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:under_review,purchasing,approved,rejected',
            'admin_response' => 'nullable|string|max:1000'
        ]);

        $oldStatus = $customRequest->status;
        $customRequest->status = $data['status'];
        if (isset($data['admin_response'])) {
            $customRequest->admin_response = $data['admin_response'];
        }
        $customRequest->save();

        // Store request info before deletion for response
        $requestInfo = [
            'id' => $customRequest->id,
            'item_name' => $customRequest->item_name,
            'teacher_name' => $customRequest->teacher_name,
            'teacher_id' => $customRequest->teacher_id,
            'status' => $data['status'],
            'admin_response' => $data['admin_response'] ?? null
        ];

        // If status is "purchasing", notify teacher and keep in list (don't mark as completed)
        if ($data['status'] === 'purchasing') {
            // Log activity
            ActivityLogService::log(
                'updated',
                'Custom Request',
                "Custom request #{$customRequest->id} marked as being processed/purchased. Teacher has been notified.",
                $request->attributes->get('auth_user')->id ?? null,
                $request->attributes->get('auth_user')->first_name . ' ' . $request->attributes->get('auth_user')->last_name ?? 'Admin User',
                $request->attributes->get('auth_user')->role ?? 'ADMIN',
                $customRequest->item_name,
                $customRequest->id,
                null,
                $request
            );

            // Return without marking as completed (keeps in active list)
            return response()->json([
                'message' => 'Request marked as being processed/purchased. Teacher has been notified.',
                'completed' => false,
                'request' => $customRequest
            ]);
        }

        // If status is "approved" (Purchased), automatically create inventory item(s)
        if ($data['status'] === 'approved') {
            try {
                $quantity = $customRequest->quantity_requested;
                $createdItems = [];
                
                // Handle photo if exists
                $photoPath = null;
                if ($customRequest->photo) {
                    // If photo is base64, save it; otherwise use as-is
                    if (str_starts_with($customRequest->photo, 'data:image')) {
                        // Extract base64 data
                        $imageData = explode(',', $customRequest->photo);
                        if (count($imageData) > 1) {
                            $imageData = base64_decode($imageData[1]);
                            $photoName = 'custom_request_' . $customRequest->id . '_' . time() . '.jpg';
                            $photoPath = 'uploads/' . $photoName;
                            $fullPath = public_path($photoPath);
                            
                            // Create uploads directory if it doesn't exist
                            if (!file_exists(public_path('uploads'))) {
                                mkdir(public_path('uploads'), 0755, true);
                            }
                            
                            file_put_contents($fullPath, $imageData);
                        }
                    } else {
                        $photoPath = $customRequest->photo;
                    }
                }

                // Create inventory items (one per quantity if quantity > 1)
                for ($i = 0; $i < $quantity; $i++) {
                    $itemData = [
                        'name' => $customRequest->item_name,
                        'category' => 'Other', // Default category, admin can edit later
                        'quantity' => 1, // Each item has quantity 1
                        'available' => 1, // Each item is available
                        'location' => $customRequest->location,
                        'description' => $customRequest->description ?? 'Purchased from custom request #' . $customRequest->id,
                        'purchase_date' => now()->toDateString(),
                        'purchase_price' => 0, // Default to 0, admin can edit later
                        'purchase_type' => 'purchased',
                        'supplier' => 'To be determined', // Default, admin can edit later
                        'added_by' => $request->attributes->get('auth_user')->first_name . ' ' . $request->attributes->get('auth_user')->last_name ?? 'Admin User',
                        'status' => 'Available',
                        'photo' => $photoPath,
                        'last_updated' => now()->toDateString()
                    ];

                    // Generate serial number
                    $timestamp = now()->format('YmdHis');
                    $itemData['serial_number'] = 'SN-CR' . $customRequest->id . '-' . $timestamp . '-' . str_pad($i + 1, 4, '0', STR_PAD_LEFT);

                    $inventoryItem = InventoryItem::create($itemData);
                    $createdItems[] = $inventoryItem;

                    // Log activity for each item
                    ActivityLogService::logInventory(
                        'created',
                        "Item created from custom request #{$customRequest->id}: {$inventoryItem->name} (Serial: {$inventoryItem->serial_number}) - Admin can edit to add purchase details",
                        $inventoryItem->id,
                        $request
                    );
                }

                // Log summary activity
                ActivityLogService::log(
                    'created',
                    'Inventory',
                    "Custom request #{$customRequest->id} marked as Purchased - {$quantity} item(s) automatically added to inventory (Admin can edit to add purchase details)",
                    $request->attributes->get('auth_user')->id ?? null,
                    $request->attributes->get('auth_user')->first_name . ' ' . $request->attributes->get('auth_user')->last_name ?? 'Admin User',
                    $request->attributes->get('auth_user')->role ?? 'ADMIN',
                    $customRequest->item_name,
                    $customRequest->id,
                    ['created_items_count' => count($createdItems), 'item_ids' => array_map(fn($item) => $item->id, $createdItems)],
                    $request
                );

                // Add created items info to response
                $customRequest->created_inventory_items = $createdItems;
            } catch (\Exception $e) {
                Log::error('Error creating inventory items from custom request: ' . $e->getMessage());
                // Don't fail the request, but log the error
                // The status update still succeeds, admin can manually add items if needed
            }
        }

        // If status is "approved" (Purchased) or "rejected", mark as completed (not deleted, but filtered out)
        // This allows notifications to work while keeping the request out of active list
        if ($data['status'] === 'approved' || $data['status'] === 'rejected') {
            // Log activity
            $actionType = $data['status'] === 'approved' ? 'approved' : 'rejected';
            $message = $data['status'] === 'approved' 
                ? "Custom request #{$customRequest->id} approved and marked as purchased. Request removed from active list."
                : "Custom request #{$customRequest->id} rejected. Request removed from active list.";
            
            ActivityLogService::log(
                $actionType,
                'Custom Request',
                $message,
                $request->attributes->get('auth_user')->id ?? null,
                $request->attributes->get('auth_user')->first_name . ' ' . $request->attributes->get('auth_user')->last_name ?? 'Admin User',
                $request->attributes->get('auth_user')->role ?? 'ADMIN',
                $customRequest->item_name,
                $customRequest->id,
                null,
                $request
            );

            // Mark as completed (status already set above, this is just for clarity)
            // The request will be filtered out from active list in the frontend
            // Return the request info with completed flag
            return response()->json([
                'message' => $data['status'] === 'approved' 
                    ? 'Request approved and removed from active list' 
                    : 'Request rejected and removed from active list',
                'completed' => true,
                'request' => $customRequest
            ]);
        }

        return response()->json($customRequest);
    }

    public function updatePurchasingRequest(CustomRequest $customRequest, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:approved,rejected',
            'admin_response' => 'nullable|string|max:1000',
            'item_id' => 'nullable|integer|exists:inventory_items,id',
            'quantity_assigned' => 'nullable|integer|min:1',
            'due_date' => 'nullable|date'
        ]);

        $customRequest->status = $data['status'];
        if (isset($data['admin_response'])) {
            $customRequest->admin_response = $data['admin_response'];
        }
        $customRequest->save();

        // If approved and item_id is provided, create an assigned item record
        if ($data['status'] === 'approved' && isset($data['item_id'])) {
            // Create a new item request record for the assigned item
            $itemRequest = \App\Models\ItemRequest::create([
                'item_id' => $data['item_id'],
                'item_name' => $customRequest->item_name,
                'teacher_name' => $customRequest->teacher_name,
                'teacher_id' => $customRequest->teacher_id,
                'quantity_requested' => $customRequest->quantity_requested,
                'quantity_assigned' => $data['quantity_assigned'] ?? $customRequest->quantity_requested,
                'location' => $customRequest->location,
                'subject' => $customRequest->subject,
                'notes' => 'Assigned from custom request #' . $customRequest->id,
                'status' => 'assigned',
                'due_date' => $data['due_date'] ?? now()->addDays(30),
                'assigned_at' => now(),
                'request_type' => 'item'
            ]);

            // Update inventory availability
            $inventoryItem = \App\Models\InventoryItem::find($data['item_id']);
            if ($inventoryItem) {
                $inventoryItem->available -= ($data['quantity_assigned'] ?? $customRequest->quantity_requested);
                $inventoryItem->save();
            }
        }

        return response()->json($customRequest);
    }
}
