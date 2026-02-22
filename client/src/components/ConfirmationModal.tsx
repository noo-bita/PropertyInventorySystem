import React from 'react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'delete' | 'reject' | 'warning' | 'info'
  warningMessage?: string
  isLoading?: boolean
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'delete',
  warningMessage,
  isLoading = false
}) => {
  if (!isOpen) return null

  const getIconColor = () => {
    switch (type) {
      case 'delete':
      case 'reject':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      case 'info':
        return '#3b82f6'
      default:
        return '#ef4444'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'delete':
      case 'reject':
        return 'bi-exclamation-triangle'
      case 'warning':
        return 'bi-exclamation-triangle'
      case 'info':
        return 'bi-question-circle'
      default:
        return 'bi-exclamation-triangle'
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'delete':
      case 'reject':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      case 'info':
        return '#3b82f6'
      default:
        return '#ef4444'
    }
  }

  return (
    <div 
      className="modal show d-block" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000 }}
      onClick={onClose}
    >
      <div 
        className="modal-dialog modal-dialog-centered modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
          <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb', padding: '1.5rem' }}>
            <h5 className="modal-title" style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className={`bi ${getIcon()}`} style={{ color: getIconColor() }}></i>
              {title}
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={isLoading}
            ></button>
          </div>
          
          <div className="modal-body" style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ 
              fontSize: '3rem', 
              color: getIconColor(),
              marginBottom: '1rem'
            }}>
              <i className={`bi ${getIcon()}`}></i>
            </div>
            <h5 style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
              Confirm Action
            </h5>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              {message}
            </p>
            {warningMessage && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}>
                <p style={{ margin: 0, color: '#991b1b', fontSize: '0.875rem' }}>
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Note:</strong> {warningMessage}
                </p>
              </div>
            )}
          </div>
          
          <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.5rem', justifyContent: 'center', gap: '1rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '6px',
                fontWeight: '500'
              }}
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              className="btn"
              onClick={onConfirm}
              disabled={isLoading}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '6px',
                fontWeight: '500',
                backgroundColor: getButtonColor(),
                color: '#ffffff',
                border: 'none',
                opacity: isLoading ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.opacity = '0.9'
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal

