<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\InventoryItem;
use App\Models\User;
use App\Models\ItemRequest;
use App\Models\CustomRequest;
use App\Services\ActivityLogService;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

class ReportsController extends Controller
{
    public function index(): JsonResponse
    {
        \Log::info('Reports index request received');
        $reports = Report::orderByDesc('created_at')->get();
        \Log::info('Reports found', ['count' => $reports->count()]);
        return response()->json($reports);
    }

    public function store(Request $request): JsonResponse
    {
        \Log::info('Report store request received', [
            'request_data' => $request->all(),
            'headers' => $request->headers->all()
        ]);

        $data = $request->validate([
            'teacher_name' => 'required|string|max:255',
            'teacher_id' => 'nullable|integer',
            'location' => 'required|string|max:255',
            'subject' => 'nullable|string|max:500',
            'description' => 'required|string',
            'notes' => 'nullable|string',
            'photo' => 'nullable|string|max:16777215', // Max for MEDIUMTEXT in MySQL
        ]);

        $data['status'] = 'pending';

        try {
            $report = Report::create($data);
            \Log::info('Report created successfully', ['report_id' => $report->id]);
            
            // Log activity
            ActivityLogService::logReport(
                'created',
                "Report created: {$data['subject']} by {$data['teacher_name']}",
                $report->id,
                $request
            );
            
            return response()->json(['report' => $report], 201);
        } catch (\Exception $e) {
            \Log::error('Error creating report: ' . $e->getMessage(), [
                'data' => $data,
                'exception' => $e
            ]);
            return response()->json(['error' => 'Failed to create report: ' . $e->getMessage()], 500);
        }
    }

    public function show(Report $report): JsonResponse
    {
        return response()->json($report);
    }

