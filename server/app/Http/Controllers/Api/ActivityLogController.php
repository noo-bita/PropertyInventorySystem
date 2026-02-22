<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ActivityLogController extends Controller
{
    /**
     * Get activity logs with filtering, sorting, and pagination
     * Admin only
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = ActivityLog::query();

            // Filter by module
            if ($request->has('module') && $request->module) {
                $query->where('module', $request->module);
            }

            // Filter by action
            if ($request->has('action') && $request->action) {
                $query->where('action', $request->action);
            }

            // Filter by user
            if ($request->has('user_id') && $request->user_id) {
                $query->where('user_id', $request->user_id);
            }

            // Filter by date range
            if ($request->has('start_date') && $request->start_date) {
                $query->whereDate('created_at', '>=', $request->start_date);
            }
            if ($request->has('end_date') && $request->end_date) {
                $query->whereDate('created_at', '<=', $request->end_date);
            }

            // Search in description
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('description', 'LIKE', "%{$search}%")
                      ->orWhere('user_name', 'LIKE', "%{$search}%")
                      ->orWhere('affected_item', 'LIKE', "%{$search}%");
                });
            }

            // Sorting
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Pagination
            $perPage = $request->get('per_page', 20);
            $logs = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $logs->items(),
                'pagination' => [
                    'current_page' => $logs->currentPage(),
                    'last_page' => $logs->lastPage(),
                    'per_page' => $logs->perPage(),
                    'total' => $logs->total(),
                ]
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Activity log fetch error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch activity logs',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available filter options (modules, actions, users)
     */
    public function getFilterOptions(): JsonResponse
    {
        try {
            $modules = ActivityLog::distinct()->pluck('module')->sort()->values();
            $actions = ActivityLog::distinct()->pluck('action')->sort()->values();
            $users = ActivityLog::whereNotNull('user_id')
                ->distinct()
                ->select('user_id', 'user_name', 'user_role')
                ->get()
                ->map(function($log) {
                    return [
                        'id' => $log->user_id,
                        'name' => $log->user_name,
                        'role' => $log->user_role
                    ];
                })
                ->unique('id')
                ->values();

            return response()->json([
                'success' => true,
                'modules' => $modules,
                'actions' => $actions,
                'users' => $users
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Activity log filter options error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch filter options'
            ], 500);
        }
    }
}


