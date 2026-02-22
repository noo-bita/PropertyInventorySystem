<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'supplier_name',
        'company_name',
        'contact_person',
        'contact_number',
        'email',
        'address',
        'business_registration_number',
        'notes',
        'status',
        'type',
        'date_added',
    ];

    protected $casts = [
        'date_added' => 'date',
        'deleted_at' => 'datetime',
    ];

    /**
     * Scope to get only active suppliers
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope to get only inactive suppliers
     */
    public function scopeInactive($query)
    {
        return $query->where('status', 'inactive');
    }
}
