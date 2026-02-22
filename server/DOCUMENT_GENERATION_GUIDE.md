# Document Generation Guide

## Installed Libraries

✅ **PhpOffice/PhpWord** (v1.3) - For DOCX generation
✅ **Dompdf** (v3.1) - For PDF generation

Both libraries are installed and ready to use.

## Usage Examples

### 1. Using DocumentService (Recommended)

The `DocumentService` class provides a clean interface for generating documents.

#### Generate DOCX Document

```php
use App\Services\DocumentService;

$documentService = new DocumentService();

// Generate DOCX
$tempFile = $documentService->generateDocx(
    data: ['content' => 'Your document content here'],
    title: 'My Document Title',
    filename: 'my_document'
);

// Download the file
return $documentService->downloadFile(
    filePath: $tempFile,
    filename: 'my_document.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
);
```

#### Generate PDF Document

```php
use App\Services\DocumentService;

$documentService = new DocumentService();

// Option 1: From HTML
$html = '<h1>My PDF Title</h1><p>Content here</p>';
$tempFile = $documentService->generatePdf(
    html: $html,
    filename: 'my_pdf',
    options: ['paper' => 'a4', 'orientation' => 'portrait']
);

// Option 2: From array data (creates HTML table)
$data = [
    'headers' => ['ID', 'Name', 'Email'],
    'rows' => [
        [1, 'John Doe', 'john@example.com'],
        [2, 'Jane Smith', 'jane@example.com'],
    ]
];
$tempFile = $documentService->generatePdfFromData(
    data: $data,
    title: 'User Report',
    filename: 'user_report'
);

// Download the file
return $documentService->downloadFile(
    filePath: $tempFile,
    filename: 'my_pdf.pdf',
    contentType: 'application/pdf'
);
```

### 2. Direct Usage in Controller

#### DOCX Generation (PhpWord)

```php
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;

public function downloadDocx()
{
    $phpWord = new PhpWord();
    
    $section = $phpWord->addSection();
    $section->addText('Hello World', ['bold' => true, 'size' => 16]);
    
    $tempFile = tempnam(sys_get_temp_dir(), 'doc_') . '.docx';
    $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
    $objWriter->save($tempFile);
    
    return response()->download($tempFile, 'document.docx', [
        'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])->deleteFileAfterSend(true);
}
```

#### PDF Generation (Dompdf)

```php
use Dompdf\Dompdf;
use Dompdf\Options;

public function downloadPdf()
{
    $options = new Options();
    $options->set('isHtml5ParserEnabled', true);
    $options->set('defaultFont', 'Arial');
    
    $dompdf = new Dompdf($options);
    $dompdf->loadHtml('<h1>Hello World</h1><p>PDF content here</p>');
    $dompdf->setPaper('a4', 'portrait');
    $dompdf->render();
    
    $tempFile = tempnam(sys_get_temp_dir(), 'pdf_') . '.pdf';
    file_put_contents($tempFile, $dompdf->output());
    
    return response()->download($tempFile, 'document.pdf', [
        'Content-Type' => 'application/pdf',
    ])->deleteFileAfterSend(true);
}
```

## Content Types (MIME Types)

- **DOCX**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **PDF**: `application/pdf`

## File Options

### PDF Paper Sizes
- `a4` (default)
- `letter`
- `legal`
- `a3`
- `a5`
- etc.

### PDF Orientation
- `portrait` (default)
- `landscape`

## Error Handling

Both libraries will throw exceptions if:
- Library is not installed
- Temporary directory is not writable
- File generation fails
- Invalid data is provided

Always wrap document generation in try-catch blocks:

```php
try {
    $documentService = new DocumentService();
    $tempFile = $documentService->generatePdf($html, 'document');
    return $documentService->downloadFile($tempFile, 'document.pdf', 'application/pdf');
} catch (\Exception $e) {
    \Log::error('Document generation failed: ' . $e->getMessage());
    return response()->json(['error' => 'Failed to generate document'], 500);
}
```

## Notes

- All generated files are temporary and automatically deleted after download
- Files are stored in the system's temporary directory
- File names are sanitized to prevent security issues
- Both libraries support UTF-8 encoding
- PDF generation supports HTML5 and CSS styling
- DOCX generation supports rich text formatting

