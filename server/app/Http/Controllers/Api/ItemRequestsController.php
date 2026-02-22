<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\ItemRequest;
use App\Models\InventoryItem;

class ItemRequestsController extends Controller
{
    public function index(): JsonResponse
    {
        $requests = ItemRequest::orderByDesc('created_at')->get();
        return response()->json($requests);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'item_id' => 'nullable|integer',
            'item_name' => 'required|string|max:255',
            'teacher_name' => 'required|string|max:255',
            'teacher_id' => 'nullable|integer',
            'quantity_requested' => 'required|integer|min:1',
            'location' => 'required|string|max:255',
            'subject' => 'nullable|string|max:500',
            'due_date' => 'nullable|date',
            'notes' => 'nullable|string',
            'request_type' => 'nullable|string|in:item,maintenance,custom,report',
            'description' => 'nullable|string',
            'photo' => 'nullable|string'
        ]);

        // Convert null item_id to null explicitly
        if (isset($data['item_id']) && $data['item_id'] === '') {
            $data['item_id'] = null;
        }

        // Handle custom requests (no item_id)
        if ($data['request_type'] === 'custom' || !$data['item_id']) {
            $data['status'] = 'pending';
            $data['quantity_assigned'] = 0;
            $data['item_id'] = null; // Custom requests don't have item_id

            $itemRequest = ItemRequest::create($data);
            
            // Log activity
            ActivityLogService::logRequest(
                'created',
                "Request created: {$data['item_name']} by {$data['teacher_name']}",
                $itemRequest->id,
                $request
            );
            
            return response()->json(['request' => $itemRequest], 201);
        }

        // Handle regular inventory requests - validate item_id exists
        if (!InventoryItem::where('id', $data['item_id'])->exists()) {
            return response()->json(['message' => 'Item not found in inventory'], 422);
        }

        $inventoryItem = InventoryItem::findOrFail($data['item_id']);
        
        // For grouped items (same name), check total available across all items with the same name
        // This allows requesting from multiple items of the same name
        $totalAvailable = InventoryItem::where('name', $inventoryItem->name)
            ->where('status', '!=', 'Damaged')
            ->where('status', '!=', 'Under Maintenance')
            ->sum('available');
        
        if ($totalAvailable < $data['quantity_requested']) {
            return response()->json(['message' => 'Not enough available quantity'], 422);
        }

        // Automatically reserve items when request is created
        // Reserve from multiple items if needed (best condition first - sort by status and condition)
        $quantityToReserve = $data['quantity_requested'];
        $itemsToReserve = InventoryItem::where('name', $inventoryItem->name)
            ->where('status', '!=', 'Damaged')
            ->where('status', '!=', 'Under Maintenance')
            ->where('available', '>', 0)
            ->orderByRaw("CASE WHEN status = 'Available' THEN 1 WHEN status = 'Low Stock' THEN 2 ELSE 3 END")
            ->orderBy('available', 'desc') // Best condition items first (more available = better condition)
            ->get();
        
        foreach ($itemsToReserve as $item) {
            if ($quantityToReserve <= 0) break;
            
            $reserveFromThisItem = min($item->available, $quantityToReserve);
            $item->available -= $reserveFromThisItem;
            $item->save();
            $quantityToReserve -= $reserveFromThisItem;
        }

        $data['status'] = 'pending';
        $data['quantity_assigned'] = 0;

        $itemRequest = ItemRequest::create($data);
        
        // Log activity
        ActivityLogService::logRequest(
            'created',
            "Request created: {$data['item_name']} by {$data['teacher_name']} (Items automatically reserved)",
            $itemRequest->id,
            $request
        );
        
        return response()->json(['request' => $itemRequest, 'item' => $inventoryItem], 201);
    }

    public function assign(Request $request, ItemRequest $itemRequest): JsonResponse
    {
        $data = $request->validate([
            'quantity' => 'required|integer|min:1',
            'due_date' => 'nullable|date'
        ]);

        $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);

        $assignedQuantity = max($itemRequest->quantity_assigned, (int)$data['quantity']);
        
        // Items are already reserved when request was created
        // If assigning different quantity, adjust the reservation
        $reservedQuantity = $itemRequest->quantity_requested;
        $quantityDifference = $assignedQuantity - $reservedQuantity;
        
        // If assigned quantity is less than requested, return the difference
        if ($quantityDifference < 0) {
            $inventoryItem->available += abs($quantityDifference);
            $inventoryItem->save();
        }
        // If assigned quantity is more than requested, check if we have enough available
        elseif ($quantityDifference > 0) {
            if ($inventoryItem->available < $quantityDifference) {
                return response()->json([
                    'message' => 'Not enough available quantity. Available: ' . $inventoryItem->available . ', Additional needed: ' . $quantityDifference
                ], 422);
            }
            // Reserve the additional quantity
            $inventoryItem->available -= $quantityDifference;
            $inventoryItem->save();
        }
        // If quantities match, items are already reserved, no change needed

        // Update request
        $itemRequest->quantity_assigned = $assignedQuantity;
        $itemRequest->due_date = $data['due_date'] ?? $itemRequest->due_date;
        $itemRequest->status = 'assigned';
        $itemRequest->save();

        // Log activity
        ActivityLogService::logRequest(
            'assigned',
            "Request assigned: {$itemRequest->item_name} to {$itemRequest->teacher_name}",
            $itemRequest->id,
            $request
        );

        return response()->json(['request' => $itemRequest, 'item' => $inventoryItem]);
    }

    public function markReturned(ItemRequest $itemRequest): JsonResponse
    {
        $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);
        // Increase availability back by assigned quantity
        $inventoryItem->available += $itemRequest->quantity_assigned;
        $inventoryItem->save();

        $itemRequest->status = 'returned';
        $itemRequest->returned_at = now();
        $itemRequest->save();

        return response()->json(['request' => $itemRequest, 'item' => $inventoryItem]);
    }

    public function approveAndAssign(Request $request, ItemRequest $itemRequest): JsonResponse
    {
        try {
            \Log::info('Approval request received', [
                'request_id' => $itemRequest->id,
                'request_data' => $request->all()
            ]);

            $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);
            
            // Check if item is consumable - due date is optional for consumable items
            $isConsumable = $inventoryItem->consumable ?? false;
            
            $data = $request->validate([
                'due_date' => $isConsumable ? 'nullable|date' : 'required|date|after_or_equal:today',
                'quantity' => 'nullable|integer|min:1'
            ]);

            \Log::info('Validation passed', ['validated_data' => $data, 'is_consumable' => $isConsumable]);

            // Set assigned quantity (default to requested if not provided)
            $assignedQuantity = $data['quantity'] ?? $itemRequest->quantity_requested;

            \Log::info('Assignment details', [
                'assigned_quantity' => $assignedQuantity,
                'due_date' => $data['due_date'] ?? null,
                'is_consumable' => $isConsumable
            ]);

            // If item is consumable, delete it from inventory when approved
            if ($isConsumable) {
                // Delete the inventory item (or reduce quantity if partial)
                if ($assignedQuantity >= $inventoryItem->quantity) {
                    // Delete entire item
                    $inventoryItem->delete();
                } else {
                    // Reduce quantity
                    $inventoryItem->quantity -= $assignedQuantity;
                    $inventoryItem->available = max(0, $inventoryItem->available - $assignedQuantity);
                    $inventoryItem->save();
                }
            } else {
                // Items are already reserved when request was created
                // If admin assigns different quantity, adjust the reservation
                $reservedQuantity = $itemRequest->quantity_requested;
                $quantityDifference = $assignedQuantity - $reservedQuantity;
                
                // If assigned quantity is less than requested, return the difference
                if ($quantityDifference < 0) {
                    $inventoryItem->available += abs($quantityDifference);
                    $inventoryItem->save();
                }
                // If assigned quantity is more than requested, check if we have enough available
                elseif ($quantityDifference > 0) {
                    if ($inventoryItem->available < $quantityDifference) {
                        return response()->json([
                            'message' => 'Not enough available quantity. Available: ' . $inventoryItem->available . ', Additional needed: ' . $quantityDifference
                        ], 422);
                    }
                    // Reserve the additional quantity
                    $inventoryItem->available -= $quantityDifference;
                    $inventoryItem->save();
                }
                // If quantities match, items are already reserved, no change needed
            }

            // Update request status and details
            $itemRequest->status = 'assigned';
            $itemRequest->quantity_assigned = $assignedQuantity;
            $itemRequest->due_date = $data['due_date'] ?? null; // Null for consumable items
            $itemRequest->assigned_at = now();
            $itemRequest->save();

            \Log::info('Request updated successfully', ['request_id' => $itemRequest->id]);

            // Log activity
            ActivityLogService::logRequest(
                'approved',
                "Request approved and assigned: {$itemRequest->item_name} to {$itemRequest->teacher_name}",
                $itemRequest->id,
                $request
            );

            return response()->json(['request' => $itemRequest, 'item' => $inventoryItem]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Validation error in approveAndAssign', [
                'errors' => $e->errors(),
                'request_data' => $request->all()
            ]);
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Log::error('Error in approveAndAssign', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Server error: ' . $e->getMessage()], 500);
        }
    }

    public function updateReturnStatus(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        $data = $request->validate([
            'return_status' => 'required|in:returned,not_returned,overdue'
        ]);

        $itemRequest->return_status = $data['return_status'];

        // If marking as returned, also update the main status and timestamp
        if ($data['return_status'] === 'returned') {
            $itemRequest->status = 'returned';
            $itemRequest->returned_at = now();

            // Restore availability
            $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);
            $inventoryItem->available += $itemRequest->quantity_assigned;
            $inventoryItem->save();
        }

        $itemRequest->save();
        return response()->json($itemRequest);
    }

    public function teacherReturnItem(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        try {
            // Check if item is assigned to the teacher
            if ($itemRequest->status !== 'assigned') {
                return response()->json(['message' => 'Item is not currently assigned'], 400);
            }

            // Validate and get optional return data
            $data = $request->validate([
                'is_damaged' => 'nullable|boolean',
                'notes' => 'nullable|string|max:1000'
            ]);

            // Set status to "returned_pending_inspection" - DO NOT restore availability automatically
            $itemRequest->return_status = 'returned';
            $itemRequest->status = 'returned_pending_inspection';
            $itemRequest->returned_at = now();
            $itemRequest->inspection_status = 'pending';
            
            // Store return notes if provided
            if (isset($data['notes']) && !empty($data['notes'])) {
                $itemRequest->notes = $data['notes'];
            }
            
            // If item is marked as damaged, set initial inspection status
            if (isset($data['is_damaged']) && $data['is_damaged']) {
                // Store damage information in notes if not already provided
                if (empty($itemRequest->notes)) {
                    $itemRequest->notes = 'Item reported as damaged by teacher.';
                } else {
                    $itemRequest->notes = '[DAMAGED] ' . $itemRequest->notes;
                }
            }
            
            $itemRequest->save();

            // Build log message
            $logMessage = "Item returned by teacher - pending inspection: {$itemRequest->item_name} by {$itemRequest->teacher_name}";
            if (isset($data['is_damaged']) && $data['is_damaged']) {
                $logMessage .= ' (Reported as damaged)';
            }

            // Log activity
            ActivityLogService::logRequest(
                'returned',
                $logMessage,
                $itemRequest->id,
                $request
            );

            \Log::info('Teacher returned item - pending inspection', [
                'request_id' => $itemRequest->id,
                'teacher' => $itemRequest->teacher_name,
                'item' => $itemRequest->item_name,
                'quantity' => $itemRequest->quantity_assigned ?: $itemRequest->quantity_requested,
                'is_damaged' => $data['is_damaged'] ?? false,
                'has_notes' => !empty($data['notes'])
            ]);

            return response()->json([
                'message' => 'Item returned successfully. Awaiting inspection by Admin/Custodian.',
                'request' => $itemRequest
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error in teacherReturnItem', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $itemRequest->id
            ]);
            return response()->json(['message' => 'Error returning item: ' . $e->getMessage()], 500);
        }
    }

    public function getOverdueItems(): JsonResponse
    {
        $overdueItems = ItemRequest::where('status', 'assigned')
            ->where('due_date', '<', now())
            ->where('return_status', '!=', 'returned')
            ->get();

        return response()->json($overdueItems);
    }

    public function getTeacherAssignedItems(Request $request): JsonResponse
    {
        $teacherName = $request->query('teacher_name');

        if (!$teacherName) {
            return response()->json(['message' => 'Teacher name is required'], 400);
        }

        $assignedItems = ItemRequest::where('teacher_name', $teacherName)
            ->where('status', 'assigned')
            ->where(function($query) {
                $query->whereNull('return_status')
                      ->orWhere('return_status', '!=', 'returned');
            })
            ->select('item_id', 'item_name', 'quantity_assigned as assigned')
            ->get()
            ->groupBy('item_id')
            ->map(function ($group) {
                $first = $group->first();
                return [
                    'id' => (string)$first->item_id,
                    'name' => $first->item_name,
                    'assigned' => $group->sum('assigned')
                ];
            })
            ->values();

        return response()->json($assignedItems);
    }

    public function updateStatus(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:pending,approved,assigned,returned,overdue,rejected,under_review,purchasing'
        ]);
        
        $oldStatus = $itemRequest->status;
        $itemRequest->status = $data['status'];
        
        // If request is rejected and it has an item_id, return reserved items back to inventory
        if ($data['status'] === 'rejected' && $itemRequest->item_id && $oldStatus === 'pending') {
            $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);
            // Return the reserved quantity back to available
            $inventoryItem->available += $itemRequest->quantity_requested;
            $inventoryItem->save();
            
            // Log activity
            ActivityLogService::logRequest(
                'rejected',
                "Request rejected: {$itemRequest->item_name} by {$itemRequest->teacher_name} (Reserved items returned to inventory)",
                $itemRequest->id,
                $request
            );
        }
        
        $itemRequest->save();
        return response()->json($itemRequest);
    }

    public function respondToCustomRequest(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:under_review,purchasing,approved,rejected',
            'admin_response' => 'nullable|string|max:1000'
        ]);

        $itemRequest->status = $data['status'];
        if (isset($data['admin_response'])) {
            $itemRequest->admin_response = $data['admin_response'];
        }
        $itemRequest->save();

        return response()->json($itemRequest);
    }

    public function destroy(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        $itemName = $itemRequest->item_name;
        $requestId = $itemRequest->id;
        
        // If request is pending and has an item_id, return reserved items back to inventory
        if ($itemRequest->status === 'pending' && $itemRequest->item_id) {
            $inventoryItem = InventoryItem::find($itemRequest->item_id);
            if ($inventoryItem) {
                // Return the reserved quantity back to available
                $inventoryItem->available += $itemRequest->quantity_requested;
                $inventoryItem->save();
            }
        }
        
        $itemRequest->delete();
        
        // Log activity
        ActivityLogService::logRequest(
            'deleted',
            "Request deleted: {$itemName}",
            $requestId,
            $request
        );
        
        return response()->json(null, 204);
    }

    /**
     * Get all returned items pending inspection
     */
    public function getPendingInspectionItems(): JsonResponse
    {
        $items = ItemRequest::where('status', 'returned_pending_inspection')
            ->where('inspection_status', 'pending')
            ->orderBy('returned_at', 'asc')
            ->get();
        
        return response()->json($items);
    }

    /**
     * Accept return - item is in good condition
     */
    public function acceptReturn(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'admin_response' => 'nullable|string|max:1000'
            ]);

            $user = $request->attributes->get('auth_user');
            if (!$user) {
                $auth = $request->header('Authorization');
                if ($auth && str_starts_with($auth, 'Bearer ')) {
                    $token = substr($auth, 7);
                    $user = \App\Models\User::where('api_token', $token)->first();
                }
            }

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            if ($itemRequest->status !== 'returned_pending_inspection') {
                return response()->json(['message' => 'Item is not pending inspection'], 400);
            }

            // Update inspection status
            $itemRequest->inspection_status = 'accepted';
            $itemRequest->inspected_by = $user->id;
            $itemRequest->inspected_at = now();
            $itemRequest->status = 'returned';
            if (isset($data['admin_response']) && !empty($data['admin_response'])) {
                $itemRequest->notes = ($itemRequest->notes ? $itemRequest->notes . "\n\n" : '') . 'Admin Response: ' . $data['admin_response'];
            }
            $itemRequest->save();

            // Check if item was reported as damaged by teacher
            $isDamaged = str_contains($itemRequest->notes ?? '', '[DAMAGED]') || 
                        ($itemRequest->inspection_status === 'damaged');

            // Return item to admin inventory
            if ($itemRequest->item_id) {
                $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);
                $quantityToRestore = $itemRequest->quantity_assigned ?: $itemRequest->quantity_requested ?: 0;
                
                if ($quantityToRestore > 0) {
                    $inventoryItem->available += $quantityToRestore;
                    
                    // Set status based on damage
                    if ($isDamaged) {
                        // Item is damaged - mark as Damaged in inventory
                        $inventoryItem->status = 'Damaged';
                    } else {
                        // Item has no damage - mark as Available
                        $inventoryItem->status = 'Available';
                    }
                    $inventoryItem->save();
                }
            }

            // Log activity
            $logMessage = $isDamaged
                ? "Return approved (damaged): {$itemRequest->item_name} returned by {$itemRequest->teacher_name}. Item restored to admin inventory with Damaged status. Inspected by {$user->first_name} {$user->last_name}"
                : "Return approved (no damage): {$itemRequest->item_name} returned by {$itemRequest->teacher_name}. Item restored to admin inventory with Available status. Inspected by {$user->first_name} {$user->last_name}";

            ActivityLogService::logRequest(
                'inspected',
                $logMessage,
                $itemRequest->id,
                $request
            );

            $message = $isDamaged
                ? 'Return approved. Item restored to admin inventory with Damaged status (not requestable).'
                : 'Return approved. Item restored to admin inventory with Available status (requestable).';

            return response()->json([
                'message' => $message,
                'request' => $itemRequest,
                'is_damaged' => $isDamaged
            ]);
        } catch (\Exception $e) {
            \Log::error('Error accepting return', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $itemRequest->id
            ]);
            return response()->json(['message' => 'Error accepting return: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Reject return - notify teacher
     */
    public function rejectReturn(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'admin_response' => 'nullable|string|max:1000'
            ]);

            $user = $request->attributes->get('auth_user');
            if (!$user) {
                $auth = $request->header('Authorization');
                if ($auth && str_starts_with($auth, 'Bearer ')) {
                    $token = substr($auth, 7);
                    $user = \App\Models\User::where('api_token', $token)->first();
                }
            }

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            if ($itemRequest->status !== 'returned_pending_inspection') {
                return response()->json(['message' => 'Item is not pending inspection'], 400);
            }

            // Return item to teacher's assigned items with Damaged status
            // DO NOT return to admin inventory - keep it assigned to teacher
            $itemRequest->inspection_status = 'damaged';
            $itemRequest->inspected_by = $user->id;
            $itemRequest->inspected_at = now();
            // Keep status as 'assigned' so teacher sees it in their inventory
            $itemRequest->status = 'assigned';
            
            // Add mandatory note about office visit
            $officeNote = 'Please proceed to the office for further details regarding this damaged item.';
            $adminNote = isset($data['admin_response']) && !empty($data['admin_response']) 
                ? "\n\nAdmin Response: " . $data['admin_response']
                : '';
            $itemRequest->notes = ($itemRequest->notes ? $itemRequest->notes . "\n\n" : '') . 
                'Admin Response (Rejected): ' . $officeNote . $adminNote;
            $itemRequest->save();

            // DO NOT update inventory item - item stays assigned to teacher

            // Log activity
            ActivityLogService::logRequest(
                'inspected',
                "Return rejected: {$itemRequest->item_name} returned by {$itemRequest->teacher_name}. Item remains assigned to teacher with Damaged status. Inspected by {$user->first_name} {$user->last_name}",
                $itemRequest->id,
                $request
            );

            return response()->json([
                'message' => 'Return rejected. Item remains assigned to teacher with Damaged status and office visit note.',
                'request' => $itemRequest
            ]);
        } catch (\Exception $e) {
            \Log::error('Error rejecting return', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $itemRequest->id
            ]);
            return response()->json(['message' => 'Error rejecting return: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Mark item as damaged - automatically sends to inventory with Under Maintenance status
     */
    public function markAsDamaged(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'damage_remarks' => 'required|string|max:1000',
                'damage_photo' => 'nullable|string', // Base64 encoded image
                'admin_response' => 'nullable|string|max:1000'
            ]);

            $user = $request->attributes->get('auth_user');
            if (!$user) {
                $auth = $request->header('Authorization');
                if ($auth && str_starts_with($auth, 'Bearer ')) {
                    $token = substr($auth, 7);
                    $user = \App\Models\User::where('api_token', $token)->first();
                }
            }

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            if ($itemRequest->status !== 'returned_pending_inspection') {
                return response()->json(['message' => 'Item is not pending inspection'], 400);
            }

            // Update inspection status
            $itemRequest->inspection_status = 'under_maintenance';
            $itemRequest->inspected_by = $user->id;
            $itemRequest->inspected_at = now();
            $itemRequest->damage_remarks = $data['damage_remarks'];
            if (isset($data['admin_response']) && !empty($data['admin_response'])) {
                $itemRequest->notes = ($itemRequest->notes ? $itemRequest->notes . "\n\n" : '') . 'Admin Response: ' . $data['admin_response'];
            }
            if (isset($data['damage_photo'])) {
                $itemRequest->damage_photo = $data['damage_photo'];
            }
            $itemRequest->status = 'returned';
            $itemRequest->save();

            // Automatically restore item to inventory with "Under Maintenance" status
            if ($itemRequest->item_id) {
                $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);
                $quantityToRestore = $itemRequest->quantity_assigned ?: $itemRequest->quantity_requested ?: 0;
                
                if ($quantityToRestore > 0) {
                    $inventoryItem->available += $quantityToRestore;
                    // Mark item as under maintenance
                    $inventoryItem->status = 'Under Maintenance';
                    $inventoryItem->save();
                }
            }

            // Log activity
            ActivityLogService::logRequest(
                'inspected',
                "Return marked as damaged and sent for maintenance: {$itemRequest->item_name} returned by {$itemRequest->teacher_name}. Inspected by {$user->first_name} {$user->last_name}. Remarks: {$data['damage_remarks']}. Item restored to inventory with Under Maintenance status.",
                $itemRequest->id,
                $request
            );

            return response()->json([
                'message' => 'Item marked as damaged and sent for maintenance. Item restored to inventory with Under Maintenance status.',
                'request' => $itemRequest
            ]);
        } catch (\Exception $e) {
            \Log::error('Error marking item as damaged', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $itemRequest->id
            ]);
            return response()->json(['message' => 'Error marking item as damaged: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Send item for maintenance - restore to inventory with under_maintenance status
     */
    public function sendForMaintenance(ItemRequest $itemRequest, Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'damage_remarks' => 'nullable|string|max:1000',
                'damage_photo' => 'nullable|string',
                'admin_response' => 'nullable|string|max:1000'
            ]);

            $user = $request->attributes->get('auth_user');
            if (!$user) {
                $auth = $request->header('Authorization');
                if ($auth && str_starts_with($auth, 'Bearer ')) {
                    $token = substr($auth, 7);
                    $user = \App\Models\User::where('api_token', $token)->first();
                }
            }

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            if ($itemRequest->status !== 'returned_pending_inspection') {
                return response()->json(['message' => 'Item is not pending inspection'], 400);
            }

            // Update inspection status
            $itemRequest->inspection_status = 'under_maintenance';
            $itemRequest->inspected_by = $user->id;
            $itemRequest->inspected_at = now();
            $itemRequest->status = 'returned';
            if (isset($data['damage_remarks']) && !empty($data['damage_remarks'])) {
                $itemRequest->damage_remarks = $data['damage_remarks'];
            }
            if (isset($data['damage_photo'])) {
                $itemRequest->damage_photo = $data['damage_photo'];
            }
            if (isset($data['admin_response']) && !empty($data['admin_response'])) {
                $itemRequest->notes = ($itemRequest->notes ? $itemRequest->notes . "\n\n" : '') . 'Admin Response: ' . $data['admin_response'];
            }
            $itemRequest->save();

            // Restore item to inventory with "Under Maintenance" status
            if ($itemRequest->item_id) {
                $inventoryItem = InventoryItem::findOrFail($itemRequest->item_id);
                $quantityToRestore = $itemRequest->quantity_assigned ?: $itemRequest->quantity_requested ?: 0;
                
                if ($quantityToRestore > 0) {
                    $inventoryItem->available += $quantityToRestore;
                    // Mark item as under maintenance
                    $inventoryItem->status = 'Under Maintenance';
                    $inventoryItem->save();
                }
            }

            // Log activity
            ActivityLogService::logRequest(
                'inspected',
                "Return sent for maintenance: {$itemRequest->item_name} returned by {$itemRequest->teacher_name}. Inspected by {$user->first_name} {$user->last_name}. Item restored to inventory with Under Maintenance status.",
                $itemRequest->id,
                $request
            );

            return response()->json([
                'message' => 'Item sent for maintenance. Item restored to inventory with Under Maintenance status.',
                'request' => $itemRequest
            ]);
        } catch (\Exception $e) {
            \Log::error('Error sending item for maintenance', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $itemRequest->id
            ]);
            return response()->json(['message' => 'Error sending item for maintenance: ' . $e->getMessage()], 500);
        }
    }
}




