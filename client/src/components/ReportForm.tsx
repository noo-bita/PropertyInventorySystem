import React, { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import { showNotification } from '../utils/notifications'

interface ReportFormProps {
  currentUser: { role: string; name: string }
  onRequestSubmit: (requests: any[]) => Promise<void>
}

const ReportForm: React.FC<ReportFormProps> = ({ currentUser, onRequestSubmit }) => {
  const [teacherItems, setTeacherItems] = useState<Array<{ id: string, name: string, assigned: number }>>([])
  const [selectedItem, setSelectedItem] = useState<string>('')
  const [reportType, setReportType] = useState('missing')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [quantity, setQuantity] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Load teacher's assigned items
  useEffect(() => {
    const loadTeacherItems = async () => {
      try {
        const response = await apiFetch(`/api/requests/teacher-assigned?teacher_name=${encodeURIComponent(currentUser.name)}`)
        if (response.ok) {
          const items = await response.json()
          setTeacherItems(items)
        } else {
          setTeacherItems([])
        }
      } catch (err) {
        setTeacherItems([])
      }
    }
    
    if (currentUser?.name) {
      loadTeacherItems()
    }
  }, [currentUser?.name])

  const handleItemSelection = (itemId: string) => {
    setSelectedItem(itemId)
    // Reset quantity to 1 when selecting a new item
    setQuantity(1)
  }

  const submitReport = async () => {
    // Clear previous errors
    setErrors({})
    
    // Validation
    const newErrors: { [key: string]: string } = {}
    if (!selectedItem) {
      newErrors.selectedItem = 'Please select an item to report'
    }
    if (!location.trim()) {
      newErrors.location = 'Location is required'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    const selectedItemData = teacherItems.find(item => item.id === selectedItem)
    const itemName = selectedItemData?.name || 'Unknown Item'

    // Check if quantity doesn't exceed assigned amount
    if (quantity > (selectedItemData?.assigned || 0)) {
      setErrors({ quantity: `Quantity cannot exceed assigned amount (${selectedItemData?.assigned || 0})` })
      return
    }
    
    if (quantity < 1) {
      setErrors({ quantity: 'Quantity must be at least 1' })
      return
    }
    
    setIsSubmitting(true)
    
    try {

      // Map report type to the format expected by admin table
      const reportTypeMapping = {
        'missing': 'MISSING',
        'damaged': 'DAMAGED', 
        'other': 'OTHER'
      }

      const mappedReportType = reportTypeMapping[reportType as keyof typeof reportTypeMapping]

      const payload = {
        teacher_name: currentUser.name,
        teacher_id: currentUser.id,
        location: location.trim(),
        subject: null, // Remove subject field
        description: `${itemName} (Qty: ${quantity})${description.trim() ? ` - ${description.trim()}` : ''}`,
        notes: `REPORT: ${mappedReportType} - Item: ${itemName} - Quantity: ${quantity} - ${description}`,
        photo: null // Can add photo upload later if needed
      }

      const res = await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        let errorMessage = 'Failed to submit report'
        try {
          const errorData = await res.json()
          if (errorData.errors) {
            const errorMessages = Object.values(errorData.errors).flat()
            errorMessage = errorMessages.join(', ')
          } else if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch (jsonError) {
          const errorText = await res.text()
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      showNotification('Report submitted successfully!', 'success')
      
      // Reset form
      setSelectedItem('')
      setDescription('')
      setLocation('')
      setQuantity(1)
      setReportType('missing')
      setErrors({})
      
      // Call parent callback if provided
      if (onRequestSubmit) {
        await onRequestSubmit([])
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to submit report', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleInputChange = (field: string, value: string) => {
    // Clear error for the field being edited
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    
    if (field === 'location') {
      setLocation(value)
    } else if (field === 'description') {
      setDescription(value)
    }
  }

  return (
    <>
      {/* Report Type Selection */}
      <div className="mb-4">
        <label className="form-label fw-bold">
          Report Type <span className="text-danger">*</span>
        </label>
        <div className="d-flex gap-2 flex-wrap">
          <input
            type="radio"
            className="btn-check"
            name="reportType"
            id="missing"
            value="missing"
            checked={reportType === 'missing'}
            onChange={(e) => setReportType(e.target.value)}
          />
          <label className="btn btn-outline-danger" htmlFor="missing" style={{
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            <i className="bi bi-exclamation-triangle me-1"></i>
            Missing Item
          </label>

          <input
            type="radio"
            className="btn-check"
            name="reportType"
            id="damaged"
            value="damaged"
            checked={reportType === 'damaged'}
            onChange={(e) => setReportType(e.target.value)}
          />
          <label className="btn btn-outline-warning" htmlFor="damaged" style={{
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            <i className="bi bi-tools me-1"></i>
            Damaged Item
          </label>

          <input
            type="radio"
            className="btn-check"
            name="reportType"
            id="other"
            value="other"
            checked={reportType === 'other'}
            onChange={(e) => setReportType(e.target.value)}
          />
          <label className="btn btn-outline-info" htmlFor="other" style={{
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            <i className="bi bi-info-circle me-1"></i>
            Other Issue
          </label>
        </div>
      </div>

      {/* Location */}
      <div className="mb-4">
        <label className="form-label fw-bold">
          Room / Location <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          className={`form-control ${errors.location ? 'is-invalid' : ''}`}
          placeholder="Enter location (e.g., Room 101, Library, Lab)"
          value={location}
          onChange={(e) => handleInputChange('location', e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--gray-300)',
            fontSize: '0.875rem'
          }}
          required
        />
        {errors.location && (
          <div className="invalid-feedback d-block" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            {errors.location}
          </div>
        )}
      </div>

      {/* Item Selection */}
      <div className="mb-4">
        <label className="form-label fw-bold">
          Select Item to Report <span className="text-danger">*</span>
        </label>
        {errors.selectedItem && (
          <div className="text-danger mb-2" style={{ fontSize: '0.75rem' }}>
            {errors.selectedItem}
          </div>
        )}
        {teacherItems.length === 0 ? (
          <div className="text-center py-4" style={{
            border: '1px dashed var(--gray-300)',
            borderRadius: '8px',
            background: 'var(--gray-50)'
          }}>
            <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', color: '#6c757d' }}></i>
            <p className="mt-2 text-muted">No assigned items found</p>
          </div>
        ) : (
          <div 
            className="item-selection-grid"
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '10px',
              border: '1px solid var(--gray-300)',
              borderRadius: '8px',
              background: 'var(--gray-50)'
            }}
          >
            {teacherItems.map((item) => (
              <div 
                key={item.id}
                className={`item-selection-option ${selectedItem === item.id ? 'selected' : ''}`}
                onClick={() => {
                  handleItemSelection(item.id)
                  if (errors.selectedItem) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.selectedItem
                      return newErrors
                    })
                  }
                }}
                style={{
                  padding: '15px',
                  border: selectedItem === item.id ? '2px solid var(--primary)' : '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: selectedItem === item.id ? 'var(--primary-light)' : 'white',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedItem === item.id ? '0 2px 8px rgba(33, 150, 243, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  if (selectedItem !== item.id) {
                    e.currentTarget.style.backgroundColor = 'var(--gray-50)'
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedItem !== item.id) {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = 'var(--gray-300)'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                <div className="item-info" style={{ flex: 1 }}>
                  <div className="item-name" style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-dark)', marginBottom: '4px' }}>
                    {item.name}
                  </div>
                  <div className="item-available" style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: '500' }}>
                    Assigned: {item.assigned}
                  </div>
                </div>
                <div className="selection-area" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedItem === item.id ? (
                    <div 
                      className="d-flex align-items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="mb-0 fw-bold" style={{ fontSize: '0.75rem', color: 'var(--gray-600)' }}>Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1
                          setQuantity(val)
                          if (errors.quantity) {
                            setErrors(prev => {
                              const newErrors = { ...prev }
                              delete newErrors.quantity
                              return newErrors
                            })
                          }
                        }}
                        max={item.assigned}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        onBlur={(e) => e.stopPropagation()}
                        className={`form-control form-control-sm ${errors.quantity ? 'is-invalid' : ''}`}
                        style={{ 
                          width: 80,
                          textAlign: 'center',
                          WebkitAppearance: 'none',
                          MozAppearance: 'textfield',
                          padding: '6px 8px'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="selection-indicator">
                      <i className="bi bi-plus-circle" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}></i>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {errors.quantity && (
          <div className="text-danger mt-2" style={{ fontSize: '0.75rem' }}>
            {errors.quantity}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="form-label fw-bold">
          Description / Reason
        </label>
        <textarea
          className="form-control"
          value={description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          rows={4}
          placeholder="Describe the issue with the selected items (optional)..."
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            border: '1px solid var(--gray-300)',
            fontSize: '0.875rem',
            resize: 'vertical'
          }}
        />
        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
          Provide additional details about the issue (optional)
        </small>
      </div>

      {/* Submit Buttons */}
      <div className="d-flex gap-3 mt-4">
        <button 
          className="btn btn-primary" 
          onClick={submitReport}
          disabled={isSubmitting}
          style={{
            padding: '10px 24px',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            minWidth: '150px'
          }}
        >
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Submitting...
            </>
          ) : (
            <>
              <i className="bi bi-exclamation-triangle me-2"></i>
              Submit Report
            </>
          )}
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            setSelectedItem('')
            setDescription('')
            setLocation('')
            setQuantity(1)
            setReportType('missing')
            setErrors({})
          }}
          disabled={isSubmitting}
          style={{
            padding: '10px 24px',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          <i className="bi bi-arrow-clockwise me-2"></i>
          Reset Form
        </button>
      </div>
    </>
  )
}

export default ReportForm
