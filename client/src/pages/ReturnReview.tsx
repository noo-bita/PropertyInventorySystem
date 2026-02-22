import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import { AnimatedKPI } from '../components/AnimatedKPI'
import { useDataReady } from '../hooks/useDataReady'
import { showNotification } from '../utils/notifications'

const ReturnReview = () => {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [pendingItems, setPendingItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const dataReady = useDataReady(loading)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // Unified Response Modal state
  const [showResponseModal, setShowResponseModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [adminRemarks, setAdminRemarks] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDamaged, setIsDamaged] = useState(false)

  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    loadPendingItems()
  }, [location.pathname, currentUser])

  const loadPendingItems = async () => {
    if (!currentUser) {
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {
        console.warn('Pending inspection items fetch timeout')
        setLoading(false)
      }, 10000)
      
      const response = await apiFetch('/api/requests/pending-inspection')
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        setPendingItems(data)
      } else {
        showNotification('Failed to load pending inspection items', 'error')
      }
    } catch (error) {
      console.error('Error fetching pending inspection items:', error)
      showNotification('Error loading pending inspection items', 'error')
    } finally {
      setLoading(false)
    }
  }

  const refreshItems = async () => {
    await loadPendingItems()
  }

  // Filter items based on search term
  const filteredItems = pendingItems.filter(item => {
    if (!searchTerm) return true
    const lowerSearchTerm = searchTerm.toLowerCase()
    return (
      item.item_name?.toLowerCase().includes(lowerSearchTerm) ||
      item.teacher_name?.toLowerCase().includes(lowerSearchTerm) ||
      item.location?.toLowerCase().includes(lowerSearchTerm)
    )
  })

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  const openResponseModal = (item: any) => {
    setSelectedItem(item)
    setAdminRemarks('')
    setIsDamaged(false)
    setShowResponseModal(true)
    setShowConfirmation(false)
    setPendingAction(null)
  }

  const handleResponseAction = (action: 'approve' | 'reject') => {
    // Validate: if damaged is checked, admin remarks are required
    if (isDamaged && !adminRemarks.trim()) {
      showNotification('Please provide a description of the damage in Admin Remarks', 'error')
      return
    }
    
    // Show confirmation dialog for both actions
    setPendingAction(action)
    setShowConfirmation(true)
  }

  const confirmResponse = async () => {
    if (!selectedItem || !pendingAction) return

    setIsProcessing(true)
    try {
      // If admin checked "damaged" when approving, treat it as a reject (mark as damaged)
      const shouldMarkAsDamaged = pendingAction === 'approve' ? isDamaged : true
      
      if (pendingAction === 'approve' && !isDamaged) {
        // Approve - item has no damage, return to inventory
        const response = await apiFetch(`/api/requests/${selectedItem.id}/inspection/accept`, {
          method: 'POST',
          body: JSON.stringify({
            admin_response: adminRemarks || null
          })
        })

        if (response.ok) {
          showNotification('Return approved successfully!', 'success')
          // Remove from list immediately
          setPendingItems(prev => prev.filter(item => item.id !== selectedItem.id))
          closeResponseModal()
        } else {
          const errorData = await response.json()
          showNotification(errorData.message || 'Failed to approve return', 'error')
        }
      } else {
        // Reject or approve with damage - item stays assigned to teacher with Damaged status
        const response = await apiFetch(`/api/requests/${selectedItem.id}/inspection/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            admin_response: adminRemarks || (isDamaged && pendingAction === 'approve' ? 'Item marked as damaged by admin during inspection.' : null)
          })
        })

        if (response.ok) {
          const message = pendingAction === 'approve' && isDamaged 
            ? 'Item marked as damaged and returned to teacher.'
            : 'Return rejected successfully!'
          showNotification(message, 'success')
          // Remove from list immediately
          setPendingItems(prev => prev.filter(item => item.id !== selectedItem.id))
          closeResponseModal()
        } else {
          const errorData = await response.json()
          showNotification(errorData.message || 'Failed to process return', 'error')
        }
      }
    } catch (error) {
      console.error('Error processing return:', error)
      showNotification('Error processing return. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const cancelConfirmation = () => {
    setShowConfirmation(false)
    setPendingAction(null)
  }

  const closeResponseModal = () => {
    if (!isProcessing) {
      setShowResponseModal(false)
      setSelectedItem(null)
      setAdminRemarks('')
      setIsDamaged(false)
      setShowConfirmation(false)
      setPendingAction(null)
    }
  }


  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const pendingCount = pendingItems.length

  if (!currentUser) {
    return (
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">Access Denied</h4>
        <p>You must be logged in to access this page.</p>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <Sidebar currentUser={currentUser} />
      
      <main className="main-content">
        {/* Loading overlay - only covers main content, sidebar remains visible */}
        {loading && (
          <div className="main-content-loading">
            <div className="full-screen-spinner">
              <div className="loading-spinner-large"></div>
              <p style={{ marginTop: 'var(--space-4)', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                Loading pending inspection items...
              </p>
            </div>
          </div>
        )}
        
        {/* Topbar inside main-content to prevent sidebar overlap */}
        <AdminTopBar 
          currentUser={currentUser}
          onSearch={(term) => setSearchTerm(term)}
          searchValue={searchTerm}
          searchPlaceholder="Search by item name, teacher, or location..."
        />
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            {/* Statistics Cards */}
            <div className="kpi-grid mb-4">
              <AnimatedKPI
                label="Items Pending Inspection"
                value={pendingCount}
                icon="bi-clipboard-check"
                iconClass="kpi-icon-warning"
                loading={loading}
                dataReady={dataReady}
              />
            </div>

            {/* Pending Items Table - Modern Design */}
            <div className="standard-card">
              <div className="standard-card-header">
                <h3 className="standard-card-title">
                  <i className="bi bi-clipboard-check me-2"></i>
                  Pending Inspection Items
                </h3>
                <div className="d-flex align-items-center gap-2">
                  <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                    {searchTerm ? (
                      <>Showing {filteredItems.length} of {pendingItems.length} items</>
                    ) : (
                      <>Total: {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} pending inspection</>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={refreshItems}
                    disabled={loading}
                    style={{
                      borderRadius: '6px',
                      padding: '6px 16px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh
                  </button>
                </div>
              </div>
              
              <div className="table-responsive">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Teacher</th>
                      <th>Quantity</th>
                      <th>Location</th>
                      <th>Returned Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.length > 0 ? (
                      paginatedItems.map((item: any, index: number) => (
                        <tr 
                          key={item.id}
                          className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                        >
                          <td>{item.item_name}</td>
                          <td>{item.teacher_name}</td>
                          <td>{item.quantity_assigned || item.quantity_requested}</td>
                          <td>{item.location || 'N/A'}</td>
                          <td>
                            {item.returned_at
                              ? new Date(item.returned_at).toLocaleDateString()
                              : 'N/A'}
                          </td>
                          <td>
                            <button 
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => openResponseModal(item)}
                              title="Respond to Return"
                              style={{
                                borderRadius: '6px',
                                padding: '6px 16px',
                                transition: 'all 0.2s ease',
                                fontWeight: '500'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)'
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                                e.currentTarget.style.backgroundColor = '#16a34a'
                                e.currentTarget.style.borderColor = '#16a34a'
                                e.currentTarget.style.color = '#ffffff'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)'
                                e.currentTarget.style.boxShadow = 'none'
                                e.currentTarget.style.backgroundColor = 'transparent'
                                e.currentTarget.style.borderColor = '#16a34a'
                                e.currentTarget.style.color = '#16a34a'
                              }}
                            >
                              <i className="bi bi-chat-dots me-1"></i>
                              Respond
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-5">
                          <i className={`bi ${searchTerm ? 'bi-search' : 'bi-clipboard-check'}`} style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                          <h5 className="mt-3 text-muted">
                            {searchTerm ? 'No items found' : 'No Pending Inspection Items'}
                          </h5>
                          <p className="text-muted">
                            {searchTerm 
                              ? `No items match your search "${searchTerm}". Try a different search term.`
                              : 'No items are currently pending inspection.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredItems.length > itemsPerPage && (
                <div className="inventory-pagination" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-4)',
                  borderTop: '1px solid var(--gray-200)',
                  marginTop: 'var(--space-4)'
                }}>
                  <div className="pagination-info" style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)'
                  }}>
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
                  </div>
                  
                  <div className="pagination-controls" style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    alignItems: 'center'
                  }}>
                    <button
                      className="btn-standard btn-outline-primary"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        opacity: currentPage === 1 ? 0.5 : 1,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <i className="bi bi-chevron-left"></i>
                      Previous
                    </button>
                    
                    <div className="pagination-page-info" style={{
                      padding: '0 var(--space-3)',
                      fontSize: '0.875rem',
                      color: 'var(--gray-600)',
                      fontWeight: '500'
                    }}>
                      Page {currentPage} of {totalPages}
                    </div>
                    
                    <button
                      className="btn-standard btn-outline-primary"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Unified Response Modal */}
      {showResponseModal && selectedItem && (
        <div 
          className="modal show d-block" 
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          onClick={closeResponseModal}
        >
          <div 
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb', padding: '1.5rem' }}>
                <h5 className="modal-title" style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-chat-dots" style={{ color: '#16a34a' }}></i>
                  Respond to Return Item
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={closeResponseModal}
                  disabled={isProcessing || showConfirmation}
                ></button>
              </div>
              
              {!showConfirmation ? (
                <>
                  <div className="modal-body" style={{ padding: '1.5rem' }}>
                    {/* Return Details (Read-only) */}
                    <div style={{ 
                      backgroundColor: '#f0fdf4', 
                      borderRadius: '8px', 
                      padding: '1.25rem', 
                      marginBottom: '1.5rem',
                      border: '1px solid #dcfce7'
                    }}>
                      <h6 style={{ color: '#16a34a', marginBottom: '1rem', fontWeight: '600', fontSize: '1rem' }}>
                        <i className="bi bi-info-circle me-2"></i>
                        Return Details
                      </h6>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        <div>
                          <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Item Name:</strong>
                          <div style={{ color: '#1e293b', fontWeight: '500', marginTop: '0.25rem' }}>{selectedItem.item_name}</div>
                        </div>
                        <div>
                          <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Quantity:</strong>
                          <div style={{ color: '#1e293b', fontWeight: '500', marginTop: '0.25rem' }}>
                            {selectedItem.quantity_assigned || selectedItem.quantity_requested}
                          </div>
                        </div>
                        <div>
                          <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Returning Teacher:</strong>
                          <div style={{ color: '#1e293b', fontWeight: '500', marginTop: '0.25rem' }}>{selectedItem.teacher_name}</div>
                        </div>
                        <div>
                          <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Location:</strong>
                          <div style={{ color: '#1e293b', fontWeight: '500', marginTop: '0.25rem' }}>{selectedItem.location || 'N/A'}</div>
                        </div>
                        <div>
                          <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Returned Date:</strong>
                          <div style={{ color: '#1e293b', fontWeight: '500', marginTop: '0.25rem' }}>
                            {selectedItem.returned_at
                              ? new Date(selectedItem.returned_at).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </div>
                        {selectedItem.assigned_at && (
                          <div>
                            <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Assigned Date:</strong>
                            <div style={{ color: '#1e293b', fontWeight: '500', marginTop: '0.25rem' }}>
                              {new Date(selectedItem.assigned_at).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                        {selectedItem.due_date && (
                          <div>
                            <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Due Date:</strong>
                            <div style={{ color: '#1e293b', fontWeight: '500', marginTop: '0.25rem' }}>
                              {new Date(selectedItem.due_date).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                      {selectedItem.notes && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #dcfce7' }}>
                          <strong style={{ color: '#6b7280', fontSize: '0.875rem' }}>Teacher Notes:</strong>
                          <div style={{ color: '#1e293b', marginTop: '0.25rem', lineHeight: '1.6' }}>
                            {selectedItem.notes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Damage Status Checkbox */}
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
                        e.currentTarget.style.borderColor = '#16a34a'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                      }}
                      onClick={() => setIsDamaged(!isDamaged)}
                      >
                        <input
                          type="checkbox"
                          checked={isDamaged}
                          onChange={(e) => setIsDamaged(e.target.checked)}
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
                            Check this box if the item is damaged, broken, or has any issues (even if teacher didn't mark it)
                          </span>
                        </div>
                        {isDamaged && (
                          <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444', fontSize: '1.25rem' }}></i>
                        )}
                      </label>
                    </div>

                    {/* Optional Admin Remarks */}
                    <div className="mb-4">
                      <label className="form-label" style={{ fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                        Admin Remarks (Optional) {isDamaged && <span style={{ color: '#ef4444' }}>*</span>}
                      </label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={adminRemarks}
                        onChange={(e) => setAdminRemarks(e.target.value)}
                        placeholder={isDamaged ? "Please describe the damage or issues with the item..." : "Add any remarks or notes for the teacher..."}
                        style={{
                          border: '2px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.9375rem',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#16a34a'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db'
                        }}
                      />
                      <small className="form-text text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        {isDamaged 
                          ? 'Required: Please provide details about the damage or issues'
                          : 'This message will be sent to the returning teacher'
                        }
                      </small>
                    </div>

                    {/* Response Action Buttons */}
                    {!showConfirmation && (
                      <div style={{ 
                        display: 'flex', 
                        gap: '1rem', 
                        justifyContent: 'center',
                        flexWrap: 'wrap'
                      }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => handleResponseAction('approve')}
                          style={{
                            flex: '1',
                            minWidth: '180px',
                            padding: '0.875rem 1.5rem',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '1rem',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#15803d'
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(22, 163, 74, 0.3)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#16a34a'
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          <i className="bi bi-check-circle"></i>
                          Approved
                        </button>
                        
                        <button
                          type="button"
                          className="btn"
                          onClick={() => handleResponseAction('reject')}
                          style={{
                            flex: '1',
                            minWidth: '180px',
                            padding: '0.875rem 1.5rem',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '1rem',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#dc2626'
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.3)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ef4444'
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          <i className="bi bi-x-circle"></i>
                          Disapproved
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={closeResponseModal}
                      style={{
                        padding: '0.5rem 1.25rem',
                        borderRadius: '6px',
                        fontWeight: '500'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Confirmation Dialog */}
                  <div className="modal-body" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: '3rem', 
                      color: pendingAction === 'reject' ? '#ef4444' : '#16a34a',
                      marginBottom: '1rem'
                    }}>
                      <i className={`bi ${pendingAction === 'reject' ? 'bi-exclamation-triangle' : 'bi-question-circle'}`}></i>
                    </div>
                    <h5 style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
                      Confirm Action
                    </h5>
                    <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                      Are you sure you want to{' '}
                      <strong style={{ color: '#1e293b' }}>
                        {pendingAction === 'approve' && isDamaged 
                          ? 'mark this item as damaged' 
                          : pendingAction === 'approve' 
                          ? 'approve this return' 
                          : 'disapprove this return'}?
                      </strong>
                    </p>
                    {pendingAction === 'approve' && !isDamaged && (
                      <div style={{
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #dcfce7',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left'
                      }}>
                        <p style={{ margin: 0, color: '#166534', fontSize: '0.875rem' }}>
                          <i className="bi bi-check-circle me-2"></i>
                          <strong>Note:</strong> This confirms the item has NO damage. The item will be returned to admin inventory with "Available" status and becomes requestable by teachers again.
                        </p>
                      </div>
                    )}
                    {pendingAction === 'approve' && isDamaged && (
                      <div style={{
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left'
                      }}>
                        <p style={{ margin: 0, color: '#991b1b', fontSize: '0.875rem' }}>
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          <strong>Note:</strong> This marks the item as DAMAGED. The item will NOT be returned to admin inventory. It will remain in the teacher's assigned items with "Damaged" status. The Return button will be disabled and a note will be added: "Please proceed to the office for further details regarding this damaged item."
                        </p>
                      </div>
                    )}
                    {pendingAction === 'reject' && (
                      <div style={{
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left'
                      }}>
                        <p style={{ margin: 0, color: '#991b1b', fontSize: '0.875rem' }}>
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          <strong>Note:</strong> This marks the item as DAMAGED. The item will NOT be returned to admin inventory. It will remain in the teacher's assigned items with "Damaged" status. The Return button will be disabled and a note will be added: "Please proceed to the office for further details regarding this damaged item."
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.5rem', justifyContent: 'center', gap: '1rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={cancelConfirmation}
                      disabled={isProcessing}
                      style={{
                        padding: '0.625rem 1.5rem',
                        borderRadius: '6px',
                        fontWeight: '500'
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn"
                      onClick={confirmResponse}
                      disabled={isProcessing}
                      style={{
                        padding: '0.625rem 1.5rem',
                        borderRadius: '6px',
                        fontWeight: '500',
                        backgroundColor: pendingAction === 'reject' ? '#ef4444' : '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        opacity: isProcessing ? 0.7 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isProcessing) {
                          e.currentTarget.style.opacity = '0.9'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isProcessing) {
                          e.currentTarget.style.opacity = '1'
                        }
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Processing...
                        </>
                      ) : (
                        'Confirm'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReturnReview
