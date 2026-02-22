<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class UsersController extends Controller
{
    public function __construct()
    {
        // Handle CORS preflight requests
        if (request()->isMethod('OPTIONS')) {
            header('Access-Control-Allow-Origin: *');
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
            exit(0);
        }
    }


    /**
     * Test method to check if the API is working.
     */
    public function test()
    {
        return response()->json(['message' => 'Users API is working!'])->header('Access-Control-Allow-Origin', '*');
    }

    /**
     * Basic login endpoint (email + password) returning user info and role.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string'
        ]);

        $user = User::where('email', $request->email)->first();
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        // Generate a token and attach to user
        $token = bin2hex(random_bytes(30));
        $user->api_token = $token;
        $user->save();

        $userData = $user->toArray();
        if ($user->photo_path) {
            $userData['profile_photo_url'] = 'http://127.0.0.1:8000/' . $user->photo_path;
        } else {
            $userData['profile_photo_url'] = '';
        }

        // Log login activity
        ActivityLogService::logAuth(
            'login',
            $user->email,
            $user->first_name . ' ' . $user->last_name,
            $user->role,
            $request
        );

        // Note: For simplicity we are not issuing JWT; frontend will store user in localStorage
        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->first_name . ' ' . $user->last_name,
                'email' => $user->email,
                'role' => $user->role,
                'profile_photo_url' => $userData['profile_photo_url']
            ],
            'token' => $token
        ]);
    }

    /**
     * Logout: invalidate token
     */
    public function logout(Request $request)
    {
        $token = $request->header('Authorization');
        if ($token && str_starts_with($token, 'Bearer ')) {
            $token = substr($token, 7);
        }
        if ($token) {
            $user = User::where('api_token', $token)->first();
            if ($user) {
                // Log logout activity
                ActivityLogService::logAuth(
                    'logout',
                    $user->email,
                    $user->first_name . ' ' . $user->last_name,
                    $user->role,
                    $request
                );
                
                $user->api_token = null;
                $user->save();
            }
        }
        return response()->json(['message' => 'Logged out']);
    }

    /**
     * Display a listing of the resource.
     */
            public function index()
    {
        $users = User::whereNull('deleted_at')->get();

        // Transform users to include profile_photo_url
        $usersWithPhotoUrl = $users->map(function ($user) {
            $userData = $user->toArray();
            // Construct profile_photo_url directly
            if ($user->photo_path) {
                $userData['profile_photo_url'] = 'http://127.0.0.1:8000/' . $user->photo_path;
            } else {
                $userData['profile_photo_url'] = '';
            }
            return $userData;
        });

        return response()->json($usersWithPhotoUrl)->header('Access-Control-Allow-Origin', '*');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        try {
            // Log the incoming request data for debugging
            Log::info('User creation request received', [
                'request_data' => $request->all(),
                'files' => $request->file('photo') ? 'Photo file present' : 'No photo file'
            ]);

            $request->validate([
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'middle_name' => 'nullable|string|max:255',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:8|confirmed',
                'role' => 'required|in:ADMIN,TEACHER',
                'contact_number' => 'nullable|string|max:20',
                'address' => 'nullable|string|max:500',
                'birthday' => 'nullable|date',
                'photo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
            ]);

            $userData = $request->except(['photo', 'password_confirmation']);
            $userData['password'] = Hash::make($request->password);

            // Handle photo upload
            if ($request->file('photo')) {
                $photo = $request->file('photo');
                $photoName = time() . '_' . $photo->getClientOriginalName();
                $photoPath = 'uploads/' . $photoName;

                // Move to public/uploads folder
                $photo->move(public_path('uploads'), $photoName);
                $userData['photo_path'] = $photoPath;

                // Debug logging
                Log::info('Photo uploaded successfully', [
                    'photo_name' => $photoName,
                    'photo_path' => $photoPath,
                    'full_path' => public_path('uploads/' . $photoName)
                ]);
            }

            $user = User::create($userData);

            Log::info('User created successfully', ['user_id' => $user->id, 'email' => $user->email]);

            // Log activity
            ActivityLogService::logUser(
                'created',
                "User created: {$user->email} ({$user->role})",
                $user->id,
                $user->email,
                $request
            );

            return response()->json($user, 201)->header('Access-Control-Allow-Origin', '*');
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Validation error in user creation', [
                'errors' => $e->errors(),
                'request_data' => $request->all()
            ]);
            return response()->json(['errors' => $e->errors()], 422)->header('Access-Control-Allow-Origin', '*');
        } catch (\Exception $e) {
            Log::error('Error creating user', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            return response()->json(['error' => 'Failed to create user: ' . $e->getMessage()], 500)->header('Access-Control-Allow-Origin', '*');
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(User $user)
    {
        $userData = $user->toArray();
        // Construct profile_photo_url directly
        if ($user->photo_path) {
            $userData['profile_photo_url'] = 'http://127.0.0.1:8000/' . $user->photo_path;
        } else {
            $userData['profile_photo_url'] = '';
        }
        return response()->json($userData);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $user)
    {
        $validationRules = [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'role' => 'required|in:ADMIN,TEACHER',
            'contact_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'birthday' => 'nullable|date',
            'photo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
        ];

        // Only validate password if it's provided
        if ($request->filled('password')) {
            $validationRules['password'] = 'required|string|min:8|confirmed';
        }

        $request->validate($validationRules);

        $userData = $request->except(['photo', 'password_confirmation']);

        // Handle password update
        if ($request->filled('password')) {
            $userData['password'] = Hash::make($request->password);
        }

        // Handle photo upload
        if ($request->hasFile('photo')) {
            // Delete old photo if exists
            if ($user->photo_path && !str_starts_with($user->photo_path, 'http')) {
                // Delete from public/uploads folder
                $oldPhotoPath = public_path($user->photo_path);
                if (file_exists($oldPhotoPath)) {
                    unlink($oldPhotoPath);
                }
            }

            $photo = $request->file('photo');
            $photoName = time() . '_' . $photo->getClientOriginalName();
            $photoPath = 'uploads/' . $photoName;

            // Move to public/uploads folder
            $photo->move(public_path('uploads'), $photoName);
            $userData['photo_path'] = $photoPath;

            // Debug logging
            Log::info('Photo updated successfully', [
                'photo_name' => $photoName,
                'photo_path' => $photoPath,
                'full_path' => public_path('uploads/' . $photoName)
            ]);
        }

                $user->update($userData);

        // Log activity
        ActivityLogService::logUser(
            'updated',
            "User updated: {$user->email} ({$user->role})",
            $user->id,
            $user->email,
            $request
        );

        // Return the updated user with the profile_photo_url
        $user->refresh();

        return response()->json($user)->header('Access-Control-Allow-Origin', '*');
    }

    /**
     * Remove the specified resource from storage (soft delete).
     */
    public function destroy(User $user, Request $request)
    {
        $userEmail = $user->email;
        $userId = $user->id;
        
        $user->delete(); // This will set deleted_at timestamp
        
        // Log activity
        ActivityLogService::logUser(
            'deleted',
            "User deleted: {$userEmail}",
            $userId,
            $userEmail,
            $request
        );
        
        return response()->json(['message' => 'User deleted successfully'])->header('Access-Control-Allow-Origin', '*');
    }

    /**
     * Restore a soft deleted user.
     */
    public function restore($id)
    {
        $user = User::withTrashed()->findOrFail($id);
        $user->restore();
        return response()->json(['message' => 'User restored successfully']);
    }

    /**
     * Permanently delete a user.
     */
    public function forceDelete($id)
    {
        $user = User::withTrashed()->findOrFail($id);

        // Delete photo if exists
        if ($user->photo_path && !str_starts_with($user->photo_path, 'http')) {
            $photoPath = public_path($user->photo_path);
            if (file_exists($photoPath)) {
                unlink($photoPath);
            }
        }

        $user->forceDelete();
        return response()->json(['message' => 'User permanently deleted']);
    }
}
