import React, { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import { showNotification } from '../utils/notifications'

interface ItemRequestFormProps {
  currentUser: { role: string; name: string }
  onRequestSubmit: (requests: any[]) => Promise<void>
}

const ItemRequestForm: React.FC<ItemRequestFormProps> = ({ currentUser, onRequestSubmit }) => {
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number | string>>({})
  const [availableItems, setAvailableItems] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [location, setLocation] = useState('')

  // Load available inventory items
  useEffect(() => {
    const loadAvailable = async () => {
      try {
        const res = await apiFetch('/api/inventory')
        if (res.ok) {
          const items = await res.json()
          const mapped = (Array.isArray(items) ? items : [])
            .filter((item: any) => 
              item.available > 0 && 
              item.status !== 'Under Maintenance' && item.status !== 'Damaged'
            )
            .map((item: any) => ({
              id: String(item.id),
              name: item.name,
              category: item.category,
              available: item.available
            }))
          setAvailableItems(mapped)
        }
      } catch (err) {
        console.error('Failed to load inventory:', err)
      }
    }
    loadAvailable()
  }, [])

  const handleItemSelection = (itemId: string, available?: number) => {
    setSelectedItems(prev => {
      const isSelected = prev.includes(itemId)
      const next = isSelected ? prev.filter(id => id !== itemId) : [...prev, itemId]
      
      // Initialize quantity when selecting
      if (!isSelected) {
        setSelectedQuantities(prev => ({ ...prev, [itemId]: 1 }))
      } else {
        // Remove quantity when deselecting
        setSelectedQuantities(prev => {
          const copy = { ...prev }
          delete copy[itemId]
          return copy
        })
      }
      return next
    })
  }

  const handleQuantityChange = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // Allow empty string during typing
    if (value === '') {
      setSelectedQuantities(prev => ({ ...prev, [itemId]: '' }))
      return
    }
    
    // Only process if it's a valid number
    const numValue = parseInt(value)
    if (!isNaN(numValue)) {
      const clamped = Math.max(1, Math.min(1000, numValue))
      setSelectedQuantities(prev => ({ ...prev, [itemId]: clamped }))
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const submitRequest = async () => {
    try {
      if (selectedItems.length === 0) {
        showNotification('Please select at least one item.', 'error')
        return
      }

      if (!location.trim()) {
        showNotification('Please enter a location.', 'error')
        return
      }


      // Build payloads from selectedItems + quantities
      const payloads = selectedItems.map((id) => {
        const item = availableItems.find((i) => i.id === id)
        return {
          item_id: Number(id),
          item_name: item?.name || '',
          teacher_name: currentUser.name,
          quantity_requested: typeof selectedQuantities[id] === 'number' ? selectedQuantities[id] : 1,
          location: location.trim(),
          subject: null,
          request_type: 'item'
        }
      })

      // Submit in sequence
      for (const p of payloads) {
        const res = await apiFetch('/api/requests', {
          method: 'POST',
          body: JSON.stringify(p)
        })
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Failed to submit request: ${errorText}`)
        }
      }

      showNotification('Request submitted and inventory reserved!', 'success')
      
      // Reset form
      setSelectedItems([])
      setSelectedQuantities({})
      setLocation('')
      
      // Call parent callback if provided
      if (onRequestSubmit) {
        await onRequestSubmit(payloads)
      }
    } catch (err: any) {
      console.error('Submit error:', err)
      showNotification(err.message || 'Failed to submit request', 'error')
    }
  }

  // Filter items based on search term
  const filteredItems = availableItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="request-status-card" style={{ 
      background: 'white', 
      borderRadius: '12px', 
      padding: '20px', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginBottom: '20px'
    }}>
      <div className="card-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="bi bi-box text-primary" style={{ fontSize: '20px' }}></i>
          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Item Request</h4>
        </div>
      </div>
      
      <div className="request-form-grid">
        {/* Request Details */}
        <div className="form-card">
          <h5>Request Details</h5>
          
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">Location *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter location (e.g., Room 101, Library, Lab)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

        </div>

        {/* Item Selection */}
        <div className="form-card">
          <h5>Select Items</h5>
          
          {/* Search Bar */}
          <div className="mb-3">
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Search items by name or category..."
                value={searchTerm}
                onChange={handleSearchChange}
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setSearchTerm('')}
                  title="Clear search"
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>

          {/* Available Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-search" style={{ fontSize: '2rem', color: '#6c757d' }}></i>
              <p className="mt-2 text-muted">No items found</p>
            </div>
          ) : (
            <div 
              className="item-selection-grid"
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '10px'
              }}
            >
              {filteredItems.map((item) => (
                <div 
                  key={item.id}
                  className={`item-selection-option ${selectedItems.includes(item.id) ? 'selected' : ''}`}
                  onClick={() => handleItemSelection(item.id, item.available)}
                >
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-category">{item.category}</span>
                    <span className="item-available">Available: {item.available}</span>
                  </div>
                  {selectedItems.includes(item.id) ? (
                    <div 
                      className="d-flex align-items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="mb-0" style={{ fontSize: 12, color: '#64748b' }}>Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={selectedQuantities[item.id] ?? 1}
                        onChange={(e) => handleQuantityChange(item.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        onBlur={(e) => e.stopPropagation()}
                        className="form-control form-control-sm"
                        style={{ 
                          width: 80,
                          textAlign: 'center',
                          WebkitAppearance: 'none',
                          MozAppearance: 'textfield'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="selection-indicator">
                      <i className="bi bi-plus-circle"></i>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="request-actions" style={{ marginTop: '20px' }}>
        <button className="btn btn-primary" onClick={submitRequest}>
          <i className="bi bi-send"></i>
          Submit Item Request
        </button>
        <button className="btn btn-secondary" onClick={() => {
          setSelectedItems([])
          setSelectedQuantities({})
          setLocation('')
        }}>
          <i className="bi bi-arrow-clockwise"></i>
          Reset Form
        </button>
      </div>
    </div>
  )
}

export default ItemRequestForm
