# DocumentService Integration Guide

## Overview

The `ReportsController` has been refactored to use `DocumentService` for clean, maintainable document generation. Both DOCX and PDF downloads are now supported with proper error handling, filename sanitization, and automatic cleanup.

## Installed Libraries

✅ **PhpOffice/PhpWord** (v1.3) - DOCX generation
✅ **Dompdf** (v3.1) - PDF generation

## API Endpoints

### 1. Download DOCX Report
```
POST /api/reports/download
```

**Request Body:**
```json
{
    "report_type": "inventory|users|requests|costs",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
}
```

**Response:**
- File download with headers:
  - `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `Content-Disposition: attachment; filename="Report_Name_20240101_20240131.docx"`

### 2. Download PDF Report
```
POST /api/reports/download-pdf
```

**Request Body:**
```json
{
    "report_type": "inventory|users|requests|costs",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
}
```

**Response:**
- File download with headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="Report_Name_20240101_20240131.pdf"`

## Security Features

### 1. Filename Sanitization
- Removes special characters
- Validates file extensions
- Prevents path traversal attacks
- Method: `sanitizeFilename()`

### 2. Request Validation
- Validates report type (whitelist)
- Validates date format and range
- Prevents SQL injection through Eloquent ORM

### 3. Error Handling
- Comprehensive try-catch blocks
- Detailed error logging
- User-friendly error messages
- No sensitive data exposure

### 4. File Cleanup
- Automatic temporary file deletion after download
- Cleanup on generation failure
- Uses `deleteFileAfterSend(true)`

## Code Structure

### Controller Methods

1. **`download()`** - DOCX generation
   - Uses `DocumentService` for file handling
   - Generates DOCX with PhpWord
   - Returns file download response

2. **`downloadPdf()`** - PDF generation
   - Uses `DocumentService` for PDF generation
   - Converts data to HTML table
   - Returns PDF file download

### Helper Methods

1. **`getReportTypeName()`** - Get display name for report type
2. **`sanitizeFilename()`** - Sanitize filenames for safe download
3. **`prepareDocumentData()`** - Prepare data structure for DOCX
4. **`generateDocxWithTable()`** - Generate DOCX with formatted table
5. **`getReportHeaders()`** - Get column headers for report type
6. **`getReportColumnKeys()`** - Get column keys for data mapping
7. **`formatReportDataForTable()`** - Format data for PDF table display

## Usage Examples

### Frontend (React/TypeScript)

#### Download DOCX
```typescript
const downloadDocx = async () => {
  const token = localStorage.getItem('api_token');
  const response = await fetch('http://127.0.0.1:8000/api/reports/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      report_type: 'inventory',
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inventory_report.docx';
  link.click();
  window.URL.revokeObjectURL(url);
};
```

#### Download PDF
```typescript
const downloadPdf = async () => {
  const token = localStorage.getItem('api_token');
  const response = await fetch('http://127.0.0.1:8000/api/reports/download-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      report_type: 'inventory',
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inventory_report.pdf';
  link.click();
  window.URL.revokeObjectURL(url);
};
```

## Error Responses

### Validation Error (422)
```json
{
    "success": false,
    "message": "Validation failed",
    "errors": {
        "report_type": ["The report type field is required."],
        "start_date": ["The start date field is required."],
        "end_date": ["The end date must be a date after or equal to start date."]
    }
}
```

### Server Error (500)
```json
{
    "success": false,
    "message": "Failed to download report: [error message]"
}
```

## Logging

All document generation activities are logged:
- File generation start
- File creation success/failure
- File size information
- Download requests
- Error details with stack traces

Check logs at: `storage/logs/laravel.log`

## Best Practices

1. **Always validate input** - Use Laravel validation rules
2. **Sanitize filenames** - Prevent security issues
3. **Handle errors gracefully** - Return user-friendly messages
4. **Log important events** - For debugging and auditing
5. **Clean up temporary files** - Prevent disk space issues
6. **Use proper HTTP headers** - Ensure correct file handling
7. **Test with different data sizes** - Ensure scalability

## Testing Checklist

- [ ] DOCX download works for all report types
- [ ] PDF download works for all report types
- [ ] Filenames are properly sanitized
- [ ] Error handling works correctly
- [ ] Files are cleaned up after download
- [ ] Authentication is required
- [ ] Validation errors are returned correctly
- [ ] Large datasets are handled properly
- [ ] Empty datasets show appropriate message

## Notes

- Temporary files are stored in system temp directory
- Files are automatically deleted after successful download
- Failed generations clean up temporary files immediately
- Both DOCX and PDF support UTF-8 encoding
- PDF supports HTML5 and CSS styling
- DOCX supports rich text formatting and tables

