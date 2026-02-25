<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Supplier;
use App\Models\Donor;
use App\Models\SchoolBudget;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class InventoryController extends Controller
{
    /**
     * Display a listing of inventory items.
     */
    public function index(): JsonResponse
    {
        $items = InventoryItem::all();

        // Remove serial_number from consumable items
        $items = $items->map(function ($item) {
            $isConsumable = $item->consumable === true || $item->consumable === 1 || $item->consumable === '1' || $item->consumable === 'true';
            if ($isConsumable) {
                $item->serial_number = null;
            }
            return $item;
        });

        return response()->json($items);
    }

    /**
     * Store a newly created inventory item.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'secondary_category' => 'nullable|string|max:255|different:category',
            'quantity' => 'required|integer|min:1',
            'available' => 'required|integer|min:0',
            'location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'serial_number' => 'nullable|string|max:255', // Legacy support
            'serial_numbers' => 'nullable|array', // New: array of serial numbers
            'serial_numbers.*' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date_format:Y-m-d',
            'purchase_price' => 'nullable|numeric|min:0',
            'purchase_type' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'added_by' => 'nullable|string|max:255',
            'status' => 'nullable|string|max:255',
            'photo' => 'nullable|string',
            'consumable' => 'nullable|boolean'
        ]);

        // Validate secondary_category is different from primary category
        $secondaryCategory = $request->secondary_category;
        if ($secondaryCategory && $secondaryCategory === $request->category) {
            return response()->json([
                'message' => 'Secondary category must be different from primary category'
            ], 422);
        }

        // Auto-create supplier/donor if it doesn't exist
        $supplierName = $request->supplier;
        $purchaseType = $request->purchase_type ?? 'purchased';

        if ($supplierName && !empty(trim($supplierName))) {
            $supplierName = trim($supplierName);

            if ($purchaseType === 'donated') {
                // Check if donor exists, if not create it
                $donor = Donor::where('supplier_name', $supplierName)->first();
                if (!$donor) {
                    $donor = Donor::create([
                        'supplier_name' => $supplierName,
                        'status' => 'active',
                        'date_added' => now()->toDateString()
                    ]);
                    // Log activity
                    ActivityLogService::log(
                        'created',
                        'Donors',
                        "Donor '{$donor->supplier_name}' auto-created from inventory",
                        null, // userId
                        $request->added_by ?? 'Admin User', // userName
                        'admin', // userRole
                        $donor->supplier_name, // affectedItem
                        $donor->id, // affectedItemId
                        null, // metadata
                        $request
                    );
                }
            } else {
                // Check if supplier exists, if not create it
                $supplier = Supplier::where('supplier_name', $supplierName)->first();
                if (!$supplier) {
                    $supplier = Supplier::create([
                        'supplier_name' => $supplierName,
                        'status' => 'active',
                        'type' => 'SUPPLIER',
                        'date_added' => now()->toDateString()
                    ]);
                    // Log activity
                    ActivityLogService::log(
                        'created',
                        'Suppliers',
                        "Supplier '{$supplier->supplier_name}' auto-created from inventory",
                        null, // userId
                        $request->added_by ?? 'Admin User', // userName
                        'admin', // userRole
                        $supplier->supplier_name, // affectedItem
                        $supplier->id, // affectedItemId
                        null, // metadata
                        $request
                    );
                }
            }
        }

        $quantity = $request->quantity;
        $serialNumbers = $request->serial_numbers ?? [];

        // If quantity > 1, create individual items with unique serial numbers
        if ($quantity > 1) {
            $createdItems = [];
            $baseItemData = [
                'name' => $request->name,
                'category' => $request->category,
                'secondary_category' => $secondaryCategory ?: null,
                'quantity' => 1, // Each item has quantity 1
                'available' => 1, // Each item is available
                'location' => $request->location,
                'description' => $request->description,
                'purchase_date' => $request->purchase_date,
                'purchase_price' => $request->purchase_price ?? 0,
                'purchase_type' => $request->purchase_type ?? 'purchased',
                'supplier' => $request->supplier,
                'added_by' => $request->added_by ?? 'Admin User',
                'status' => $request->status ?? 'Available',
                'consumable' => $request->consumable ?? false,
                'last_updated' => now()->toDateString()
            ];

            // Handle photo (base64 string from frontend) - same photo for all items
            $photoPath = null;
            if ($request->has('photo') && $request->photo) {
                if (str_starts_with($request->photo, 'data:image/')) {
                    $imageData = $request->photo;
                    $imageData = str_replace('data:image/png;base64,', '', $imageData);
                    $imageData = str_replace('data:image/jpeg;base64,', '', $imageData);
                    $imageData = str_replace('data:image/jpg;base64,', '', $imageData);
                    $imageData = str_replace(' ', '+', $imageData);

                    $imageData = base64_decode($imageData);
                    $fileName = time() . '_inventory_photo.jpg';
                    $filePath = 'uploads/' . $fileName;

                    if (!file_exists(public_path('uploads'))) {
                        mkdir(public_path('uploads'), 0755, true);
                    }

                    file_put_contents(public_path($filePath), $imageData);
                    $photoPath = $filePath;
                } else {
                    $photoPath = $request->photo;
                }
            }

            // Create individual items
            for ($i = 0; $i < $quantity; $i++) {
                $itemData = $baseItemData;
                $itemData['photo'] = $photoPath;

                // Assign serial number - skip for consumable items
                if ($itemData['consumable'] === true || $itemData['consumable'] === 1 || $itemData['consumable'] === '1' || $itemData['consumable'] === 'true') {
                    // Don't generate serial number for consumable items
                    $itemData['serial_number'] = null;
                } elseif (isset($serialNumbers[$i]) && !empty(trim($serialNumbers[$i]))) {
                    // Use provided serial number
                    $itemData['serial_number'] = trim($serialNumbers[$i]);
                } else {
                    // Generate unique serial number
                    $timestamp = now()->format('YmdHis');
                    $itemData['serial_number'] = 'SN-' . $timestamp . '-' . str_pad($i + 1, 4, '0', STR_PAD_LEFT);
                }

                $item = InventoryItem::create($itemData);

                // Check if item is consumable
                $isConsumable = $itemData['consumable'] === true || $itemData['consumable'] === 1 || $itemData['consumable'] === '1' || $itemData['consumable'] === 'true';

                // Deduct from budget if item is purchased (not donated)
                $deductedAmount = 0;
                if ($itemData['purchase_type'] === 'purchased' && $itemData['purchase_price'] > 0) {
                    try {
                        $budget = SchoolBudget::getCurrent();
                        $deductedAmount = (float) $itemData['purchase_price'];
                        $budget->deduct($deductedAmount);
                    } catch (\Exception $e) {
                        Log::warning('Failed to deduct budget for item: ' . $e->getMessage());
                    }
                }

                // Log activity for each item with budget deduction info
                $description = "Item created: {$item->name}";
                if (!$isConsumable && $item->serial_number) {
                    $description .= " (Serial: {$item->serial_number})";
                }
                if ($deductedAmount > 0) {
                    $description .= " | Budget deducted: ₱" . number_format($deductedAmount, 2);
                }
                ActivityLogService::logInventory('created', $description, $item->id, $request);

                // Remove serial_number from consumable items before returning
                if ($isConsumable) {
                    $item->serial_number = null;
                }

                $createdItems[] = $item;
            }

            return response()->json($createdItems, 201);
        } else {
            // Single item - original behavior
            $itemData = [
                'name' => $request->name,
                'category' => $request->category,
                'secondary_category' => $secondaryCategory ?: null,
                'quantity' => $request->quantity,
                'available' => $request->available,
                'location' => $request->location,
                'description' => $request->description,
                'purchase_date' => $request->purchase_date,
                'purchase_price' => $request->purchase_price ?? 0,
                'purchase_type' => $request->purchase_type ?? 'purchased',
                'supplier' => $request->supplier,
                'added_by' => $request->added_by ?? 'Admin User',
                'status' => $request->status ?? 'Available',
                'consumable' => $request->consumable ?? false,
                'last_updated' => now()->toDateString()
            ];

            // Assign serial number - skip for consumable items
            $isConsumable = $itemData['consumable'] === true || $itemData['consumable'] === 1 || $itemData['consumable'] === '1' || $itemData['consumable'] === 'true';
            if ($isConsumable) {
                // Don't generate serial number for consumable items
                $itemData['serial_number'] = null;
            } elseif (!empty($serialNumbers) && !empty(trim($serialNumbers[0]))) {
                $itemData['serial_number'] = trim($serialNumbers[0]);
            } elseif ($request->has('serial_number') && $request->serial_number) {
                $itemData['serial_number'] = $request->serial_number;
            } else {
                // Generate unique serial number
                $timestamp = now()->format('YmdHis');
                $itemData['serial_number'] = 'SN-' . $timestamp . '-0001';
            }

            // Handle photo (base64 string from frontend)
            if ($request->has('photo') && $request->photo) {
                if (str_starts_with($request->photo, 'data:image/')) {
                    $imageData = $request->photo;
                    $imageData = str_replace('data:image/png;base64,', '', $imageData);
                    $imageData = str_replace('data:image/jpeg;base64,', '', $imageData);
                    $imageData = str_replace('data:image/jpg;base64,', '', $imageData);
                    $imageData = str_replace(' ', '+', $imageData);

                    $imageData = base64_decode($imageData);
                    $fileName = time() . '_inventory_photo.jpg';
                    $filePath = 'uploads/' . $fileName;

                    if (!file_exists(public_path('uploads'))) {
                        mkdir(public_path('uploads'), 0755, true);
                    }

                    file_put_contents(public_path($filePath), $imageData);
                    $itemData['photo'] = $filePath;
                } else {
                    $itemData['photo'] = $request->photo;
                }
            }

            $item = InventoryItem::create($itemData);

            // Deduct from budget if item is purchased (not donated)
            $deductedAmount = 0;
            if ($itemData['purchase_type'] === 'purchased' && $itemData['purchase_price'] > 0) {
                try {
                    $budget = SchoolBudget::getCurrent();
                    $deductedAmount = (float) $itemData['purchase_price'];
                    $budget->deduct($deductedAmount);
                } catch (\Exception $e) {
                    Log::warning('Failed to deduct budget for item: ' . $e->getMessage());
                }
            }

            // Log activity with budget deduction info
            $description = "Item created: {$item->name}";
            if ($deductedAmount > 0) {
                $description .= " | Budget deducted: ₱" . number_format($deductedAmount, 2);
            }
            ActivityLogService::logInventory('created', $description, $item->id, $request);

            // Remove serial_number from consumable items before returning
            $isConsumable = $item->consumable === true || $item->consumable === 1 || $item->consumable === '1' || $item->consumable === 'true';
            if ($isConsumable) {
                $item->serial_number = null;
            }

            return response()->json($item, 201);
        }
    }

    /**
     * Display the specified inventory item.
     */
    public function show(InventoryItem $inventoryItem): JsonResponse
    {
        // Remove serial_number from consumable items
        $isConsumable = $inventoryItem->consumable === true || $inventoryItem->consumable === 1 || $inventoryItem->consumable === '1' || $inventoryItem->consumable === 'true';
        if ($isConsumable) {
            $inventoryItem->serial_number = null;
        }

        return response()->json($inventoryItem);
    }

    /**
     * Mark damaged item as repaired and available
     */
    public function markRepaired(InventoryItem $inventoryItem, Request $request): JsonResponse
    {
        try {
            // Allow marking as repaired if status is 'Damaged' or 'Under Maintenance'
            if ($inventoryItem->status !== 'Damaged' && $inventoryItem->status !== 'Under Maintenance') {
                return response()->json([
                    'message' => 'Item is not marked as damaged or under maintenance'
                ], 400);
            }

            $inventoryItem->status = 'Available';
            $inventoryItem->save();

            // Log activity
            ActivityLogService::logInventory(
                'updated',
                "Item marked as repaired and available: {$inventoryItem->name} (ID: {$inventoryItem->id})",
                $inventoryItem->id,
                $request
            );

            return response()->json([
                'message' => 'Item marked as repaired and available',
                'item' => $inventoryItem
            ]);
        } catch (\Exception $e) {
            Log::error('Error marking item as repaired', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'item_id' => $inventoryItem->id
            ]);
            return response()->json(['message' => 'Error marking item as repaired: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Update the specified inventory item.
     */
    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'secondary_category' => 'nullable|string|max:255|different:category',
            'quantity' => 'required|integer|min:1',
            'available' => 'required|integer|min:0',
            'location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'serial_number' => 'nullable|string|max:255',
            'purchase_date' => 'nullable|date',
            'purchase_price' => 'nullable|numeric|min:0',
            'purchase_type' => 'required|in:purchased,donated',
            'supplier' => 'nullable|string|max:255',
            'added_by' => 'required|string|max:255',
            'status' => 'required|in:Available,Under Maintenance,Damaged',
            'photo' => 'nullable|string',
            'consumable' => 'nullable|boolean'
        ]);

        // Validate secondary_category is different from primary category
        $secondaryCategory = $request->secondary_category;
        if ($secondaryCategory && $secondaryCategory === $request->category) {
            return response()->json([
                'message' => 'Secondary category must be different from primary category'
            ], 422);
        }

        // If primary category changed, reset secondary category if it matches
        if ($request->category !== $inventoryItem->category && $secondaryCategory === $request->category) {
            $secondaryCategory = null;
        }

        $updateData = [
            'name' => $request->name,
            'category' => $request->category,
            'secondary_category' => $secondaryCategory ?: null,
            'quantity' => $request->quantity,
            'available' => $request->available,
            'location' => $request->location,
            'description' => $request->description,
            'serial_number' => $request->serial_number,
            'purchase_date' => $request->purchase_date,
            'purchase_price' => $request->purchase_price ?? 0,
            'purchase_type' => $request->purchase_type,
            'supplier' => $request->supplier,
            'added_by' => $request->added_by,
            'status' => $request->status,
            'last_updated' => now()->toDateString()
        ];

        // Handle photo (base64 string from frontend)
        if ($request->has('photo') && $request->photo) {
            // Check if it's a base64 image
            if (str_starts_with($request->photo, 'data:image/')) {
                // Delete old photo if exists
                if ($inventoryItem->photo && !str_starts_with($inventoryItem->photo, 'http')) {
                    $oldPhotoPath = public_path($inventoryItem->photo);
                    if (file_exists($oldPhotoPath)) {
                        unlink($oldPhotoPath);
                    }
                }

                // Convert base64 to file
                $imageData = $request->photo;
                $imageData = str_replace('data:image/png;base64,', '', $imageData);
                $imageData = str_replace('data:image/jpeg;base64,', '', $imageData);
                $imageData = str_replace('data:image/jpg;base64,', '', $imageData);
                $imageData = str_replace(' ', '+', $imageData);

                $imageData = base64_decode($imageData);
                $fileName = time() . '_inventory_photo.jpg';
                $filePath = 'uploads/' . $fileName;

                // Save to uploads folder
                file_put_contents(public_path($filePath), $imageData);
                $updateData['photo'] = $filePath;
            } else {
                // Regular string (existing photo path)
                $updateData['photo'] = $request->photo;
            }
        }

        // Handle budget adjustments when purchase price or type changes
        $oldPurchaseType = $inventoryItem->purchase_type;
        $oldPurchasePrice = (float) ($inventoryItem->purchase_price ?? 0);
        $newPurchaseType = $updateData['purchase_type'];
        $newPurchasePrice = (float) ($updateData['purchase_price'] ?? 0);

        // Check if budget adjustment is needed
        $needsBudgetAdjustment = false;
        $budgetAdjustment = 0;

        if ($oldPurchaseType === 'purchased' && $oldPurchasePrice > 0) {
            // Item was previously purchased - need to refund old amount
            if ($newPurchaseType === 'donated') {
                // Changed from purchased to donated - refund the old purchase price
                $budgetAdjustment = $oldPurchasePrice;
                $needsBudgetAdjustment = true;
            } elseif ($newPurchaseType === 'purchased' && $newPurchasePrice != $oldPurchasePrice) {
                // Still purchased but price changed - adjust the difference
                $budgetAdjustment = $oldPurchasePrice - $newPurchasePrice; // Positive = refund, negative = deduct more
                $needsBudgetAdjustment = true;
            }
        } elseif ($oldPurchaseType === 'donated' && $newPurchaseType === 'purchased' && $newPurchasePrice > 0) {
            // Changed from donated to purchased - deduct the new purchase price
            $budgetAdjustment = -$newPurchasePrice; // Negative = deduct
            $needsBudgetAdjustment = true;
        }

        // Apply budget adjustment if needed
        if ($needsBudgetAdjustment) {
            try {
                $budget = SchoolBudget::getCurrent();

                if ($budgetAdjustment > 0) {
                    // Refund to budget (positive adjustment)
                    $budget->refund($budgetAdjustment);
                } elseif ($budgetAdjustment < 0) {
                    // Deduct from budget (negative adjustment)
                    $amountToDeduct = abs($budgetAdjustment);
                    $deducted = $budget->deduct($amountToDeduct);

                    if (!$deducted) {
                        // Insufficient budget - warn but don't block the update
                        Log::warning("Insufficient budget when updating item. Required: ₱{$amountToDeduct}, Available: ₱{$budget->remaining_balance}");
                    }
                }
            } catch (\Exception $e) {
                Log::warning('Failed to adjust budget for updated item: ' . $e->getMessage());
                // Don't block the update if budget adjustment fails
            }
        }

        // If item is being updated to consumable, or is already consumable, remove serial number
        $isConsumableInUpdate = isset($updateData['consumable']) && (
            $updateData['consumable'] === true ||
            $updateData['consumable'] === 1 ||
            $updateData['consumable'] === '1' ||
            $updateData['consumable'] === 'true'
        );
        $isConsumableExisting = $inventoryItem->consumable === true ||
            $inventoryItem->consumable === 1 ||
            $inventoryItem->consumable === '1' ||
            $inventoryItem->consumable === 'true';

        // If updating to consumable or already consumable, remove serial number
        if ($isConsumableInUpdate || $isConsumableExisting) {
            $updateData['serial_number'] = null;
        }

        $inventoryItem->update($updateData);

        // Remove serial_number from consumable items before returning
        $isConsumable = $isConsumableInUpdate || $isConsumableExisting;
        if ($isConsumable) {
            $inventoryItem->serial_number = null;
        }

        // Log activity with budget adjustment info if applicable
        $description = "Item updated: {$inventoryItem->name}";
        if ($needsBudgetAdjustment && $budgetAdjustment != 0) {
            if ($budgetAdjustment > 0) {
                $description .= " | Budget refunded: ₱" . number_format($budgetAdjustment, 2);
            } else {
                $description .= " | Budget deducted: ₱" . number_format(abs($budgetAdjustment), 2);
            }
        }
        ActivityLogService::logInventory('updated', $description, $inventoryItem->id, $request);

        // Include budget adjustment info in response
        $responseData = $inventoryItem->toArray();
        if ($needsBudgetAdjustment && $budgetAdjustment != 0) {
            $responseData['budget_adjustment'] = [
                'type' => $budgetAdjustment > 0 ? 'refund' : 'deduct',
                'amount' => abs($budgetAdjustment),
                'message' => $budgetAdjustment > 0
                    ? "Budget refunded: ₱" . number_format($budgetAdjustment, 2)
                    : "Budget deducted: ₱" . number_format(abs($budgetAdjustment), 2)
            ];
        }

        return response()->json($responseData);
    }

    /**
     * Remove the specified inventory item.
     */
    public function destroy(InventoryItem $inventoryItem, Request $request): JsonResponse
    {
        $itemName = $inventoryItem->name;
        $itemId = $inventoryItem->id;

        // Refund budget if item was purchased (not donated)
        $refundedAmount = 0;
        if ($inventoryItem->purchase_type === 'purchased' && $inventoryItem->purchase_price > 0) {
            try {
                $budget = SchoolBudget::getCurrent();
                $refundedAmount = (float) $inventoryItem->purchase_price;
                $budget->refund($refundedAmount);
            } catch (\Exception $e) {
                Log::warning('Failed to refund budget for deleted item: ' . $e->getMessage());
            }
        }

        $inventoryItem->delete();

        // Log activity with budget refund information
        $description = "Item deleted: {$itemName}";
        if ($refundedAmount > 0) {
            $description .= " (Budget refunded: ₱" . number_format($refundedAmount, 2) . ")";
        }
        ActivityLogService::logInventory('deleted', $description, $itemId, $request);

        return response()->json(null, 204);
    }

    /**
     * Bulk delete multiple inventory items by IDs.
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        $request->validate([
            'item_ids' => 'required|array',
            'item_ids.*' => 'required|integer|exists:inventory_items,id'
        ]);

        $itemIds = $request->item_ids;
        $deletedCount = 0;
        $totalRefunded = 0;
        $errors = [];
        $deletedItems = []; // Track deleted items for summary log

        foreach ($itemIds as $itemId) {
            try {
                $item = InventoryItem::find($itemId);
                if (!$item) {
                    $errors[] = "Item ID {$itemId} not found";
                    continue;
                }

                $itemRefunded = 0;
                // Refund budget if item was purchased
                if ($item->purchase_type === 'purchased' && $item->purchase_price > 0) {
                    try {
                        $budget = SchoolBudget::getCurrent();
                        $itemRefunded = (float) $item->purchase_price;
                        $budget->refund($itemRefunded);
                        $totalRefunded += $itemRefunded;
                    } catch (\Exception $e) {
                        Log::warning("Failed to refund budget for item {$itemId}: " . $e->getMessage());
                        // Continue with deletion even if refund fails
                    }
                }

                // Delete the item
                $itemName = $item->name;
                $item->delete();
                $deletedCount++;
                $deletedItems[] = [
                    'name' => $itemName,
                    'id' => $itemId,
                    'refunded' => $itemRefunded
                ];

                // Log activity for each individual item with budget info
                $description = "Item deleted: {$itemName}";
                if ($itemRefunded > 0) {
                    $description .= " (Budget refunded: ₱" . number_format($itemRefunded, 2) . ")";
                }
                ActivityLogService::logInventory('deleted', $description, $itemId, $request);
            } catch (\Exception $e) {
                $errors[] = "Failed to delete item ID {$itemId}: " . $e->getMessage();
                Log::error("Error deleting item {$itemId}: " . $e->getMessage());
            }
        }

        // Log a summary entry for bulk delete operation
        if ($deletedCount > 0) {
            $groupName = !empty($deletedItems) ? $deletedItems[0]['name'] : 'Multiple Items';
            $summaryDescription = "Bulk delete: {$deletedCount} item(s) deleted";
            if ($totalRefunded > 0) {
                $summaryDescription .= " | Total budget refunded: ₱" . number_format($totalRefunded, 2);
            }

            // Use the main log method for summary with metadata
            ActivityLogService::log(
                'bulk_deleted',
                'inventory',
                $summaryDescription,
                null,
                null,
                null,
                $groupName,
                null,
                [
                    'deleted_count' => $deletedCount,
                    'total_refunded' => $totalRefunded,
                    'item_ids' => array_column($deletedItems, 'id'),
                    'item_names' => array_column($deletedItems, 'name')
                ],
                $request
            );
        }

        $response = [
            'message' => "Successfully deleted {$deletedCount} item(s)",
            'deleted_count' => $deletedCount,
            'total_refunded' => $totalRefunded
        ];

        if (!empty($errors)) {
            $response['errors'] = $errors;
            $response['message'] .= " with " . count($errors) . " error(s)";
        }

        $statusCode = $deletedCount > 0 ? 200 : 400;
        return response()->json($response, $statusCode);
    }

    /**
     * Bulk update multiple inventory items by IDs.
     * Excludes serial_number and photo (QR code) from bulk updates.
     */
    public function bulkUpdate(Request $request): JsonResponse
    {
        $request->validate([
            'item_ids' => 'required|array',
            'item_ids.*' => 'required|integer|exists:inventory_items,id',
            'name' => 'nullable|string|max:255',
            'category' => 'nullable|string|max:255',
            'secondary_category' => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'purchase_date' => 'nullable|date',
            'purchase_price' => 'nullable|numeric|min:0',
            'purchase_type' => 'nullable|in:purchased,donated',
            'supplier' => 'nullable|string|max:255',
            'status' => 'nullable|in:Available,Under Maintenance,Damaged',
            'consumable' => 'nullable|boolean'
        ]);

        $itemIds = $request->item_ids;
        $updateData = $request->only([
            'name', 'category', 'secondary_category', 'location', 'description',
            'purchase_date', 'purchase_price', 'purchase_type', 'supplier', 'status', 'consumable'
        ]);

        // Remove null values to only update provided fields
        $updateData = array_filter($updateData, function($value) {
            return $value !== null;
        });

        // Validate secondary_category is different from primary category if both are provided
        if (isset($updateData['secondary_category']) && isset($updateData['category'])) {
            if ($updateData['secondary_category'] === $updateData['category']) {
                return response()->json([
                    'message' => 'Secondary category must be different from primary category'
                ], 422);
            }
        }

        $updatedCount = 0;
        $errors = [];
        $totalBudgetRefunded = 0;
        $totalBudgetDeducted = 0;

        foreach ($itemIds as $itemId) {
            try {
                $item = InventoryItem::find($itemId);
                if (!$item) {
                    $errors[] = "Item ID {$itemId} not found";
                    continue;
                }

                // If secondary_category is being updated, check it doesn't match current category
                if (isset($updateData['secondary_category']) && !isset($updateData['category'])) {
                    if ($updateData['secondary_category'] === $item->category) {
                        $errors[] = "Item ID {$itemId}: Secondary category cannot match primary category";
                        continue;
                    }
                }

                // Store original values for logging and budget calculation
                $originalValues = [];
                foreach ($updateData as $field => $value) {
                    $originalValues[$field] = $item->$field;
                }

                // Handle budget adjustments when purchase type or price changes
                $oldPurchaseType = $item->purchase_type;
                $oldPurchasePrice = (float) ($item->purchase_price ?? 0);
                $newPurchaseType = $updateData['purchase_type'] ?? $oldPurchaseType;
                $newPurchasePrice = (float) ($updateData['purchase_price'] ?? $oldPurchasePrice);

                // Check if budget adjustment is needed
                $needsBudgetAdjustment = false;
                $budgetAdjustment = 0;

                if ($oldPurchaseType === 'purchased' && $oldPurchasePrice > 0) {
                    // Item was previously purchased - need to refund old amount
                    if ($newPurchaseType === 'donated') {
                        // Changed from purchased to donated - refund the old purchase price
                        $budgetAdjustment = $oldPurchasePrice;
                        $needsBudgetAdjustment = true;
                    } elseif ($newPurchaseType === 'purchased' && $newPurchasePrice != $oldPurchasePrice) {
                        // Still purchased but price changed - adjust the difference
                        $budgetAdjustment = $oldPurchasePrice - $newPurchasePrice; // Positive = refund, negative = deduct more
                        $needsBudgetAdjustment = true;
                    }
                } elseif ($oldPurchaseType === 'donated' && $newPurchaseType === 'purchased' && $newPurchasePrice > 0) {
                    // Changed from donated to purchased - deduct the new purchase price
                    $budgetAdjustment = -$newPurchasePrice; // Negative = deduct
                    $needsBudgetAdjustment = true;
                }

                // Apply budget adjustment if needed
                if ($needsBudgetAdjustment) {
                    try {
                        $budget = SchoolBudget::getCurrent();

                        if ($budgetAdjustment > 0) {
                            // Refund to budget (positive adjustment)
                            $budget->refund($budgetAdjustment);
                            $totalBudgetRefunded += $budgetAdjustment;
                        } elseif ($budgetAdjustment < 0) {
                            // Deduct from budget (negative adjustment)
                            $amountToDeduct = abs($budgetAdjustment);
                            $deducted = $budget->deduct($amountToDeduct);
                            if ($deducted) {
                                $totalBudgetDeducted += $amountToDeduct;
                            } else {
                                // Insufficient budget - warn but don't block the update
                                Log::warning("Insufficient budget when bulk updating item {$itemId}. Required: ₱{$amountToDeduct}, Available: ₱{$budget->remaining_balance}");
                            }
                        }
                    } catch (\Exception $e) {
                        Log::warning("Failed to adjust budget for bulk updated item {$itemId}: " . $e->getMessage());
                        // Don't block the update if budget adjustment fails
                    }
                }

                // Update the item
                $item->fill($updateData);
                $item->last_updated = now()->toDateString();
                $item->save();

                $updatedCount++;

                // Log activity for each item
                $changes = [];
                foreach ($updateData as $field => $value) {
                    $oldValue = $originalValues[$field] ?? null;
                    if ($oldValue != $value) {
                        $changes[] = "{$field}: '{$oldValue}' → '{$value}'";
                    }
                }

                // Add budget adjustment info to log if applicable
                $logDescription = "Bulk update: " . implode(', ', $changes);
                if ($needsBudgetAdjustment && $budgetAdjustment != 0) {
                    if ($budgetAdjustment > 0) {
                        $logDescription .= " | Budget refunded: ₱" . number_format($budgetAdjustment, 2);
                    } else {
                        $logDescription .= " | Budget deducted: ₱" . number_format(abs($budgetAdjustment), 2);
                    }
                }

                if (!empty($changes)) {
                    ActivityLogService::logInventory(
                        'updated',
                        $logDescription,
                        $itemId,
                        $request
                    );
                }
            } catch (\Exception $e) {
                $errors[] = "Failed to update item ID {$itemId}: " . $e->getMessage();
                Log::error("Error updating item {$itemId}: " . $e->getMessage());
            }
        }

        // Log a summary entry for bulk update operation
        if ($updatedCount > 0) {
            $summaryDescription = "Bulk update: {$updatedCount} item(s) updated";
            if (!empty($updateData)) {
                $summaryDescription .= " | Fields: " . implode(', ', array_keys($updateData));
            }
            // Add budget adjustment summary if applicable
            if ($totalBudgetRefunded > 0) {
                $summaryDescription .= " | Total budget refunded: ₱" . number_format($totalBudgetRefunded, 2);
            }
            if ($totalBudgetDeducted > 0) {
                $summaryDescription .= " | Total budget deducted: ₱" . number_format($totalBudgetDeducted, 2);
            }

            ActivityLogService::log(
                'bulk_updated',
                'inventory',
                $summaryDescription,
                null,
                null,
                null,
                'Multiple Items',
                null,
                null,
                $request
            );
        }

        $response = [
            'message' => "Successfully updated {$updatedCount} item(s)",
            'updated_count' => $updatedCount
        ];

        // Add budget adjustment info if applicable
        if ($totalBudgetRefunded > 0 || $totalBudgetDeducted > 0) {
            $response['budget_adjustment'] = [];
            if ($totalBudgetRefunded > 0) {
                $response['budget_adjustment']['refunded'] = $totalBudgetRefunded;
                $response['budget_adjustment']['refunded_message'] = "Total budget refunded: ₱" . number_format($totalBudgetRefunded, 2);
            }
            if ($totalBudgetDeducted > 0) {
                $response['budget_adjustment']['deducted'] = $totalBudgetDeducted;
                $response['budget_adjustment']['deducted_message'] = "Total budget deducted: ₱" . number_format($totalBudgetDeducted, 2);
            }
        }

        if (!empty($errors)) {
            $response['errors'] = $errors;
            $response['message'] .= " with " . count($errors) . " error(s)";
        }

        return response()->json($response, $updatedCount > 0 ? 200 : 400);
    }

    /**
     * Search for inventory item by QR code.
     */
    public function search(Request $request): JsonResponse
    {
        $qr = $request->query('qr');

        if (!$qr) {
            return response()->json(['error' => 'QR code parameter is required'], 400);
        }

        // First, try exact serial number match
        $item = InventoryItem::where('serial_number', $qr)->first();

        if ($item) {
            return response()->json([
                'exists' => true,
                'item' => $item
            ]);
        }

        // Try partial serial number match (contains)
        $item = InventoryItem::where('serial_number', 'LIKE', "%{$qr}%")->first();

        if ($item) {
            return response()->json([
                'exists' => true,
                'item' => $item
            ]);
        }

        // Parse QR data to extract ID or timestamp (for ITEM-{id} or ITEM-{timestamp} format)
        $parts = explode('-', $qr);
        if (count($parts) >= 2 && $parts[0] === 'ITEM') {
            $secondPart = $parts[1];

            // Try to match by item ID first (ITEM-{id}-... format)
            if (is_numeric($secondPart)) {
                $itemId = (int)$secondPart;
                $item = InventoryItem::find($itemId);

                if ($item) {
                    return response()->json([
                        'exists' => true,
                        'item' => $item
                    ]);
                }
            }

            // Try timestamp pattern (ITEM-{timestamp} format)
            $timestamp = $secondPart;
            $serialPattern = "QR-{$timestamp}";

            $item = InventoryItem::where('serial_number', 'LIKE', "%{$serialPattern}%")
                                ->orWhere('serial_number', 'LIKE', "%{$timestamp}%")
                                ->first();

            if ($item) {
                return response()->json([
                    'exists' => true,
                    'item' => $item
                ]);
            }
        }

        // Try reverse match - check if QR contains any serial number from database
        // This handles cases where QR might be in a different format
        $allItems = InventoryItem::whereNotNull('serial_number')
                                 ->where('serial_number', '!=', '')
                                 ->get();

        foreach ($allItems as $inventoryItem) {
            if (strpos($qr, $inventoryItem->serial_number) !== false ||
                strpos($inventoryItem->serial_number, $qr) !== false) {
                return response()->json([
                    'exists' => true,
                    'item' => $inventoryItem
                ]);
            }
        }

        return response()->json([
            'exists' => false,
            'item' => null
        ]);
    }

    /**
     * Cleanup: Remove serial numbers from existing consumable items
     * This method can be called to clean up any consumable items that have serial numbers
     */
    public function cleanupConsumableSerialNumbers(): JsonResponse
    {
        try {
            // Find all consumable items that have serial numbers
            $consumableItems = InventoryItem::where(function($query) {
                $query->where('consumable', true)
                    ->orWhere('consumable', 1)
                    ->orWhere('consumable', '1')
                    ->orWhere('consumable', 'true');
            })
            ->whereNotNull('serial_number')
            ->where('serial_number', '!=', '')
            ->get();

            $updatedCount = 0;
            foreach ($consumableItems as $item) {
                $item->serial_number = null;
                $item->save();
                $updatedCount++;
            }

            return response()->json([
                'message' => "Cleanup completed. Removed serial numbers from {$updatedCount} consumable item(s).",
                'updated_count' => $updatedCount
            ]);
        } catch (\Exception $e) {
            Log::error('Error cleaning up consumable serial numbers: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error during cleanup: ' . $e->getMessage()
            ], 500);
        }
    }
}
