<?php

namespace App\Services;

use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\Log;

/**
 * Document Generation Service
 * 
 * Provides methods to generate DOCX and PDF documents
 * 
 * Libraries used:
 * - PhpOffice/PhpWord: For DOCX generation
 * - Dompdf: For PDF generation
 */
class DocumentService
{
    /**
     * Generate a DOCX document from data
     * 
     * @param array $data Report data to include in document
     * @param string $title Document title
     * @param string $filename Output filename (without extension)
     * @return string Path to generated temporary file
     * @throws \Exception
     */
    public function generateDocx(array $data, string $title, string $filename = 'document'): string
    {
        try {
            // Check if ZipArchive extension is loaded (required by PhpWord)
            if (!extension_loaded('zip')) {
                Log::error('ZipArchive extension not loaded', [
                    'loaded_extensions' => get_loaded_extensions(),
                    'php_ini_loaded' => php_ini_loaded_file(),
                    'php_ini_scanned' => php_ini_scanned_files()
                ]);
                throw new \Exception('PHP ZipArchive extension is not enabled. Please enable the "zip" extension in php.ini and restart Apache.');
            }

            // Check if PhpWord is available
            if (!class_exists('PhpOffice\PhpWord\PhpWord')) {
                throw new \Exception('PhpWord library not installed. Run: composer require phpoffice/phpword');
            }

            // Create PhpWord instance
            $phpWord = new PhpWord();
            
            // Set document properties
            $properties = $phpWord->getDocInfo();
            $properties->setCreator('Property Management System');
            $properties->setCompany('School Management');
            $properties->setTitle($title);
            $properties->setDescription('Generated document: ' . $title);
            $properties->setCategory('Reports');
            $properties->setCreated(time());

            // Add section with margins
            $section = $phpWord->addSection([
                'marginTop' => 1440,
                'marginBottom' => 1440,
                'marginLeft' => 1440,
                'marginRight' => 1440,
            ]);

            // Add title
            $section->addText($title, [
                'bold' => true,
                'size' => 18,
                'color' => '000000'
            ]);
            $section->addTextBreak(2);

            // Add generated date
            $section->addText(
                'Generated on: ' . date('F d, Y \a\t g:i A'),
                ['size' => 10, 'color' => '666666']
            );
            $section->addTextBreak(2);

            // Add content (customize based on your needs)
            if (isset($data['content'])) {
                $section->addText($data['content'], ['size' => 11]);
            }

            // Create temporary file
            $tempDir = sys_get_temp_dir();
            if (!is_writable($tempDir)) {
                throw new \Exception('Temporary directory is not writable: ' . $tempDir);
            }

            $tempFile = $tempDir . DIRECTORY_SEPARATOR . $filename . '_' . uniqid() . '_' . time() . '.docx';

            // Save document
            $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
            $objWriter->save($tempFile);

            // Verify file was created
            if (!file_exists($tempFile) || filesize($tempFile) === 0) {
                throw new \Exception('Failed to generate DOCX file. File was not created.');
            }

            Log::info('DOCX document generated successfully', [
                'filename' => $filename,
                'tempFile' => $tempFile,
                'fileSize' => filesize($tempFile)
            ]);

            return $tempFile;

        } catch (\Exception $e) {
            Log::error('Error generating DOCX document', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Generate a PDF document from HTML content
     * 
     * @param string $html HTML content to convert to PDF
     * @param string $filename Output filename (without extension)
     * @param array $options PDF options (paper size, orientation, etc.)
     * @return string Path to generated temporary file
     * @throws \Exception
     */
    public function generatePdf(string $html, string $filename = 'document', array $options = []): string
    {
        try {
            // Check if Dompdf is available
            if (!class_exists('Dompdf\Dompdf')) {
                throw new \Exception('Dompdf library not installed. Run: composer require dompdf/dompdf');
            }

            // Configure Dompdf options
            $dompdfOptions = new Options();
            $dompdfOptions->set('isHtml5ParserEnabled', true);
            $dompdfOptions->set('isRemoteEnabled', true);
            $dompdfOptions->set('defaultFont', 'Arial');
            $dompdfOptions->set('chroot', base_path());

            // Create Dompdf instance
            $dompdf = new Dompdf($dompdfOptions);

            // Load HTML content
            $dompdf->loadHtml($html);

            // Set paper size and orientation (default: A4, portrait)
            $paperSize = $options['paper'] ?? 'a4';
            $orientation = $options['orientation'] ?? 'portrait';
            $dompdf->setPaper($paperSize, $orientation);

            // Render PDF
            $dompdf->render();

            // Create temporary file
            $tempDir = sys_get_temp_dir();
            if (!is_writable($tempDir)) {
                throw new \Exception('Temporary directory is not writable: ' . $tempDir);
            }

            $tempFile = $tempDir . DIRECTORY_SEPARATOR . $filename . '_' . uniqid() . '_' . time() . '.pdf';

            // Save PDF to file
            file_put_contents($tempFile, $dompdf->output());

            // Verify file was created
            if (!file_exists($tempFile) || filesize($tempFile) === 0) {
                throw new \Exception('Failed to generate PDF file. File was not created.');
            }

            Log::info('PDF document generated successfully', [
                'filename' => $filename,
                'tempFile' => $tempFile,
                'fileSize' => filesize($tempFile)
            ]);

            return $tempFile;

        } catch (\Exception $e) {
            Log::error('Error generating PDF document', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Generate PDF from array data (creates HTML table)
     * 
     * @param array $data Data to display in PDF
     * @param string $title Document title
     * @param string $filename Output filename (without extension)
     * @param array $options PDF options
     * @return string Path to generated temporary file
     * @throws \Exception
     */
    public function generatePdfFromData(array $data, string $title, string $filename = 'document', array $options = []): string
    {
        // Build HTML content
        $html = $this->buildHtmlFromData($data, $title);
        
        // Generate PDF
        return $this->generatePdf($html, $filename, $options);
    }

    /**
     * Build HTML content from data array
     * 
     * @param array $data Data to convert to HTML
     * @param string $title Document title
     * @return string HTML content
     */
    private function buildHtmlFromData(array $data, string $title): string
    {
        $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>' . htmlspecialchars($title) . '</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
        }
        h1 {
            color: #000;
            text-align: center;
            margin-bottom: 20px;
        }
        .meta {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-bottom: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background-color: #f0f0f0;
            padding: 10px;
            text-align: left;
            border: 1px solid #ddd;
            font-weight: bold;
        }
        td {
            padding: 8px;
            border: 1px solid #ddd;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .footer {
            margin-top: 30px;
            text-align: right;
            font-size: 10px;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>' . htmlspecialchars($title) . '</h1>
    <div class="meta">
        Generated on: ' . date('F d, Y \a\t g:i A') . '
    </div>';

        // Add table if data is provided
        if (isset($data['headers']) && isset($data['rows'])) {
            $html .= '<table>';
            
            // Header row
            $html .= '<thead><tr>';
            foreach ($data['headers'] as $header) {
                $html .= '<th>' . htmlspecialchars($header) . '</th>';
            }
            $html .= '</tr></thead>';
            
            // Data rows
            $html .= '<tbody>';
            foreach ($data['rows'] as $row) {
                $html .= '<tr>';
                foreach ($row as $cell) {
                    $html .= '<td>' . htmlspecialchars($cell ?? 'N/A') . '</td>';
                }
                $html .= '</tr>';
            }
            $html .= '</tbody>';
            
            $html .= '</table>';
        }

        $html .= '
    <div class="footer">
        Total Records: ' . (isset($data['rows']) ? count($data['rows']) : 0) . '
    </div>
</body>
</html>';

        return $html;
    }

    /**
     * Download file with proper headers
     * 
     * @param string $filePath Path to file
     * @param string $filename Download filename
     * @param string $contentType MIME type
     * @return \Illuminate\Http\Response
     */
    public function downloadFile(string $filePath, string $filename, string $contentType)
    {
        if (!file_exists($filePath)) {
            abort(404, 'File not found');
        }

        $fileSize = filesize($filePath);
        
        $response = response()->download($filePath, $filename, [
            'Content-Type' => $contentType,
        ]);

        // Set additional headers
        $response->headers->set('Content-Disposition', 'attachment; filename="' . addslashes($filename) . '"');
        $response->headers->set('Content-Length', $fileSize);
        $response->headers->set('Cache-Control', 'no-cache, must-revalidate, post-check=0, pre-check=0');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');
        $response->headers->set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');

        // Clean up file after download
        $response->deleteFileAfterSend(true);

        return $response;
    }
}

