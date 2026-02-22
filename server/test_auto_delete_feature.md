# Testing Auto-Delete Feature for Inactive Suppliers/Donors

## Step 1: Run the Migration
```bash
php artisan migrate
```

## Step 2: Test the Feature

### Option A: Quick Test (Using Database Directly)

1. **Create or find a test supplier/donor:**
   - Go to the Sources page in your admin panel
   - Create a new supplier or donor, OR use an existing one

2. **Set it to inactive:**
   - Click the Edit button on a supplier/donor
   - Change status to "Inactive"
   - Save

3. **Manually set deactivated_at to 31 days ago (for testing):**
   - Open your database (phpMyAdmin or MySQL client)
   - Run this SQL query (replace `suppliers` with `donors` if testing a donor, and replace `ID` with the actual ID):

```sql
-- For Suppliers
UPDATE suppliers 
SET deactivated_at = DATE_SUB(NOW(), INTERVAL 31 DAY) 
WHERE id = YOUR_SUPPLIER_ID;

-- For Donors
UPDATE donors 
SET deactivated_at = DATE_SUB(NOW(), INTERVAL 31 DAY) 
WHERE id = YOUR_DONOR_ID;
```

4. **Check the Sources page:**
   - Refresh the page
   - The supplier/donor should NOT appear in the list anymore
   - It has been automatically filtered out because it's been inactive for 30+ days

### Option B: Test with Soft Delete

1. **Deactivate a supplier/donor:**
   - Click the Delete (trash) button on a supplier/donor
   - Confirm the deletion

2. **Manually set deleted_at to 31 days ago:**
```sql
-- For Suppliers
UPDATE suppliers 
SET deleted_at = DATE_SUB(NOW(), INTERVAL 31 DAY) 
WHERE id = YOUR_SUPPLIER_ID;

-- For Donors
UPDATE donors 
SET deleted_at = DATE_SUB(NOW(), INTERVAL 31 DAY) 
WHERE id = YOUR_DONOR_ID;
```

3. **Check the Sources page:**
   - The soft-deleted item should NOT appear in the list

### Option C: Test Status Filter

1. **Set a supplier/donor to inactive (less than 30 days ago):**
   - Edit a supplier/donor and set status to "Inactive"
   - The `deactivated_at` will be automatically set to now()

2. **Check with status filter:**
   - In the Sources page, select "Inactive" from the status filter dropdown
   - You should see the inactive supplier/donor (because it's been inactive for less than 30 days)

3. **Manually set it to 31 days ago:**
```sql
UPDATE suppliers 
SET deactivated_at = DATE_SUB(NOW(), INTERVAL 31 DAY) 
WHERE id = YOUR_SUPPLIER_ID;
```

4. **Check again:**
   - Refresh and select "Inactive" filter
   - The supplier/donor should NOT appear anymore

## Step 3: Verify It's Working

### Test Cases:

✅ **Test 1: Active supplier/donor**
- Should appear in the list
- Should appear when filtering by "Active"

✅ **Test 2: Inactive supplier/donor (less than 30 days)**
- Should appear when filtering by "Inactive"
- Should appear in "All Status" view

✅ **Test 3: Inactive supplier/donor (30+ days)**
- Should NOT appear in any view
- Should be automatically filtered out

✅ **Test 4: Soft-deleted supplier/donor (less than 30 days)**
- Should NOT appear (soft-deleted items are hidden)

✅ **Test 5: Soft-deleted supplier/donor (30+ days)**
- Should NOT appear (automatically filtered out)

## Step 4: Reset Test Data (Optional)

If you want to restore a test supplier/donor for further testing:

```sql
-- Reset deactivated_at
UPDATE suppliers SET deactivated_at = NULL WHERE id = YOUR_SUPPLIER_ID;
UPDATE suppliers SET status = 'active' WHERE id = YOUR_SUPPLIER_ID;

-- Restore soft-deleted item
UPDATE suppliers SET deleted_at = NULL WHERE id = YOUR_SUPPLIER_ID;
```

## Quick SQL Queries for Testing

### Check current inactive suppliers/donors:
```sql
-- Suppliers inactive for more than 30 days
SELECT id, supplier_name, status, deactivated_at, 
       DATEDIFF(NOW(), deactivated_at) as days_inactive
FROM suppliers 
WHERE status = 'inactive' 
  AND deactivated_at IS NOT NULL 
  AND deactivated_at <= DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Donors inactive for more than 30 days
SELECT id, supplier_name, status, deactivated_at, 
       DATEDIFF(NOW(), deactivated_at) as days_inactive
FROM donors 
WHERE status = 'inactive' 
  AND deactivated_at IS NOT NULL 
  AND deactivated_at <= DATE_SUB(NOW(), INTERVAL 30 DAY);
```

These queries will show you items that should be automatically filtered out.
