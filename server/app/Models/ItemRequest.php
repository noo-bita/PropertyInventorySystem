<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemRequest extends Model
{
    protected $fillable = [
        'teacher_name',
        'teacher_id',
        'item_id',
        'item_name',
        'quantity_requested',
        'quantity_assigned',
        'location',
        'subject',
        'description',
        'due_date',
        'status',
        'return_status',
        'notes',
        'assigned_at',
        'returned_at',
        'inspected_by',
        'inspection_status',
        'damage_remarks',
        'damage_photo',
        'inspected_at'
    ];

    protected $casts = [
        'due_date' => 'date',
        'assigned_at' => 'datetime',
        'returned_at' => 'datetime',
        'inspected_at' => 'datetime',
    ];
}


