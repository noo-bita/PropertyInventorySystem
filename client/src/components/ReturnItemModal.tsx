import React, { useState } from 'react'

interface ReturnItemModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: { isDamaged: boolean; notes: string }) => Promise<void>
  item: {
    id: number
    item_name: string
    location?: string
    quantity_assigned?: number
    quantity_requested?: number
    assigned_at?: string
    due_date?: string
    description?: string
  }
  isLoading?: boolean
}

const ReturnItemModal: React.FC<ReturnItemModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  item,
  isLoading = false
}) => {
  const [isDamaged, setIsDamaged] = useState(false)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<{ notes?: string }>({})

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate: if damaged, notes are required
    const newErrors: { notes?: string } = {}
    if (isDamaged && !notes.trim()) {
      newErrors.notes = 'Please provide a description of the damage'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    await onConfirm({ isDamaged, notes: notes.trim() })
  }

  const handleClose = () => {
    if (!isLoading) {
      setIsDamaged(false)
      setNotes('')
      setErrors({})
      onClose()
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div 
      className="modal show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
      onClick={handleClose}
    >
      <div 
        className="modal-dialog modal-dialog-centered modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
          <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb', padding: '1.5rem' }}>
            <h5 className="modal-title" style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="bi bi-arrow-return-left" style={{ color: '#3b82f6' }}></i>
              Return Item
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={handleClose}
              disabled={isLoading}
            ></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ padding: '2rem' }}>
              {/* Item Details Section */}
              <div style={{ 
                backgroundColor: '#f8fafc', 
                borderRadius: '8px', 
                padding: '1.5rem', 
                marginBottom: '1.5rem',
                border: '1px solid #e2e8f0'
              }}>
                <h6 style={{ 
                  fontWeight: '600', 
                  color: '#1e293b', 
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <i className="bi bi-info-circle" style={{ color: '#3b82f6' }}></i>
                  Item Details
                </h6>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                      Item Name
                    </label>
                    <p style={{ margin: 0, color: '#1e293b', fontWeight: '500' }}>{item.item_name}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                      Quantity
                    </label>
                    <p style={{ margin: 0, color: '#1e293b', fontWeight: '500' }}>
                      {item.quantity_assigned || item.quantity_requested || 1}
                    </p>
                  </div>
                  {item.location && (
                    <div>
                      <label style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                        Location
                      </label>
                      <p style={{ margin: 0, color: '#1e293b', fontWeight: '500' }}>{item.location}</p>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                      Assigned Date
                    </label>
                    <p style={{ margin: 0, color: '#1e293b', fontWeight: '500' }}>
                      {formatDate(item.assigned_at || item.created_at)}
                    </p>
                  </div>
                  {item.due_date && (
                    <div>
                      <label style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                        Due Date
                      </label>
                      <p style={{ margin: 0, color: '#1e293b', fontWeight: '500' }}>
                        {formatDate(item.due_date)}
                      </p>
                    </div>
                  )}
                  {item.description && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500', marginBottom: '0.25rem', display: 'block' }}>
                        Description
                      </label>
                      <p style={{ margin: 0, color: '#1e293b' }}>{item.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Return Form Section */}
              <div>
                <h6 style={{ 
                  fontWeight: '600', 
                  color: '#1e293b', 
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <i className="bi bi-clipboard-check" style={{ color: '#3b82f6' }}></i>
                  Return Information
                </h6>

                {/* Damage Status */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                    backgroundColor: isDamaged ? '#fef2f2' : '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.borderColor = '#3b82f6'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }
                  }}
                  onClick={() => !isLoading && setIsDamaged(!isDamaged)}
                  >
                    <input
                      type="checkbox"
                      checked={isDamaged}
                      onChange={(e) => setIsDamaged(e.target.checked)}
                      disabled={isLoading}
                      style={{ 
                        width: '20px', 
                        height: '20px', 
                        cursor: 'pointer',
                        accentColor: '#ef4444'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: '500', color: '#1e293b', display: 'block' }}>
                        Item is damaged or has issues
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Check this box if the item is damaged, broken, or has any issues
                      </span>
                    </div>
                    {isDamaged && (
                      <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444', fontSize: '1.25rem' }}></i>
                    )}
                  </label>
                </div>

                {/* Notes/Description */}
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="return-notes" style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    color: '#1e293b', 
                    marginBottom: '0.5rem', 
                    display: 'block' 
                  }}>
                    Notes / Description {isDamaged && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <textarea
                    id="return-notes"
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value)
                      if (errors.notes) {
                        setErrors({ ...errors, notes: undefined })
                      }
                    }}
                    disabled={isLoading}
                    placeholder={isDamaged ? "Please describe the damage or issues with the item..." : "Add any notes about the return (optional)"}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: errors.notes ? '2px solid #ef4444' : '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      transition: 'border-color 0.2s ease',
                      backgroundColor: isLoading ? '#f3f4f6' : '#ffffff'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.outline = 'none'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = errors.notes ? '#ef4444' : '#d1d5db'
                    }}
                  />
                  {errors.notes && (
                    <p style={{ 
                      margin: '0.5rem 0 0 0', 
                      color: '#ef4444', 
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <i className="bi bi-exclamation-circle"></i>
                      {errors.notes}
                    </p>
                  )}
                  {!errors.notes && (
                    <p style={{ 
                      margin: '0.5rem 0 0 0', 
                      color: '#64748b', 
                      fontSize: '0.75rem' 
                    }}>
                      {isDamaged 
                        ? 'Required: Please provide details about the damage or issues'
                        : 'Optional: Add any relevant information about the return'
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.5rem', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleClose}
                disabled={isLoading}
                style={{
                  padding: '0.625rem 1.5rem',
                  borderRadius: '6px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="btn"
                disabled={isLoading}
                style={{
                  padding: '0.625rem 1.5rem',
                  borderRadius: '6px',
                  fontWeight: '500',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  opacity: isLoading ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.opacity = '0.9'
                    e.currentTarget.style.backgroundColor = '#059669'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.opacity = '1'
                    e.currentTarget.style.backgroundColor = '#10b981'
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Returning...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Return Item
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

export default ReturnItemModal

