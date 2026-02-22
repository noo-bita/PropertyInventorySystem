# DOCX Report Totals Feature

## Overview
The DOCX report generation now automatically calculates and displays totals for numeric columns at the bottom of each report table.

## Features

### ✅ Automatic Totals Calculation
- Automatically identifies numeric columns (quantity, price, cost, available)
- Calculates sums for all numeric values in each column
- Handles edge cases (null values, non-numeric data)

### ✅ Distinct Totals Row Formatting
- **Background Color**: Light gray (`#E8E8E8`) for visual distinction
- **Text Formatting**: Bold, larger font (11pt vs 10pt for data rows)
- **Label**: "TOTAL" label in the first column
- **Row Height**: Slightly taller (350 vs 300) for better visibility

### ✅ Proper Number Formatting
- **Currency Fields** (price, cost): Formatted with ₱ symbol and 2 decimal places
  - Example: `₱1,234.56`
- **Numeric Fields** (quantity, available): 
  - Whole numbers: No decimals (e.g., `1,234`)
  - Decimal numbers: 2 decimal places (e.g., `1,234.56`)

### ✅ Error Handling
- Logs warnings for calculation errors
- Gracefully handles non-numeric values
- Continues processing even if individual calculations fail
- Comprehensive error logging with stack traces

## Supported Report Types

### 1. Inventory Report
**Totaled Columns:**
- Quantity
- Available
- Purchase Price

**Example:**
```
| ID | Item Name | Category | Quantity | Available | Location | Status | Purchase Price | Purchase Date |
|----|-----------|----------|----------|-----------|----------|--------|----------------|---------------|
| 1  | Chair     | Furniture| 10       | 8         | Room A   | Active | ₱500.00        | Jan 1, 2024   |
| 2  | Desk      | Furniture| 5        | 3         | Room B   | Active | ₱1,200.00      | Jan 2, 2024   |
|----|-----------|----------|----------|-----------|----------|--------|----------------|---------------|
| TOTAL |         |          | 15       | 11        |          |        | ₱1,700.00      |               |
```

### 2. User Activity Report
**Totaled Columns:**
- None (no numeric columns to total)

**Note:** User reports don't have numeric columns, so no totals row is displayed.

### 3. Request History Report
**Totaled Columns:**
- Quantity

**Example:**
```
| ID | Teacher | Item  | Quantity | Status | Request Date | Due Date |
|----|---------|-------|----------|--------|--------------|----------|
| 1  | John    | Chair | 5        | Pending| Jan 1, 2024  | Jan 5    |
| 2  | Jane    | Desk  | 3        | Approved| Jan 2, 2024| Jan 6    |
|----|---------|-------|----------|--------|--------------|----------|
| TOTAL |       |       | 8        |        |              |          |
```

### 4. Cost Analysis Report
**Totaled Columns:**
- Quantity
- Unit Price
- Total Cost

**Example:**
```
| ID | Item Name | Category | Quantity | Unit Price | Total Cost | Purchase Date | Supplier |
|----|-----------|----------|----------|------------|------------|---------------|----------|
| 1  | Chair     | Furniture| 10       | ₱500.00    | ₱5,000.00  | Jan 1, 2024   | Supplier A |
| 2  | Desk      | Furniture| 5        | ₱1,200.00  | ₱6,000.00  | Jan 2, 2024   | Supplier B |
|----|-----------|----------|----------|------------|------------|---------------|----------|
| TOTAL |         |          | 15       | ₱1,700.00  | ₱11,000.00 |               |          |
```

## Implementation Details

### Code Structure

#### 1. `getTotalableColumns()` Method
Identifies which columns should have totals calculated:
- Excludes: ID, dates, names, emails, roles, status, location, category, etc.
- Includes: quantity, available, price, cost fields

#### 2. `formatTotalValue()` Method
Formats total values based on column type:
- Currency columns: `₱` + 2 decimal places
- Numeric columns: Whole numbers or 2 decimals as needed

#### 3. `addReportTable()` Method (Modified)
- Calculates totals while iterating through data rows
- Adds a formatted totals row at the bottom
- Handles errors gracefully with logging

### Error Handling

```php
try {
    $totals[$index] += (float)$value;
} catch (\Exception $e) {
    \Log::warning('Error calculating total for column', [
        'column' => $key,
        'value' => $value,
        'error' => $e->getMessage()
    ]);
}
```

### Logging

All calculation errors are logged with:
- Column name
- Value that caused the error
- Full error message
- Stack trace (for critical errors)

## Usage

The totals feature is **automatic** - no code changes needed in controllers or services. Simply generate a DOCX report as usual:

```php
// In ReportsController::download()
$tempFile = $this->generateDocxWithTable($reportTypeName, $docData, $startDate, $endDate);
```

The totals row will be automatically added if:
1. The report has numeric columns (quantity, price, cost, available)
2. There is at least one data row
3. The numeric columns contain valid numeric values

## Testing

To test the totals feature:

1. **Generate an Inventory Report:**
   - Should show totals for Quantity, Available, and Purchase Price

2. **Generate a Cost Analysis Report:**
   - Should show totals for Quantity, Unit Price, and Total Cost

3. **Generate a Request History Report:**
   - Should show totals for Quantity only

4. **Generate a User Activity Report:**
   - Should NOT show a totals row (no numeric columns)

5. **Test with empty data:**
   - No totals row should appear

6. **Test with null/missing values:**
   - Should handle gracefully and continue calculating

## Future Enhancements

Potential improvements:
- Average calculations
- Percentage calculations
- Multiple summary rows (totals, averages, counts)
- Customizable total labels
- Grouped totals by category

## Notes

- Totals are calculated server-side during DOCX generation
- All numeric values are summed, regardless of data type in database
- Currency formatting uses Philippine Peso (₱) symbol
- Totals row appears only when there are totalable columns and data exists

