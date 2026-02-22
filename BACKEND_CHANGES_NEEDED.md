# Backend Changes Required for Purchased vs Donated Items Support

## Summary
The frontend has been updated to support Purchased vs Donated items. The following backend changes are required to fully support this feature.

## Required Backend Changes

### 1. Database Migration - Add `type` field to `suppliers` table
**File**: Create new migration file
```php
Schema::table('suppliers', function (Blueprint $table) {
    $table->enum('type', ['SUPPLIER', 'DONOR'])->default('SUPPLIER')->after('status');
});
```

**Action**: 
- Add nullable `type` column with default 'SUPPLIER'
- Existing suppliers will default to 'SUPPLIER'
- Do NOT drop or rename existing columns

### 2. Database Migration - Add `source` field to `inventory_items` table
**File**: Create new migration file
```php
Schema::table('inventory_items', function (Blueprint $table) {
    $table->enum('source', ['PURCHASED', 'DONATED'])->nullable()->after('purchase_type');
});
```

**Action**:
- Add nullable `source` column
- Existing items without source should default to 'PURCHASED' in application logic
- Do NOT drop or rename existing columns

### 3. Update Supplier Model
**File**: `server/app/Models/Supplier.php`
- Add `type` to `$fillable` array
- Add default value for `type` in model or migration

### 4. Update SupplierController
**File**: `server/app/Http/Controllers/Api/SupplierController.php`

**Changes needed**:
- Update `store()` method to accept and validate `type` field
- Update `update()` method to accept and validate `type` field
- Update `index()` method to support filtering by `type`:
  ```php
  if ($request->has('type')) {
      $query->where('type', $request->query('type'));
  }
  ```
- Update `active()` method to support filtering by `type`:
  ```php
  public function active(Request $request): JsonResponse
  {
      $query = Supplier::active()->orderBy('supplier_name', 'asc');
      
      if ($request->has('type')) {
          $query->where('type', $request->query('type'));
      }
      
      $suppliers = $query->get(['id', 'supplier_name', 'company_name', 'type']);
      return response()->json($suppliers);
  }
  ```

### 5. Update Inventory Model
**File**: `server/app/Models/InventoryItem.php` (or similar)
- Add `source` to `$fillable` array
- Add default value logic: if `source` is null, treat as 'PURCHASED'

### 6. Update InventoryController
**File**: `server/app/Http/Controllers/Api/InventoryController.php`

**Changes needed**:
- Update `store()` method:
  - Accept `source` field (PURCHASED or DONATED)
  - Validate: if `source === 'DONATED'`, `purchase_price` must be null or 0
  - Validate: if `source === 'PURCHASED'`, `purchase_price` is required
  - Validate: `supplier` field is required for both types
- Update `update()` method with same validation rules
- Ensure existing items without `source` default to 'PURCHASED'

### 7. Validation Rules
**For PURCHASED items**:
- `purchase_price`: required, numeric, min: 0
- `supplier`: required
- `source`: 'PURCHASED'

**For DONATED items**:
- `purchase_price`: nullable, must be null or 0
- `supplier`: required (donor name)
- `source`: 'DONATED'

### 8. Reports & Queries
**Files**: Any report generation or query files

**Changes needed**:
- When displaying `purchase_price` in reports:
  - If `source === 'DONATED'`, display 'N/A' or 'Donated'
  - If `source === 'PURCHASED'`, display the price
- Ensure queries handle nullable `source` field (default to 'PURCHASED')

## API Endpoint Updates

### GET /api/suppliers/active
**Add query parameter**: `?type=SUPPLIER` or `?type=DONOR`
- If `type` is provided, filter results by type
- If not provided, return all active suppliers/donors

### POST /api/suppliers
**Add field**: `type` (required, enum: 'SUPPLIER' or 'DONOR')
- Default to 'SUPPLIER' if not provided (for backward compatibility)

### PUT /api/suppliers/{id}
**Add field**: `type` (optional, enum: 'SUPPLIER' or 'DONOR')

### POST /api/inventory
**Add field**: `source` (required, enum: 'PURCHASED' or 'DONATED')
- Validate based on source type (see validation rules above)

### PUT /api/inventory/{id}
**Add field**: `source` (optional, enum: 'PURCHASED' or 'DONATED')
- Validate based on source type (see validation rules above)

## Testing Checklist
- [ ] Add supplier with type='SUPPLIER' works
- [ ] Add supplier with type='DONOR' works
- [ ] GET /api/suppliers/active?type=SUPPLIER returns only suppliers
- [ ] GET /api/suppliers/active?type=DONOR returns only donors
- [ ] Add inventory item with source='PURCHASED' requires purchase_price
- [ ] Add inventory item with source='DONATED' sets purchase_price to null
- [ ] Edit inventory item can change from PURCHASED to DONATED
- [ ] Reports display 'N/A' for donated items' purchase_price
- [ ] Existing items without source default to PURCHASED behavior

## Notes
- All changes are backward compatible
- Existing data will continue to work
- No breaking changes to existing API contracts
- Frontend is ready and will work once backend is updated

