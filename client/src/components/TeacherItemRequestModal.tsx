import React, { useState, useEffect } from 'react'
import { apiFetch, getApiBaseUrl } from '../utils/api'
import { showNotification } from '../utils/notifications'
import AutocompleteInput from './AutocompleteInput'
import AutocompleteTextarea from './AutocompleteTextarea'
import { getInputHistory, saveToHistory } from '../utils/inputHistory'

interface TeacherItemRequestModalProps {
  item: {
    id: number | string
    name: string
    available: number
    quantity?: number
    category?: string
    secondary_category?: string
    location?: string
    status?: string
    description?: string
    serial_number?: string
    serialNumber?: string
    purchase_date?: string
    purchaseDate?: string
    purchase_price?: number
    purchasePrice?: number
    purchase_type?: string
    purchaseType?: string
    supplier?: string
    consumable?: boolean | number | string
    photo?: string
    isGrouped?: boolean
    groupedItems?: Array<{
      id: number
      name: string
      available: number
      location?: string
      category?: string
      secondary_category?: string
      status?: string
      description?: string
      serial_number?: string
      serialNumber?: string
      purchase_date?: string
      purchaseDate?: string
      purchase_price?: number
      purchasePrice?: number
      purchase_type?: string
      purchaseType?: string
      supplier?: string
      consumable?: boolean | number | string
      photo?: string
    }>
  }
  currentUser: {
    id: number
    name: string
  }
  onClose: () => void
  onSuccess: () => void
  isFromQR?: boolean // Flag to indicate if this is from QR scan (single item, no quantity needed)
}

