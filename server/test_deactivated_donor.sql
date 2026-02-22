-- Test Script: Check and Update Deactivated Donor

-- Step 1: Check current deactivated donors
SELECT 
    id, 
    supplier_name, 
    status, 
    deactivated_at,
    deleted_at,
    CASE 
        WHEN deactivated_at IS NULL THEN 'No deactivation date'
        WHEN deactivated_at > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN CONCAT('Inactive for ', DATEDIFF(NOW(), deactivated_at), ' days (will show)')
        ELSE CONCAT('Inactive for ', DATEDIFF(NOW(), deactivated_at), ' days (will be hidden)')
    END as status_info
FROM donors 
WHERE status = 'inactive' OR deleted_at IS NOT NULL
ORDER BY deactivated_at DESC, deleted_at DESC;

-- Step 2: Set deactivated_at to 31 days ago (to test auto-deletion)
-- Replace YOUR_DONOR_ID with the actual ID from Step 1
-- UPDATE donors 
-- SET deactivated_at = DATE_SUB(NOW(), INTERVAL 31 DAY) 
-- WHERE id = YOUR_DONOR_ID;

-- Step 3: Verify it's been set correctly
-- SELECT 
--     id, 
--     supplier_name, 
--     status, 
--     deactivated_at,
--     DATEDIFF(NOW(), deactivated_at) as days_inactive
-- FROM donors 
-- WHERE id = YOUR_DONOR_ID;

-- Step 4: Reset back to current date (to restore visibility)
-- UPDATE donors 
-- SET deactivated_at = NOW() 
-- WHERE id = YOUR_DONOR_ID;
