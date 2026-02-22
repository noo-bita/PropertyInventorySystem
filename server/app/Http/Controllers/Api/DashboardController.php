<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\ItemRequest;
use App\Models\User;
use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class DashboardController extends Controller
{
    /**
     * Get admin dashboard statistics and data
     *
     * Returns aggregated data for admin dashboard including:
     * - Total items count
     * - Pending requests count
     * - Total users count
     * - Available items sum
     * - Recent activity (requests and reports)
     * - Full data arrays for charts
     */
    public function admin(Request $request): JsonResponse
    {
        try {
            // Optimized queries - fetch only what's needed
            $totalItems = InventoryItem::count();
            $availableItems = InventoryItem::sum('available');
            $pendingRequests = ItemRequest::whereIn('status', ['pending', 'under_review'])->count();
            $pendingInspection = ItemRequest::where('status', 'returned_pending_inspection')
                ->where('inspection_status', 'pending')
                ->count();
            $totalUsers = User::count();

            // Get recent activity (last 10 items)
            $recentRequests = ItemRequest::orderByDesc('created_at')
                ->limit(5)
                ->get(['id', 'request_type', 'teacher_name', 'created_at'])
                ->map(function ($req) {
                    return [
                        'type' => 'request',
                        'icon' => 'bi-file-earmark-text',
                        'color' => '#3182ce',
                        'text' => "New " . ($req->request_type ?? 'item') . " request from {$req->teacher_name}",
                        'time' => $req->created_at->toDateTimeString()
                    ];
                });

            $recentReports = Report::orderByDesc('created_at')
                ->limit(3)
                ->get(['id', 'notes', 'created_at'])
                ->map(function ($report) {
                    $reportType = 'Other';
                    if (stripos($report->notes ?? '', 'MISSING') !== false) {
                        $reportType = 'Missing';
                    } elseif (stripos($report->notes ?? '', 'DAMAGED') !== false) {
                        $reportType = 'Damaged';
                    }
                    return [
                        'type' => 'report',
                        'icon' => 'bi-exclamation-triangle',
                        'color' => '#e53e3e',
                        'text' => "New report: {$reportType} item",
                        'time' => $report->created_at->toDateTimeString()
                    ];
                });

            // Combine and sort by time
            $recentActivity = $recentRequests->concat($recentReports)
                ->sortByDesc('time')
                ->take(10)
                ->values()
                ->toArray();

            // Get full data for charts (only if needed - can be optimized further)
            $requestsData = ItemRequest::orderByDesc('created_at')->get();
            $reportsData = Report::orderByDesc('created_at')->get();
            $inventoryData = InventoryItem::all();

            return response()->json([
                'totalItems' => $totalItems,
                'pendingRequests' => $pendingRequests,
                'pendingInspection' => $pendingInspection,
                'totalUsers' => $totalUsers,
                'availableItems' => $availableItems,
                'recentActivity' => $recentActivity,
                'requestsData' => $requestsData,
                'reportsData' => $reportsData,
                'inventoryData' => $inventoryData
            ], 200);

        } catch (\Exception $e) {
            Log::error('Dashboard admin error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch dashboard data',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get teacher dashboard statistics and data
     *
     * Returns teacher-specific data including:
     * - Assigned items count
     * - Pending requests count (teacher's own)
     * - Approved requests count (teacher's own)
     * - Items due soon count
     * - Recent activity (teacher's own requests)
     */
    public function teacher(Request $request): JsonResponse
    {
        try {
            $teacherName = $request->query('teacher_name');

            if (!$teacherName) {
                return response()->json([
                    'error' => 'Teacher name is required'
                ], 400);
            }

            // Get teacher's requests
            $myRequests = ItemRequest::where('teacher_name', $teacherName)
                ->orderByDesc('created_at')
                ->get();

            // Get teacher's assigned items
            $myAssignedItems = $myRequests->filter(function ($req) {
                return in_array($req->status, ['assigned', 'returned']);
            });

            // Calculate metrics
            $assignedItemsCount = $myAssignedItems->where('status', 'assigned')->count();

            $pendingRequestsCount = $myRequests->filter(function ($req) {
                return in_array($req->status, ['pending', 'under_review']);
            })->count();

            $approvedRequestsCount = $myRequests->filter(function ($req) {
                return in_array($req->status, ['approved', 'assigned']);
            })->count();

            // Calculate items due soon (within 3 days)
            $now = now();
            $threeDaysFromNow = $now->copy()->addDays(3);
            $itemsDueSoon = $myAssignedItems->filter(function ($item) use ($now, $threeDaysFromNow) {
                if (!$item->due_date || $item->status !== 'assigned') {
                    return false;
                }
                // due_date is already a Carbon instance from the model cast
                $dueDate = $item->due_date;
                return $dueDate->lte($threeDaysFromNow) && $dueDate->gte($now);
            })->count();

            // Get recent activity (teacher's own requests)
            $recentActivity = $myRequests
                ->take(10)
                ->map(function ($req) {
                    $icon = 'bi-file-earmark-text';
                    $color = '#3182ce';
                    $text = '';

                    if (in_array($req->status, ['approved', 'assigned'])) {
                        $icon = 'bi-check-circle';
                        $color = '#10b981';
                        $text = "Your request for {$req->item_name} was " . ($req->status === 'assigned' ? 'assigned' : 'approved');
                    } elseif (in_array($req->status, ['pending', 'under_review'])) {
                        $icon = 'bi-clock';
                        $color = '#f59e0b';
                        $text = "Your request for {$req->item_name} is " . ($req->status === 'under_review' ? 'under review' : 'pending');
                    } elseif ($req->status === 'rejected') {
                        $icon = 'bi-x-circle';
                        $color = '#ef4444';
                        $text = "Your request for {$req->item_name} was rejected";
                    } else {
                        $text = "Request for {$req->item_name} - {$req->status}";
                    }

                    return [
                        'type' => 'request',
                        'icon' => $icon,
                        'color' => $color,
                        'text' => $text,
                        'time' => $req->created_at->toDateTimeString()
                    ];
                })
                ->values()
                ->toArray();

            return response()->json([
                'assignedItemsCount' => $assignedItemsCount,
                'pendingRequestsCount' => $pendingRequestsCount,
                'approvedRequestsCount' => $approvedRequestsCount,
                'itemsDueSoon' => $itemsDueSoon,
                'recentActivity' => $recentActivity,
                'myRequests' => $myRequests,
                'myAssignedItems' => $myAssignedItems
            ], 200);

        } catch (\Exception $e) {
            Log::error('Dashboard teacher error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to fetch teacher dashboard data',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}