const TeacherItemRequestModal: React.FC<TeacherItemRequestModalProps> = ({
  item,
  currentUser,
  onClose,
  onSuccess,
  isFromQR = false
}) => {
  const [formData, setFormData] = useState({
    requestedQuantity: '1',
    description: '',
    roomLocation: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load input history when modal opens
  useEffect(() => {
    const descriptionHistory = getInputHistory('item_request_description')
    const locationHistory = getInputHistory('item_request_location')
    
    // Set initial values from history if available
    setFormData(prev => {
      const newData = { ...prev }
      if (descriptionHistory.length > 0 && !prev.description) {
        newData.description = descriptionHistory[0]
      }
      if (locationHistory.length > 0 && !prev.roomLocation) {
        newData.roomLocation = locationHistory[0]
      }
      return newData
    })
  }, [])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    // Calculate actual available quantity
    // For grouped items, sum up all available from grouped items
    // For single items, use item.available
    const actualAvailable = item.isGrouped && item.groupedItems
      ? item.groupedItems.reduce((sum, groupedItem) => sum + (groupedItem.available || 0), 0)
      : item.available

    const quantity = parseInt(formData.requestedQuantity.toString())
    if (!formData.requestedQuantity || formData.requestedQuantity.toString().trim() === '' || isNaN(quantity) || quantity <= 0) {
      newErrors.requestedQuantity = 'Quantity must be greater than 0'
    } else if (quantity > actualAvailable) {
      newErrors.requestedQuantity = `Quantity cannot exceed available (${actualAvailable})`
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (!formData.roomLocation.trim()) {
      newErrors.roomLocation = 'Room/Location is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Save to input history
      if (formData.description.trim()) {
        saveToHistory('item_request_description', formData.description)
      }
      if (formData.roomLocation.trim()) {
        saveToHistory('item_request_location', formData.roomLocation)
      }

      // For grouped items, use the group ID or first item ID
      // The backend will automatically assign the best condition items
      const itemId = item.isGrouped && item.groupedItems && item.groupedItems.length > 0
        ? item.groupedItems[0].id  // Use first item ID for grouped items
        : (item.id as number)

      const payload = {
        item_id: itemId,
        item_name: item.name,
        teacher_name: currentUser.name,
        teacher_id: currentUser.id,
        quantity_requested: parseInt(formData.requestedQuantity.toString()),
        location: formData.roomLocation,
        description: formData.description,
        request_type: 'item'
      }

      const response = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        showNotification(errorData.message || 'Failed to submit request', 'error')
        return
      }

      // Show success notification
      const notification = document.createElement('div')
      notification.className = 'toast-notification success'
      notification.textContent = 'Request submitted successfully!'
      document.body.appendChild(notification)
      
      setTimeout(() => {
        notification.classList.add('show')
      }, 10)

      setTimeout(() => {
        notification.classList.remove('show')
        setTimeout(() => {
          document.body.removeChild(notification)
        }, 300)
      }, 3000)

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error submitting request:', error)
      showNotification('Failed to submit request. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '900px', width: '95%' }}>
        <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-box-seam me-2"></i>
              Request Item
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={isSubmitting}
            ></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Item Details Section - Similar to Admin View */}
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1.5rem',
                border: '1px solid #dee2e6'
              }}>
                <h6 style={{ marginBottom: '1rem', fontWeight: 'bold', color: '#495057' }}>
                  <i className="bi bi-info-circle me-2"></i>
                  Item Details
                </h6>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {/* Item Name */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Item Name
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {item.name || 'N/A'}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Category
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {item.category || item.groupedItems?.[0]?.category || 'N/A'}
                    </div>
                  </div>

                  {/* Secondary Category */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Secondary Category
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {item.secondary_category || item.groupedItems?.[0]?.secondary_category || 'None'}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Location
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {item.location || item.groupedItems?.[0]?.location || 'N/A'}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Status
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {item.status || item.groupedItems?.[0]?.status || 'Available'}
                    </div>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Total Quantity
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {item.quantity || item.groupedItems?.[0]?.quantity || 'N/A'}
                    </div>
                  </div>

                  {/* Serial Number (if not consumable) */}
                  {(() => {
                    const isConsumable = item.consumable === true || item.consumable === 1 || item.consumable === '1' || item.consumable === 'true'
                    const serialNum = item.serial_number || item.serialNumber || item.groupedItems?.[0]?.serial_number || item.groupedItems?.[0]?.serialNumber
                    if (!isConsumable && serialNum) {
                      return (
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                            Serial Number
                          </label>
                          <div style={{ 
                            padding: '0.5rem', 
                            backgroundColor: 'white', 
                            borderRadius: '4px', 
                            border: '1px solid #ced4da',
                            fontSize: '0.95rem',
                            color: '#16a34a',
                            fontFamily: 'monospace',
                            fontWeight: '600'
                          }}>
                            {serialNum}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Item Type */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Item Type
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {(() => {
                        const isConsumable = item.consumable === true || item.consumable === 1 || item.consumable === '1' || item.consumable === 'true'
                        return isConsumable ? 'Consumable' : 'Reusable'
                      })()}
                    </div>
                  </div>

                  {/* Purchase Type / Source */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Source Type
                    </label>
                    <div style={{ 
                      padding: '0.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529'
                    }}>
                      {(() => {
                        const purchaseType = item.purchase_type || item.purchaseType || item.groupedItems?.[0]?.purchase_type || item.groupedItems?.[0]?.purchaseType
                        return purchaseType === 'donated' ? 'Donated' : 'School Purchased'
                      })()}
                    </div>
                  </div>

                  {/* Supplier/Donor */}
                  {(item.supplier || item.groupedItems?.[0]?.supplier) && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                        {(() => {
                          const purchaseType = item.purchase_type || item.purchaseType || item.groupedItems?.[0]?.purchase_type || item.groupedItems?.[0]?.purchaseType
                          return purchaseType === 'donated' ? 'Donor' : 'Supplier'
                        })()}
                      </label>
                      <div style={{ 
                        padding: '0.5rem', 
                        backgroundColor: 'white', 
                        borderRadius: '4px', 
                        border: '1px solid #ced4da',
                        fontSize: '0.95rem',
                        color: '#212529'
                      }}>
                        {item.supplier || item.groupedItems?.[0]?.supplier || 'N/A'}
                      </div>
                    </div>
                  )}

                  {/* Purchase Date */}
                  {(item.purchase_date || item.purchaseDate || item.groupedItems?.[0]?.purchase_date || item.groupedItems?.[0]?.purchaseDate) && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                        Purchase Date
                      </label>
                      <div style={{ 
                        padding: '0.5rem', 
                        backgroundColor: 'white', 
                        borderRadius: '4px', 
                        border: '1px solid #ced4da',
                        fontSize: '0.95rem',
                        color: '#212529'
                      }}>
                        {(() => {
                          const date = item.purchase_date || item.purchaseDate || item.groupedItems?.[0]?.purchase_date || item.groupedItems?.[0]?.purchaseDate
                          return date ? new Date(date).toLocaleDateString() : 'Not specified'
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Purchase Price */}
                  {(item.purchase_price || item.purchasePrice || item.groupedItems?.[0]?.purchase_price || item.groupedItems?.[0]?.purchasePrice) && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                        Purchase Price
                      </label>
                      <div style={{ 
                        padding: '0.5rem', 
                        backgroundColor: 'white', 
                        borderRadius: '4px', 
                        border: '1px solid #ced4da',
                        fontSize: '0.95rem',
                        color: '#212529'
                      }}>
                        ₱{(() => {
                          const price = item.purchase_price || item.purchasePrice || item.groupedItems?.[0]?.purchase_price || item.groupedItems?.[0]?.purchasePrice
                          return price ? parseFloat(price.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description - Full Width */}
                {(item.description || item.groupedItems?.[0]?.description) && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Description
                    </label>
                    <div style={{ 
                      padding: '0.75rem', 
                      backgroundColor: 'white', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '0.95rem',
                      color: '#212529',
                      minHeight: '60px',
                      maxHeight: '120px',
                      overflowY: 'auto'
                    }}>
                      {item.description || item.groupedItems?.[0]?.description || 'No description available'}
                    </div>
                  </div>
                )}

                {/* Item Photo - Full Width */}
                {(item.photo || item.groupedItems?.[0]?.photo) && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#6c757d' }}>
                      Item Photo
                    </label>
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '1rem',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #ced4da',
                      minHeight: '200px'
                    }}>
                      <img
                        src={(() => {
                          const photo = item.photo || item.groupedItems?.[0]?.photo
                          if (!photo) return ''
                          if (photo.startsWith('http')) return photo
                          return `${getApiBaseUrl()}/${photo}`
                        })()}
                        alt={item.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '200px',
                          objectFit: 'contain',
                          borderRadius: '4px'
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Request Form Section */}
              <div style={{ 
                borderTop: '2px solid #dee2e6', 
                paddingTop: '1.5rem', 
                marginTop: '1rem' 
              }}>
                <h6 style={{ marginBottom: '1rem', fontWeight: 'bold', color: '#495057' }}>
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Request Information
                </h6>

              {!isFromQR ? (
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">Available Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      value={item.isGrouped && item.groupedItems
                        ? item.groupedItems.reduce((sum, groupedItem) => sum + (groupedItem.available || 0), 0)
                        : item.available}
                      readOnly
                      style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    />
                    {item.isGrouped && item.groupedItems && (
                      <small className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                        {item.groupedItems.reduce((sum, groupedItem) => sum + (groupedItem.available || 0), 0)} items available - System will auto-assign best condition items
                      </small>
                    )}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label fw-bold">
                      Requested Quantity <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${errors.requestedQuantity ? 'is-invalid' : ''}`}
                      value={formData.requestedQuantity}
                      onChange={(e) => {
                        const value = e.target.value
                        // Calculate actual available quantity
                        const actualAvailable = item.isGrouped && item.groupedItems
                          ? item.groupedItems.reduce((sum, groupedItem) => sum + (groupedItem.available || 0), 0)
                          : item.available
                        
                        // Only allow numbers, and clear if empty
                        if (value === '') {
                          handleChange('requestedQuantity', '')
                        } else if (/^\d+$/.test(value)) {
                          const numValue = parseInt(value)
                          if (numValue > 0 && numValue <= actualAvailable) {
                            handleChange('requestedQuantity', value)
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // If empty on blur, set to 1
                        if (e.target.value === '' || e.target.value === '0') {
                          handleChange('requestedQuantity', '1')
                        }
                      }}
                      placeholder="Enter quantity"
                      required
                    />
                    {errors.requestedQuantity && (
                      <div className="invalid-feedback">{errors.requestedQuantity}</div>
                    )}
                    <small className="text-muted">
                      Maximum: {item.isGrouped && item.groupedItems
                        ? item.groupedItems.reduce((sum, groupedItem) => sum + (groupedItem.available || 0), 0)
                        : item.available} {item.isGrouped && '(System will auto-assign best items)'}
                    </small>
                  </div>
                </div>
              ) : (
                <div className="mb-3">
                  <label className="form-label fw-bold">Available Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={item.available}
                    readOnly
                    style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                  />
                  <small className="text-muted" style={{ fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
                    <i className="bi bi-info-circle me-1"></i>
                    This is a single item request from QR code. Quantity is automatically set to 1.
                  </small>
                </div>
              )}

              {/* Teacher Input Fields */}
              <div className="mb-3">
                <label className="form-label fw-bold">
                  Description / Reason <span className="text-danger">*</span>
                </label>
                <AutocompleteTextarea
                  value={formData.description}
                  onChange={(value) => handleChange('description', value)}
                  fieldName="item_request_description"
                  placeholder="Please provide a detailed reason for this request..."
                  className={`form-control ${errors.description ? 'is-invalid' : ''}`}
                  rows={4}
                  required
                />
                {errors.description && (
                  <div className="invalid-feedback">{errors.description}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">
                  Room / Location <span className="text-danger">*</span>
                </label>
                <AutocompleteInput
                  value={formData.roomLocation}
                  onChange={(value) => handleChange('roomLocation', value)}
                  fieldName="item_request_location"
                  placeholder="e.g., Room 101, Library, Lab A"
                  className={`form-control ${errors.roomLocation ? 'is-invalid' : ''}`}
                  required
                />
                {errors.roomLocation && (
                  <div className="invalid-feedback">{errors.roomLocation}</div>
                )}
              </div>
            </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-2"></i>
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default TeacherItemRequestModal