    public function update(Request $request, Report $report): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:pending,under_review,in_progress,resolved,rejected',
            'admin_response' => 'nullable|string|max:1000'
        ]);

        $report->update($data);
        return response()->json($report);
    }

    public function destroy(Report $report): JsonResponse
    {
        $report->delete();
        return response()->json(['message' => 'Report deleted successfully']);
    }

    public function respondToReport(Report $report, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:under_review,in_progress,resolved,rejected',
            'admin_response' => 'nullable|string|max:1000'
        ]);

        $report->status = $data['status'];
        if (isset($data['admin_response'])) {
            $report->admin_response = $data['admin_response'];
        }
        $report->save();

        return response()->json($report);
    }

    public function generate(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'report_type' => 'required|in:inventory,users,requests,costs',
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date'
            ]);

            $reportType = $data['report_type'];
            $startDate = $data['start_date'];
            $endDate = $data['end_date'];

            $reportData = [];

            switch ($reportType) {
                case 'inventory':
                    $reportData = InventoryItem::where(function($query) use ($startDate, $endDate) {
                            $query->whereBetween('created_at', [$startDate, $endDate])
                                  ->orWhereBetween('last_updated', [$startDate, $endDate]);
                        })
                        ->get()
                        ->map(function ($item) {
                            return [
                                'id' => $item->id,
                                'item_name' => $item->name,
                                'category' => $item->category,
                                'quantity' => $item->quantity,
                                'available' => $item->available,
                                'location' => $item->location,
                                'status' => $item->status,
                                'purchase_price' => $item->purchase_price ?? 0,
                                'purchase_date' => $item->purchase_date ? $item->purchase_date->format('Y-m-d') : null
                            ];
                        })
                        ->toArray();
                    break;

                case 'users':
                    $reportData = User::whereBetween('created_at', [$startDate, $endDate])
                        ->get()
                        ->map(function ($user) {
                            return [
                                'id' => $user->id,
                                'name' => $user->full_name ?? ($user->first_name . ' ' . $user->last_name),
                                'email' => $user->email,
                                'role' => $user->role ?? 'N/A',
                                'last_login' => 'N/A', // Last login tracking not implemented yet
                                'status' => $user->deleted_at ? 'Inactive' : 'Active'
                            ];
                        })
                        ->toArray();
                    break;

                case 'requests':
                    $reportData = ItemRequest::whereBetween('created_at', [$startDate, $endDate])
                        ->get()
                        ->map(function ($request) {
                            return [
                                'id' => $request->id,
                                'teacher' => $request->teacher_name,
                                'item' => $request->item_name,
                                'quantity' => $request->quantity_requested,
                                'status' => $request->status,
                                'request_date' => $request->created_at->format('Y-m-d'),
                                'due_date' => $request->due_date ? $request->due_date->format('Y-m-d') : 'N/A'
                            ];
                        })
                        ->toArray();
                    break;

                case 'costs':
                    $reportData = InventoryItem::whereBetween('purchase_date', [$startDate, $endDate])
                        ->where('purchase_type', '!=', 'donated')
                        ->get()
                        ->map(function ($item) {
                            $totalCost = ($item->purchase_price ?? 0) * $item->quantity;
                            return [
                                'id' => $item->id,
                                'item_name' => $item->name,
                                'category' => $item->category,
                                'quantity' => $item->quantity,
                                'unit_price' => $item->purchase_price ?? 0,
                                'total_cost' => $totalCost,
                                'purchase_date' => $item->purchase_date ? $item->purchase_date->format('Y-m-d') : null,
                                'supplier' => $item->supplier ?? 'N/A'
                            ];
                        })
                        ->toArray();
                    break;
            }

            // Log activity
            ActivityLogService::logReport(
                'generated',
                "Report generated: {$reportType} from {$startDate} to {$endDate}",
                null,
                $request
            );

            return response()->json([
                'success' => true,
                'data' => $reportData,
                'report_type' => $reportType,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'count' => count($reportData)
            ], 200)->header('Content-Type', 'application/json');

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422)->header('Content-Type', 'application/json');
        } catch (\Exception $e) {
            \Log::error('Error generating report: ' . $e->getMessage(), [
                'exception' => $e,
                'request_data' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate report: ' . $e->getMessage()
            ], 500)->header('Content-Type', 'application/json');
        }
    }

    /**
     * Download report as DOCX file
     * Uses DocumentService for clean, maintainable code
     * 
     * @param Request $request
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function download(Request $request)
    {
        try {
            // Validate request data
            $data = $request->validate([
                'report_type' => 'required|in:inventory,users,requests,costs',
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date'
            ]);

            $reportType = $data['report_type'];
            $startDate = $data['start_date'];
            $endDate = $data['end_date'];

            // Fetch report data
            $reportData = $this->fetchReportData($reportType, $startDate, $endDate);
            
            // Get report type name
            $reportTypeName = $this->getReportTypeName($reportType);

            // Prepare document data with table structure
            $docData = $this->prepareDocumentData($reportType, $reportData, $startDate, $endDate);

            // Generate DOCX file with table
            $tempFile = $this->generateDocxWithTable($reportTypeName, $docData, $startDate, $endDate);

            // Sanitize filename for safe download
            $filename = $this->sanitizeFilename($reportTypeName, $startDate, $endDate, 'docx');

            // Verify file exists and has content
            if (!file_exists($tempFile) || filesize($tempFile) === 0) {
                throw new \Exception('Failed to generate DOCX file. File was not created or is empty.');
            }

            $fileSize = filesize($tempFile);

            // Download file with proper headers using DocumentService
            $documentService = new DocumentService();
            return $documentService->downloadFile(
                $tempFile,
                $filename,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422)->header('Content-Type', 'application/json');
        } catch (\Exception $e) {
            \Log::error('Error downloading DOCX report', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to download report: ' . $e->getMessage()
            ], 500)->header('Content-Type', 'application/json');
        }
    }

    /**
     * Download report as PDF file
     * Uses DocumentService for PDF generation from HTML
     * 
     * @param Request $request
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function downloadPdf(Request $request)
    {
        try {
            // Validate request data
            $data = $request->validate([
                'report_type' => 'required|in:inventory,users,requests,costs',
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date'
            ]);

            $reportType = $data['report_type'];
            $startDate = $data['start_date'];
            $endDate = $data['end_date'];

            // Fetch report data
            $reportData = $this->fetchReportData($reportType, $startDate, $endDate);
            
            // Get report type name
            $reportTypeName = $this->getReportTypeName($reportType);

            // Prepare data for PDF generation (table format)
            $pdfData = [
                'headers' => $this->getReportHeaders($reportType),
                'rows' => $this->formatReportDataForTable($reportData, $reportType),
            ];

            // Generate PDF using DocumentService
            $documentService = new DocumentService();
            $tempFile = $documentService->generatePdfFromData(
                $pdfData,
                $reportTypeName,
                $this->sanitizeFilename($reportTypeName, $startDate, $endDate, 'pdf', false),
                ['paper' => 'a4', 'orientation' => 'portrait']
            );

            // Sanitize filename for safe download
            $filename = $this->sanitizeFilename($reportTypeName, $startDate, $endDate, 'pdf');

            // Download file with proper headers
            return $documentService->downloadFile(
                $tempFile,
                $filename,
                'application/pdf'
            );

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422)->header('Content-Type', 'application/json');
        } catch (\Exception $e) {
            \Log::error('Error downloading PDF report', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to download PDF report: ' . $e->getMessage()
            ], 500)->header('Content-Type', 'application/json');
        }
    }

    /**
     * Download report as Excel file (XLSX)
     * Optimized for printing and official submission
     * 
     * @param Request $request
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function downloadExcel(Request $request)
    {
        try {
            // Check if PhpSpreadsheet is available
            if (!class_exists('PhpOffice\PhpSpreadsheet\Spreadsheet')) {
                throw new \Exception('PhpSpreadsheet library not installed. Please run: composer require phpoffice/phpspreadsheet');
            }

            // Validate request data
            $data = $request->validate([
                'report_type' => 'required|in:inventory,users,requests,costs',
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date'
            ]);

            $reportType = $data['report_type'];
            $startDate = $data['start_date'];
            $endDate = $data['end_date'];

            // Fetch report data
            $reportData = $this->fetchReportData($reportType, $startDate, $endDate);
            
            // Get report type name
            $reportTypeName = $this->getReportTypeName($reportType);

            // Prepare document data
            $docData = $this->prepareDocumentData($reportType, $reportData, $startDate, $endDate);

            // Generate Excel file
            $tempFile = $this->generateExcelWithTable($reportTypeName, $docData, $startDate, $endDate);

            // Sanitize filename for safe download
            $filename = $this->sanitizeFilename($reportTypeName, $startDate, $endDate, 'xlsx');

            // Verify file exists and has content
            if (!file_exists($tempFile) || filesize($tempFile) === 0) {
                throw new \Exception('Failed to generate Excel file. File was not created or is empty.');
            }

            // Download file with proper headers
            $documentService = new DocumentService();
            return $documentService->downloadFile(
                $tempFile,
                $filename,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422)->header('Content-Type', 'application/json');
        } catch (\Exception $e) {
            \Log::error('Error downloading Excel report', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to download Excel report: ' . $e->getMessage()
            ], 500)->header('Content-Type', 'application/json');
        }
    }

    private function fetchReportData($reportType, $startDate, $endDate)
    {
        $reportData = [];

        switch ($reportType) {
            case 'inventory':
                $reportData = InventoryItem::where(function($query) use ($startDate, $endDate) {
                        $query->whereBetween('created_at', [$startDate, $endDate])
                              ->orWhereBetween('last_updated', [$startDate, $endDate]);
                    })
                    ->get()
                    ->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'item_name' => $item->name,
                            'category' => $item->category,
                            'quantity' => $item->quantity,
                            'available' => $item->available,
                            'location' => $item->location,
                            'status' => $item->status,
                            'purchase_price' => $item->purchase_price ?? 0,
                            'purchase_date' => $item->purchase_date ? $item->purchase_date->format('Y-m-d') : null
                        ];
                    })
                    ->toArray();
                break;

            case 'users':
                $reportData = User::whereBetween('created_at', [$startDate, $endDate])
                    ->get()
                    ->map(function ($user) {
                        return [
                            'id' => $user->id,
                            'name' => $user->full_name ?? ($user->first_name . ' ' . $user->last_name),
                            'email' => $user->email,
                            'role' => $user->role ?? 'N/A',
                            'last_login' => 'N/A',
                            'status' => $user->deleted_at ? 'Inactive' : 'Active'
                        ];
                    })
                    ->toArray();
                break;

            case 'requests':
                $reportData = ItemRequest::whereBetween('created_at', [$startDate, $endDate])
                    ->get()
                    ->map(function ($request) {
                        return [
                            'id' => $request->id,
                            'teacher' => $request->teacher_name,
                            'item' => $request->item_name,
                            'quantity' => $request->quantity_requested,
                            'status' => $request->status,
                            'request_date' => $request->created_at->format('Y-m-d'),
                            'due_date' => $request->due_date ? $request->due_date->format('Y-m-d') : 'N/A'
                        ];
                    })
                    ->toArray();
                break;

            case 'costs':
                $reportData = InventoryItem::whereBetween('purchase_date', [$startDate, $endDate])
                    ->where('purchase_type', '!=', 'donated')
                    ->get()
                    ->map(function ($item) {
                        $totalCost = ($item->purchase_price ?? 0) * $item->quantity;
                        return [
                            'id' => $item->id,
                            'item_name' => $item->name,
                            'category' => $item->category,
                            'quantity' => $item->quantity,
                            'unit_price' => $item->purchase_price ?? 0,
                            'total_cost' => $totalCost,
                            'purchase_date' => $item->purchase_date ? $item->purchase_date->format('Y-m-d') : null,
                            'supplier' => $item->supplier ?? 'N/A'
                        ];
                    })
                    ->toArray();
                break;
        }

        return $reportData;
    }

    /**
     * Get report type display name
     * 
     * @param string $reportType
     * @return string
     */
    private function getReportTypeName(string $reportType): string
    {
        $reportTypeNames = [
            'inventory' => 'Inventory Report',
            'users' => 'User Activity Report',
            'requests' => 'Request History Report',
            'costs' => 'Cost Analysis Report'
        ];
        
        return $reportTypeNames[$reportType] ?? 'Report';
    }

    /**
     * Sanitize filename for safe download
     * Removes special characters and ensures valid filename
     * 
     * @param string $reportTypeName
     * @param string $startDate
     * @param string $endDate
     * @param string $extension
     * @param bool $includeExtension
     * @return string
     */
    private function sanitizeFilename(string $reportTypeName, string $startDate, string $endDate, string $extension, bool $includeExtension = true): string
    {
        // Remove special characters from report name
        $safeName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $reportTypeName);
        
        // Format dates (remove dashes)
        $dateStr = str_replace('-', '', $startDate) . '_' . str_replace('-', '', $endDate);
        
        // Build filename
        $filename = $safeName . '_' . $dateStr;
        
        // Add extension if needed
        if ($includeExtension) {
            $filename .= '.' . $extension;
        }
        
        // Final sanitization - ensure only safe characters
        $filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $filename);
        
        return $filename;
    }

    /**
     * Prepare document data structure for DOCX generation
     * 
     * @param string $reportType
     * @param array $reportData
     * @param string $startDate
     * @param string $endDate
     * @return array
     */
    private function prepareDocumentData(string $reportType, array $reportData, string $startDate, string $endDate): array
    {
        return [
            'report_type' => $reportType,
            'data' => $reportData,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'headers' => $this->getReportHeaders($reportType),
            'column_keys' => $this->getReportColumnKeys($reportType),
        ];
    }

    /**
     * Generate DOCX document with table using PhpWord
     * 
     * @param string $title
     * @param array $docData
     * @param string $startDate
     * @param string $endDate
     * @return string Path to generated file
     * @throws \Exception
     */
    private function generateDocxWithTable(string $title, array $docData, string $startDate, string $endDate): string
    {
        try {
            // Check if ZipArchive extension is loaded (required by PhpWord)
            if (!extension_loaded('zip')) {
                \Log::error('ZipArchive extension not loaded', [
                    'loaded_extensions' => get_loaded_extensions(),
                    'php_ini_loaded' => php_ini_loaded_file(),
                    'php_ini_scanned' => php_ini_scanned_files()
                ]);
                throw new \Exception('PHP ZipArchive extension is not enabled. Please enable the "zip" extension in php.ini and restart Apache.');
            }

            // Check if PhpWord is available
            if (!class_exists('PhpOffice\PhpWord\PhpWord')) {
                \Log::error('PhpWord library not found');
                throw new \Exception('PhpWord library not installed. Please contact administrator.');
            }

            \Log::info('Starting DOCX generation', [
                'title' => $title,
                'report_type' => $docData['report_type'] ?? 'unknown',
                'data_count' => count($docData['data'] ?? [])
            ]);

            $phpWord = new PhpWord();
            
            // Set document properties
            try {
                $properties = $phpWord->getDocInfo();
                $properties->setCreator('Property Management System');
                $properties->setCompany('School Management');
                $properties->setTitle($title);
                $properties->setDescription('Generated report: ' . $title);
                $properties->setCategory('Reports');
                $properties->setCreated(time());
            } catch (\Exception $e) {
                \Log::warning('Failed to set document properties: ' . $e->getMessage());
                // Continue even if properties fail
            }

            // Add section with print-optimized margins (1 inch = 1440 twips)
            // Standard margins for official documents: 1 inch all around
            $section = $phpWord->addSection([
                'marginTop' => 1440,      // 1 inch top margin
                'marginBottom' => 1440,   // 1 inch bottom margin
                'marginLeft' => 1440,     // 1 inch left margin
                'marginRight' => 1440,    // 1 inch right margin
                'headerHeight' => 720,     // 0.5 inch header
                'footerHeight' => 720,    // 0.5 inch footer
            ]);

            // Add header with logos and system information - Professional layout
            $headerTable = $section->addTable([
                'borderSize' => 0,
                'borderColor' => 'FFFFFF',
                'cellMargin' => 50,
                'alignment' => 'center',
            ]);
            
            $headerTable->addRow();
            
            // base_path() returns server directory, so we need to go up one level to project root
            $projectRoot = dirname(base_path()); // Go up from server/ to project root
            
            // Helper function to find and add logo
            $addLogo = function($cell, $filename) use ($projectRoot) {
                $possiblePaths = [
                    $projectRoot . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $filename,
                    $projectRoot . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . ucfirst(strtolower($filename)),
                    base_path('..' . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $filename),
                    base_path('..' . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . ucfirst(strtolower($filename))),
                ];
                
                $logoPath = null;
                foreach ($possiblePaths as $path) {
                    $normalizedPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
                    if (file_exists($normalizedPath) && is_file($normalizedPath)) {
                        $logoPath = $normalizedPath;
                        break;
                    }
                }
                
                if ($logoPath && file_exists($logoPath)) {
                    try {
                        $absolutePath = realpath($logoPath);
                        if (!$absolutePath) {
                            $absolutePath = $logoPath;
                        }
                        $cell->addImage($absolutePath, [
                            'width' => 80,
                            'height' => 80,
                            'wrappingStyle' => 'inline',
                        ]);
                    } catch (\Exception $e) {
                        \Log::error('Could not add logo to report: ' . $e->getMessage(), [
                            'filename' => $filename,
                            'path' => $logoPath
                        ]);
                    }
                }
            };
            
            // Left cell - School logo (logo-black.png)
            $leftLogoCell = $headerTable->addCell(2000, ['valign' => 'top', 'alignment' => 'center']);
            $addLogo($leftLogoCell, 'logo-black.png');
            
            // Center cell - System information
            $infoCell = $headerTable->addCell(6000, ['valign' => 'top']);
            $infoCell->addText('PROPERTY INVENTORY', [
                'bold' => true,
                'size' => 16,
                'color' => '000000'
            ], ['alignment' => 'center']);
            $infoCell->addText('MANAGEMENT SYSTEM', [
                'bold' => true,
                'size' => 16,
                'color' => '000000'
            ], ['alignment' => 'center']);
            $infoCell->addText('Lawa-an Integrated School', [
                'italic' => true,
                'size' => 11,
                'color' => '666666'
            ], ['alignment' => 'center']);
            $infoCell->addTextBreak(1);
            $infoCell->addText($title, [
                'bold' => true,
                'size' => 14,
                'color' => '000000'
            ], ['alignment' => 'center']);
            
            // Right cell - PIMS logo (PIMS-LOGO-BLACK.png)
            $rightLogoCell = $headerTable->addCell(2000, ['valign' => 'top', 'alignment' => 'center']);
            $addLogo($rightLogoCell, 'PIMS-LOGO-BLACK.png');
            
            $section->addTextBreak(1);
            
            // Add date range (centered, below title)
            $section->addText(
                'Date Range: ' . date('F d, Y', strtotime($startDate)) . ' to ' . date('F d, Y', strtotime($endDate)),
                ['size' => 11, 'italic' => true, 'color' => '000000'],
                ['alignment' => 'center']
            );
            $section->addTextBreak(1);

            // Add generated date (centered) - Use Asia/Manila timezone
            $timezone = 'Asia/Manila';
            $now = new \DateTime('now', new \DateTimeZone($timezone));
            $section->addText(
                'Generated on: ' . $now->format('F d, Y \a\t g:i A'),
                ['size' => 11, 'color' => '000000', 'italic' => true],
                ['alignment' => 'center']
            );
            $section->addTextBreak(2);

            // Add table with data
            if (isset($docData['data']) && count($docData['data']) > 0) {
                $this->addReportTable($section, $docData['report_type'], $docData['data']);
            } else {
                $section->addText('No data available for the selected date range.', [
                    'italic' => true,
                    'color' => '999999'
                ]);
                $section->addTextBreak(1);
            }

            // Add summary
            $section->addTextBreak(2);
            $section->addText(
                'Total Records: ' . (isset($docData['data']) ? count($docData['data']) : 0),
                ['size' => 10, 'bold' => true]
            );
            
            // Add "Approved by" section on a NEW PAGE
            // Create a new section (which automatically starts a new page)
            $approvalSection = $phpWord->addSection([
                'marginTop' => 1440,
                'marginBottom' => 1440,
                'marginLeft' => 1440,
                'marginRight' => 1440,
            ]);
            
            // Add spacing at the top of the approval page
            $approvalSection->addTextBreak(8);
            
            // Add "Approved by" title
            $approvalSection->addText('Approved by:', [
                'bold' => true,
                'size' => 14,
                'color' => '000000'
            ], ['alignment' => 'center']);
            $approvalSection->addTextBreak(4);
            
            // Create table for signatures
            $signatureTable = $approvalSection->addTable([
                'borderSize' => 0,
                'borderColor' => 'FFFFFF',
                'cellMargin' => 50,
            ]);
            
            $signatureTable->addRow();
            
            // Left signature - School Principal
            $leftCell = $signatureTable->addCell(5000, ['valign' => 'top']);
            $leftCell->addText('_________________________', [
                'size' => 11,
                'color' => '000000'
            ], ['alignment' => 'center']);
            $leftCell->addTextBreak(1);
            $leftCell->addText('MR. TOMAS S. HUPEDA', [
                'bold' => true,
                'size' => 12,
                'color' => '000000'
            ], ['alignment' => 'center']);
            $leftCell->addTextBreak(1);
            $leftCell->addText('School Principal', [
                'italic' => true,
                'size' => 11,
                'color' => '000000'
            ], ['alignment' => 'center']);
            
            // Right signature - Custodian
            $rightCell = $signatureTable->addCell(5000, ['valign' => 'top']);
            $rightCell->addText('_________________________', [
                'size' => 11,
                'color' => '000000'
            ], ['alignment' => 'center']);
            $rightCell->addTextBreak(1);
            $rightCell->addText('MS. LORELI ANN G. BARROA', [
                'bold' => true,
                'size' => 12,
                'color' => '000000'
            ], ['alignment' => 'center']);
            $rightCell->addTextBreak(1);
            $rightCell->addText('Custodian', [
                'italic' => true,
                'size' => 11,
                'color' => '000000'
            ], ['alignment' => 'center']);

            // Create temporary file
            $tempDir = sys_get_temp_dir();
            if (!is_writable($tempDir)) {
                \Log::error('Temporary directory is not writable', ['tempDir' => $tempDir]);
                throw new \Exception('Server configuration error: Cannot write temporary files.');
            }
            
            $tempFile = $tempDir . DIRECTORY_SEPARATOR . 'report_' . uniqid() . '_' . time() . '.docx';
            
            \Log::info('Saving DOCX file', ['tempFile' => $tempFile]);
            
            // Save document
            try {
                $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
                $objWriter->save($tempFile);
            } catch (\Exception $e) {
                \Log::error('Error saving DOCX file', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'tempFile' => $tempFile
                ]);
                throw new \Exception('Failed to save DOCX file: ' . $e->getMessage());
            }

            // Verify file was created
            if (!file_exists($tempFile)) {
                \Log::error('DOCX file was not created', ['tempFile' => $tempFile]);
                throw new \Exception('Failed to generate DOCX file. File was not created.');
            }
            
            $fileSize = filesize($tempFile);
            if ($fileSize === 0 || $fileSize === false) {
                \Log::error('DOCX file is empty', ['tempFile' => $tempFile, 'fileSize' => $fileSize]);
                @unlink($tempFile);
                throw new \Exception('Failed to generate DOCX file. File is empty.');
            }

            \Log::info('DOCX file generated successfully', [
                'tempFile' => $tempFile,
                'fileSize' => $fileSize
            ]);

            return $tempFile;

        } catch (\Exception $e) {
            \Log::error('Error in generateDocxWithTable', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Generate Excel file (XLSX) with table - Print-ready and suitable for official submission
     * 
     * @param string $title
     * @param array $docData
     * @param string $startDate
     * @param string $endDate
     * @return string Path to generated file
     * @throws \Exception
     */
    private function generateExcelWithTable(string $title, array $docData, string $startDate, string $endDate): string
    {
        try {
            // Check if PhpSpreadsheet is available
            if (!class_exists('PhpOffice\PhpSpreadsheet\Spreadsheet')) {
                throw new \Exception('PhpSpreadsheet library not installed. Please run: composer require phpoffice/phpspreadsheet');
            }

            \Log::info('Starting Excel generation', [
                'title' => $title,
                'report_type' => $docData['report_type'] ?? 'unknown',
                'data_count' => count($docData['data'] ?? [])
            ]);

            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();

            // Set document properties
            $spreadsheet->getProperties()
                ->setCreator('Property Inventory Management System')
                ->setCompany('Lawa-an Integrated School')
                ->setTitle($title)
                ->setDescription('Generated report: ' . $title)
                ->setCategory('Reports');

            // Configure page setup for printing (A4, Portrait, 1 inch margins)
            $sheet->getPageSetup()
                ->setOrientation(PageSetup::ORIENTATION_PORTRAIT)
                ->setPaperSize(PageSetup::PAPERSIZE_A4)
                ->setFitToWidth(1)
                ->setFitToHeight(0);

            // Set margins (1 inch = 0.393701 cm, Excel uses cm)
            $sheet->getPageMargins()
                ->setTop(2.54)      // 1 inch
                ->setBottom(2.54)   // 1 inch
                ->setLeft(2.54)     // 1 inch
                ->setRight(2.54)    // 1 inch
                ->setHeader(1.27)   // 0.5 inch
                ->setFooter(1.27);  // 0.5 inch

            // Enable gridlines for printing
            $sheet->setShowGridlines(true);
            // Note: setPrintGridlines() is not available in all PhpSpreadsheet versions
            // Gridlines will still print if setShowGridlines is true

            // Set print area (will be adjusted after adding content)
            $currentRow = 1;

            // Add logos to header (similar to DOCX)
            $projectRoot = dirname(base_path());
            $logoRow = $currentRow;
            
            // Left logo (logo-black.png)
            $leftLogoPath = null;
            $possibleLeftPaths = [
                $projectRoot . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'logo-black.png',
                $projectRoot . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'Logo-black.png',
            ];
            foreach ($possibleLeftPaths as $path) {
                $normalizedPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
                if (file_exists($normalizedPath) && is_file($normalizedPath)) {
                    $leftLogoPath = $normalizedPath;
                    break;
                }
            }
            
            if ($leftLogoPath && file_exists($leftLogoPath)) {
                try {
                    $drawing = new Drawing();
                    $drawing->setName('School Logo');
                    $drawing->setDescription('School Logo');
                    $drawing->setPath($leftLogoPath);
                    $drawing->setHeight(80);
                    $drawing->setWidth(80);
                    $drawing->setCoordinates('A' . $logoRow);
                    $drawing->setOffsetX(10);
                    $drawing->setOffsetY(10);
                    $drawing->setWorksheet($sheet);
                } catch (\Exception $e) {
                    \Log::error('Could not add left logo to Excel: ' . $e->getMessage());
                }
            }
            
            // Right logo (PIMS-LOGO-BLACK.png)
            $rightLogoPath = null;
            $possibleRightPaths = [
                $projectRoot . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'PIMS-LOGO-BLACK.png',
                $projectRoot . DIRECTORY_SEPARATOR . 'client' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'pims-logo-black.png',
            ];
            foreach ($possibleRightPaths as $path) {
                $normalizedPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
                if (file_exists($normalizedPath) && is_file($normalizedPath)) {
                    $rightLogoPath = $normalizedPath;
                    break;
                }
            }
            
            if ($rightLogoPath && file_exists($rightLogoPath)) {
                try {
                    $drawing = new Drawing();
                    $drawing->setName('PIMS Logo');
                    $drawing->setDescription('PIMS Logo');
                    $drawing->setPath($rightLogoPath);
                    $drawing->setHeight(80);
                    $drawing->setWidth(80);
                    // Place in column H (right side)
                    $drawing->setCoordinates('H' . $logoRow);
                    $drawing->setOffsetX(10);
                    $drawing->setOffsetY(10);
                    $drawing->setWorksheet($sheet);
                } catch (\Exception $e) {
                    \Log::error('Could not add right logo to Excel: ' . $e->getMessage());
                }
            }
            
            // Set row height for logo row
            $sheet->getRowDimension($logoRow)->setRowHeight(90);
            
            // Add header information (centered in columns B-G)
            $currentRow = $logoRow;
            $sheet->setCellValue('B' . $currentRow, 'PROPERTY INVENTORY');
            $sheet->mergeCells('B' . $currentRow . ':G' . $currentRow);
            $sheet->getStyle('B' . $currentRow)->getFont()->setBold(true)->setSize(16);
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow++;

            $sheet->setCellValue('B' . $currentRow, 'MANAGEMENT SYSTEM');
            $sheet->mergeCells('B' . $currentRow . ':G' . $currentRow);
            $sheet->getStyle('B' . $currentRow)->getFont()->setBold(true)->setSize(16);
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow++;

            $sheet->setCellValue('B' . $currentRow, 'Lawa-an Integrated School');
            $sheet->mergeCells('B' . $currentRow . ':G' . $currentRow);
            $sheet->getStyle('B' . $currentRow)->getFont()->setItalic(true)->setSize(11);
            $sheet->getStyle('B' . $currentRow)->getFont()->getColor()->setRGB('666666');
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow += 2;

            // Add report title
            $sheet->setCellValue('B' . $currentRow, $title);
            $sheet->mergeCells('B' . $currentRow . ':G' . $currentRow);
            $sheet->getStyle('B' . $currentRow)->getFont()->setBold(true)->setSize(14);
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow += 2;

            // Add date range
            $dateRange = 'Date Range: ' . date('F d, Y', strtotime($startDate)) . ' to ' . date('F d, Y', strtotime($endDate));
            $sheet->setCellValue('B' . $currentRow, $dateRange);
            $sheet->mergeCells('B' . $currentRow . ':G' . $currentRow);
            $sheet->getStyle('B' . $currentRow)->getFont()->setItalic(true)->setSize(11);
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow++;

            // Add generated date
            $timezone = 'Asia/Manila';
            $now = new \DateTime('now', new \DateTimeZone($timezone));
            $generatedDate = 'Generated on: ' . $now->format('F d, Y \a\t g:i A');
            $sheet->setCellValue('B' . $currentRow, $generatedDate);
            $sheet->mergeCells('B' . $currentRow . ':G' . $currentRow);
            $sheet->getStyle('B' . $currentRow)->getFont()->setItalic(true)->setSize(11);
            $sheet->getStyle('B' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow += 2;

            // Get headers and column keys
            $headers = $docData['headers'] ?? $this->getReportHeaders($docData['report_type']);
            $columnKeys = $docData['column_keys'] ?? $this->getReportColumnKeys($docData['report_type']);
            $reportData = $docData['data'] ?? [];

            // Add table headers
            $headerRow = $currentRow;
            $col = 'A';
            foreach ($headers as $header) {
                $sheet->setCellValue($col . $currentRow, $header);
                $sheet->getStyle($col . $currentRow)->getFont()->setBold(true)->setSize(11);
                $sheet->getStyle($col . $currentRow)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setRGB('D3D3D3');
                $sheet->getStyle($col . $currentRow)->getAlignment()
                    ->setHorizontal(Alignment::HORIZONTAL_CENTER)
                    ->setVertical(Alignment::VERTICAL_CENTER);
                $sheet->getStyle($col . $currentRow)->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)
                    ->setColor(new Color('000000'));
                $col++;
            }
            $sheet->getRowDimension($currentRow)->setRowHeight(25);
            $currentRow++;

            // Add data rows
            $dataStartRow = $currentRow;
            foreach ($reportData as $row) {
                $col = 'A';
                foreach ($columnKeys as $key) {
                    $value = $row[$key] ?? 'N/A';
                    
                    // Format values
                    if ($value === null || $value === '') {
                        $value = 'N/A';
                    } elseif (is_numeric($value) && (strpos($key, 'price') !== false || strpos($key, 'cost') !== false)) {
                        $value = (float)$value; // Keep as number for Excel
                        $sheet->getStyle($col . $currentRow)->getNumberFormat()
                            ->setFormatCode('₱#,##0.00');
                    } elseif (strpos($key, 'date') !== false && $value !== 'N/A') {
                        try {
                            $dateValue = \PhpOffice\PhpSpreadsheet\Shared\Date::PHPToExcel(strtotime($value));
                            $value = $dateValue;
                            $sheet->getStyle($col . $currentRow)->getNumberFormat()
                                ->setFormatCode('mmm dd, yyyy');
                        } catch (\Exception $e) {
                            $value = (string)$value;
                        }
                    } else {
                        $value = (string)$value;
                    }

                    $sheet->setCellValue($col . $currentRow, $value);
                    $sheet->getStyle($col . $currentRow)->getBorders()->getAllBorders()
                        ->setBorderStyle(Border::BORDER_THIN)
                        ->setColor(new Color('000000'));
                    $sheet->getStyle($col . $currentRow)->getAlignment()
                        ->setVertical(Alignment::VERTICAL_CENTER);
                    
                    $col++;
                }
                $sheet->getRowDimension($currentRow)->setRowHeight(20);
                $currentRow++;
            }

            // Auto-size columns
            // Set fixed width for logo columns (A and H)
            $sheet->getColumnDimension('A')->setWidth(15); // Left logo column
            $sheet->getColumnDimension('H')->setWidth(15); // Right logo column
            
            // Auto-size other columns
            foreach (range('B', 'G') as $columnID) {
                $sheet->getColumnDimension($columnID)->setAutoSize(true);
                $sheet->getColumnDimension($columnID)->setWidth(max(10, $sheet->getColumnDimension($columnID)->getWidth()));
            }
            
            // Auto-size data columns beyond H if needed
            if (ord($col) > ord('H')) {
                foreach (range('I', $col) as $columnID) {
                    $sheet->getColumnDimension($columnID)->setAutoSize(true);
                    $sheet->getColumnDimension($columnID)->setWidth(max(10, $sheet->getColumnDimension($columnID)->getWidth()));
                }
            }

            // Add total records
            $currentRow += 2;
            $sheet->setCellValue('A' . $currentRow, 'Total Records: ' . count($reportData));
            $sheet->getStyle('A' . $currentRow)->getFont()->setBold(true)->setSize(10);
            $currentRow += 4;

            // Add "Approved by" section at the bottom of the main sheet
            $sheet->setCellValue('A' . $currentRow, 'Approved by:');
            $sheet->mergeCells('A' . $currentRow . ':H' . $currentRow);
            $sheet->getStyle('A' . $currentRow)->getFont()->setBold(true)->setSize(14);
            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow += 3;

            // Left signature
            $sheet->setCellValue('A' . $currentRow, '_________________________');
            $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'MR. TOMAS S. HUPEDA');
            $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
            $sheet->getStyle('A' . $currentRow)->getFont()->setBold(true)->setSize(12);
            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $currentRow++;
            $sheet->setCellValue('A' . $currentRow, 'School Principal');
            $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
            $sheet->getStyle('A' . $currentRow)->getFont()->setItalic(true)->setSize(11);
            $sheet->getStyle('A' . $currentRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            // Right signature (same row as left)
            $signatureStartRow = $currentRow - 2;
            $sheet->setCellValue('E' . $signatureStartRow, '_________________________');
            $sheet->mergeCells('E' . $signatureStartRow . ':H' . $signatureStartRow);
            $sheet->getStyle('E' . $signatureStartRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $signatureStartRow++;
            $sheet->setCellValue('E' . $signatureStartRow, 'MS. LORELI ANN G. BARROA');
            $sheet->mergeCells('E' . $signatureStartRow . ':H' . $signatureStartRow);
            $sheet->getStyle('E' . $signatureStartRow)->getFont()->setBold(true)->setSize(12);
            $sheet->getStyle('E' . $signatureStartRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $signatureStartRow++;
            $sheet->setCellValue('E' . $signatureStartRow, 'Custodian');
            $sheet->mergeCells('E' . $signatureStartRow . ':H' . $signatureStartRow);
            $sheet->getStyle('E' . $signatureStartRow)->getFont()->setItalic(true)->setSize(11);
            $sheet->getStyle('E' . $signatureStartRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

            // Set print area for main sheet (include approval section)
            $lastCol = chr(ord('A') + count($headers) - 1);
            $finalRow = max($currentRow, $signatureStartRow);
            $sheet->getPageSetup()->setPrintArea('A1:' . $lastCol . $finalRow);

            // Save to temporary file
            $tempFile = tempnam(sys_get_temp_dir(), 'report_') . '.xlsx';
            $writer = new Xlsx($spreadsheet);
            $writer->save($tempFile);

            \Log::info('Excel file generated successfully', [
                'tempFile' => $tempFile,
                'fileSize' => filesize($tempFile)
            ]);

            return $tempFile;

        } catch (\Exception $e) {
            \Log::error('Error in generateExcelWithTable', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Get column headers for report type
     * 
     * @param string $reportType
     * @return array
     */
    private function getReportHeaders(string $reportType): array
    {
        $headers = [
            'inventory' => ['ID', 'Item Name', 'Category', 'Quantity', 'Available', 'Location', 'Status', 'Purchase Price', 'Purchase Date'],
            'users' => ['ID', 'Name', 'Email', 'Role', 'Last Login', 'Status'],
            'requests' => ['ID', 'Teacher', 'Item', 'Quantity', 'Status', 'Request Date', 'Due Date'],
            'costs' => ['ID', 'Item Name', 'Category', 'Quantity', 'Unit Price', 'Total Cost', 'Purchase Date', 'Supplier'],
        ];
        
        return $headers[$reportType] ?? [];
    }

    /**
     * Get column keys for report type
     * 
     * @param string $reportType
     * @return array
     */
    private function getReportColumnKeys(string $reportType): array
    {
        $keys = [
            'inventory' => ['id', 'item_name', 'category', 'quantity', 'available', 'location', 'status', 'purchase_price', 'purchase_date'],
            'users' => ['id', 'name', 'email', 'role', 'last_login', 'status'],
            'requests' => ['id', 'teacher', 'item', 'quantity', 'status', 'request_date', 'due_date'],
            'costs' => ['id', 'item_name', 'category', 'quantity', 'unit_price', 'total_cost', 'purchase_date', 'supplier'],
        ];
        
        return $keys[$reportType] ?? [];
    }

    /**
     * Format report data for PDF table display
     * 
     * @param array $reportData
     * @param string $reportType
     * @return array
     */
    private function formatReportDataForTable(array $reportData, string $reportType): array
    {
        $columnKeys = $this->getReportColumnKeys($reportType);
        $formattedRows = [];

        foreach ($reportData as $row) {
            $formattedRow = [];
            foreach ($columnKeys as $key) {
                $value = $row[$key] ?? 'N/A';
                
                // Format values
                if ($value === null || $value === '') {
                    $value = 'N/A';
                } elseif (is_numeric($value) && (strpos($key, 'price') !== false || strpos($key, 'cost') !== false)) {
                    $value = '₱' . number_format((float)$value, 2);
                } elseif (strpos($key, 'date') !== false && $value !== 'N/A') {
                    try {
                        $value = date('M d, Y', strtotime($value));
                    } catch (\Exception $e) {
                        // Keep original value if date parsing fails
                    }
                } else {
                    $value = (string)$value;
                }
                
                $formattedRow[] = $value;
            }
            $formattedRows[] = $formattedRow;
        }

        return $formattedRows;
    }

    /**
     * Determine which columns should have totals calculated
     * Returns array of column indices that are numeric and should be totaled
     * 
     * @param array $columnKeys
     * @param string $reportType
     * @return array Array of column indices to total
     */
    private function getTotalableColumns(array $columnKeys, string $reportType): array
    {
        $totalableIndices = [];
        
        foreach ($columnKeys as $index => $key) {
            // Skip ID, dates, and text fields
            if ($key === 'id' || strpos($key, 'date') !== false || strpos($key, 'name') !== false || 
                strpos($key, 'email') !== false || strpos($key, 'role') !== false || 
                strpos($key, 'status') !== false || strpos($key, 'location') !== false ||
                strpos($key, 'category') !== false || strpos($key, 'teacher') !== false ||
                strpos($key, 'item') !== false || strpos($key, 'supplier') !== false ||
                strpos($key, 'last_login') !== false) {
                continue;
            }
            
            // Include numeric fields: quantity, available, price, cost
            if (strpos($key, 'quantity') !== false || strpos($key, 'available') !== false ||
                strpos($key, 'price') !== false || strpos($key, 'cost') !== false) {
                $totalableIndices[] = $index;
            }
        }
        
        return $totalableIndices;
    }

    /**
     * Format a total value based on column type
     * 
     * @param mixed $value
     * @param string $columnKey
     * @return string Formatted value
     */
    private function formatTotalValue($value, string $columnKey): string
    {
        if (!is_numeric($value)) {
            return '-';
        }
        
        // Format currency for price/cost columns
        if (strpos($columnKey, 'price') !== false || strpos($columnKey, 'cost') !== false) {
            return '₱' . number_format((float)$value, 2);
        }
        
        // Format numeric values (quantities, available) with 2 decimal places if needed
        $floatValue = (float)$value;
        if ($floatValue == (int)$floatValue) {
            return number_format($floatValue, 0);
        }
        
        return number_format($floatValue, 2);
    }

    private function addReportTable($section, $reportType, $reportData)
    {
        try {
            // Define column headers based on report type
            $columnHeaders = [];
            $columnKeys = [];

            switch ($reportType) {
                case 'inventory':
                    $columnHeaders = ['ID', 'Item Name', 'Category', 'Quantity', 'Available', 'Location', 'Status', 'Purchase Price', 'Purchase Date'];
                    $columnKeys = ['id', 'item_name', 'category', 'quantity', 'available', 'location', 'status', 'purchase_price', 'purchase_date'];
                    break;
                case 'users':
                    $columnHeaders = ['ID', 'Name', 'Email', 'Role', 'Last Login', 'Status'];
                    $columnKeys = ['id', 'name', 'email', 'role', 'last_login', 'status'];
                    break;
                case 'requests':
                    $columnHeaders = ['ID', 'Teacher', 'Item', 'Quantity', 'Status', 'Request Date', 'Due Date'];
                    $columnKeys = ['id', 'teacher', 'item', 'quantity', 'status', 'request_date', 'due_date'];
                    break;
                case 'costs':
                    $columnHeaders = ['ID', 'Item Name', 'Category', 'Quantity', 'Unit Price', 'Total Cost', 'Purchase Date', 'Supplier'];
                    $columnKeys = ['id', 'item_name', 'category', 'quantity', 'unit_price', 'total_cost', 'purchase_date', 'supplier'];
                    break;
            }

            if (empty($columnHeaders)) {
                return;
            }

            // Identify which columns should be totaled
            $totalableIndices = $this->getTotalableColumns($columnKeys, $reportType);
            
            // Initialize totals array
            $totals = [];
            foreach ($totalableIndices as $index) {
                $totals[$index] = 0;
            }

            // Create table
            $table = $section->addTable([
                'borderSize' => 6,
                'borderColor' => '000000',
                'cellMargin' => 80,
            ]);

            // Add header row
            $table->addRow(400);
            foreach ($columnHeaders as $header) {
                $cell = $table->addCell(2000, [
                    'bgColor' => 'D3D3D3',
                    'valign' => 'center'
                ]);
                $cell->addText($header, ['bold' => true, 'size' => 11]);
            }

            // Add data rows and calculate totals
            foreach ($reportData as $row) {
                $table->addRow(300);
                foreach ($columnKeys as $index => $key) {
                    $value = $row[$key] ?? 'N/A';
                    
                    // Calculate totals for numeric columns
                    if (in_array($index, $totalableIndices) && is_numeric($value)) {
                        try {
                            $totals[$index] += (float)$value;
                        } catch (\Exception $e) {
                            \Log::warning('Error calculating total for column', [
                                'column' => $key,
                                'value' => $value,
                                'error' => $e->getMessage()
                            ]);
                        }
                    }
                    
                    // Format values for display
                    if ($value === null || $value === '') {
                        $value = 'N/A';
                    } elseif (is_numeric($value) && (strpos($key, 'price') !== false || strpos($key, 'cost') !== false)) {
                        $value = '₱' . number_format((float)$value, 2);
                    } elseif (strpos($key, 'date') !== false && $value !== 'N/A') {
                        try {
                            $value = date('M d, Y', strtotime($value));
                        } catch (\Exception $e) {
                            // Keep original value if date parsing fails
                        }
                    } else {
                        $value = (string)$value;
                    }

                    $cell = $table->addCell(2000);
                    $cell->addText($value, ['size' => 10]);
                }
            }

            // Add totals row if there are totalable columns and data exists
            if (!empty($totalableIndices) && count($reportData) > 0) {
                $table->addRow(350); // Slightly taller row for totals
                
                // Common cell style for totals row (light gray background)
                $totalsRowCellStyle = [
                    'bgColor' => 'E8E8E8', // Light gray background for totals row
                    'valign' => 'center'
                ];
                
                foreach ($columnKeys as $index => $key) {
                    if (in_array($index, $totalableIndices)) {
                        // Format and display total value for numeric columns
                        $totalValue = $this->formatTotalValue($totals[$index], $key);
                        
                        $cell = $table->addCell(2000, $totalsRowCellStyle);
                        $cell->addText($totalValue, [
                            'bold' => true,
                            'size' => 11,
                            'color' => '000000'
                        ]);
                    } else {
                        // For non-totalable columns, show "TOTAL" label in first column or empty
                        if ($index === 0) {
                            $cell = $table->addCell(2000, $totalsRowCellStyle);
                            $cell->addText('TOTAL', [
                                'bold' => true,
                                'size' => 11,
                                'color' => '000000'
                            ]);
                        } else {
                            $cell = $table->addCell(2000, $totalsRowCellStyle);
                            $cell->addText('', ['size' => 10]);
                        }
                    }
                }
            }

        } catch (\Exception $e) {
            \Log::error('Error adding report table', [
                'report_type' => $reportType,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw new \Exception('Failed to generate report table: ' . $e->getMessage());
        }
    }
}
