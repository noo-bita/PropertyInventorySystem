<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogService
{
    /**
     * Log an activity
     */
    public static function log(
        string $action,
        string $module,
        string $description,
        ?int $userId = null,
        ?string $userName = null,
        ?string $userRole = null,
        ?string $affectedItem = null,
        ?int $affectedItemId = null,
        ?array $metadata = null,
        ?Request $request = null
    ): ActivityLog {
        // Get request info if available
        $ipAddress = $request ? $request->ip() : null;
        $userAgent = $request ? $request->userAgent() : null;

        // Get user info from request if not provided
        if ($request && !$userId) {
            $user = $request->user();
            if ($user) {
                $userId = $user->id;
                $userName = $user->first_name . ' ' . $user->last_name;
                $userRole = $user->role;
            }
        }

        return ActivityLog::create([
            'user_id' => $userId,
            'user_name' => $userName,
            'user_role' => $userRole,
            'action' => $action,
            'module' => $module,
            'description' => $description,
            'affected_item' => $affectedItem,
            'affected_item_id' => $affectedItemId,
            'metadata' => $metadata,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
        ]);
    }

    /**
     * Log user authentication events
     */
    public static function logAuth(string $action, string $email, ?string $userName = null, ?string $userRole = null, ?Request $request = null): void
    {
        self::log(
            $action,
            'auth',
            "User {$action}: {$email}",
            null,
            $userName,
            $userRole,
            $email,
            null,
            null,
            $request
        );
    }

    /**
     * Log inventory operations
     */
    public static function logInventory(string $action, string $itemName, ?int $itemId = null, ?Request $request = null): void
    {
        self::log(
            $action,
            'inventory',
            "Item {$action}: {$itemName}",
            null,
            null,
            null,
            $itemName,
            $itemId,
            null,
            $request
        );
    }

    /**
     * Log request operations
     */
    public static function logRequest(string $action, string $description, ?int $requestId = null, ?Request $request = null): void
    {
        self::log(
            $action,
            'request',
            $description,
            null,
            null,
            null,
            "Request #{$requestId}",
            $requestId,
            null,
            $request
        );
    }

    /**
     * Log report operations
     */
    public static function logReport(string $action, string $description, ?int $reportId = null, ?Request $request = null): void
    {
        self::log(
            $action,
            'report',
            $description,
            null,
            null,
            null,
            "Report #{$reportId}",
            $reportId,
            null,
            $request
        );
    }

    /**
     * Log user management operations
     */
    public static function logUser(string $action, string $description, ?int $userId = null, ?string $userEmail = null, ?Request $request = null): void
    {
        self::log(
            $action,
            'user',
            $description,
            null,
            null,
            null,
            $userEmail,
            $userId,
            null,
            $request
        );
    }
}


