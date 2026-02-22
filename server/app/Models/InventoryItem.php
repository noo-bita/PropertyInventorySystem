<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    protected $fillable = [
        'name',
        'category',
        'secondary_category',
        'quantity',
        'available',
        'location',
        'description',
        'serial_number',
        'purchase_date',
        'purchase_price',
        'purchase_type',
        'supplier',
        'added_by',
        'status',
        'photo',
        'consumable',
        'last_updated'
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'last_updated' => 'date',
        'purchase_price' => 'decimal:2',
        'consumable' => 'boolean'
    ];
}
