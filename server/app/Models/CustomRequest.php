<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomRequest extends Model
{
    protected $fillable = [
        'item_name',
        'teacher_name',
        'teacher_id',
        'quantity_requested',
        'estimated_cost',
        'location',
        'subject',
        'description',
        'notes',
        'photo',
        'status',
        'admin_response'
    ];

    protected $casts = [
        'quantity_requested' => 'integer',
        'teacher_id' => 'integer',
        'estimated_cost' => 'decimal:2',
    ];
}
