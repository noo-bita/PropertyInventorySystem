import React, { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import { showNotification } from '../utils/notifications'
import AutocompleteInput from './AutocompleteInput'
import AutocompleteTextarea from './AutocompleteTextarea'
import { getInputHistory, saveToHistory } from '../utils/inputHistory'

interface TeacherItemRequestModalProps {
  item: {
    id: number | string
    name: string
    available: number
    location?: string
    isGrouped?: boolean
    groupedItems?: Array<{
      id: number
      name: string
      available: number
      location?: string
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
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
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
              {/* Auto-filled Read-only Fields */}
              <div className="mb-3">
                <label className="form-label fw-bold">Item Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={item.name}
                  readOnly
                  style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                />
              </div>

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

