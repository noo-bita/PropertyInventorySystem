import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import ConfirmationModal from '../components/ConfirmationModal'
import { AnimatedKPI } from '../components/AnimatedKPI'
import { useDataReady } from '../hooks/useDataReady'
import { showNotification } from '../utils/notifications'

const ItemRequestManagement = () => {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const dataReady = useDataReady(loading)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // Unified Response Modal state
  const [showResponseModal, setShowResponseModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [adminRemarks, setAdminRemarks] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Approval fields (for approve action)
  const [approvalDueDate, setApprovalDueDate] = useState('')
  const [approvalQuantity, setApprovalQuantity] = useState(1)
  
  // Dropdown expansion state
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set())

  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    loadRequests()
  }, [location.pathname, currentUser])

  const loadRequests = async () => {
    if (!currentUser) {
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      
      // Add timeout to prevent stuck loading (max 10 seconds)
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {
        console.warn('Requests data fetch timeout')
        setLoading(false)
      }, 10000)
      
      // Fetch both requests and inventory items in parallel
      const [requestsResponse, inventoryResponse] = await Promise.all([
        apiFetch('/api/requests'),
        apiFetch('/api/inventory')
      ])
      
      clearTimeout(timeoutId)
      
      if (requestsResponse.ok && inventoryResponse.ok) {
        const requestsData = await requestsResponse.json()
        const inventoryData = await inventoryResponse.json()
        
        // Create a Set of inventory item IDs for quick lookup
        const inventoryItemIds = new Set(
          inventoryData.map((item: any) => item.id)
        )
        
        // Filter only pending item requests (exclude all responded/completed requests)
        // Also filter out requests where the inventory item no longer exists
        const itemRequests = requestsData.filter((r: any) => {
          const isItemRequest = r.request_type === 'item' || !r.request_type
          const isPending = String(r.status).toLowerCase() === 'pending'
          
          // If item_id is null, it's a custom request - skip it (item requests should have item_id)
          if (r.item_id === null || r.item_id === undefined) {
            return false
          }
          
          // If item_id exists, check if it's in the inventory
          const itemExists = inventoryItemIds.has(r.item_id)
          
          return isItemRequest && isPending && itemExists
        })
        setRequests(itemRequests)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshRequests = async () => {
    try {
      // Fetch both requests and inventory items in parallel
      const [requestsResponse, inventoryResponse] = await Promise.all([
        apiFetch('/api/requests'),
        apiFetch('/api/inventory')
      ])
      
      if (requestsResponse.ok && inventoryResponse.ok) {
        const requestsData = await requestsResponse.json()
        const inventoryData = await inventoryResponse.json()
        
        // Create a Set of inventory item IDs for quick lookup
        const inventoryItemIds = new Set(
          inventoryData.map((item: any) => item.id)
        )
        
        // Filter only pending item requests (exclude all responded/completed requests)
        // Also filter out requests where the inventory item no longer exists
        const itemRequests = requestsData.filter((r: any) => {
          const isItemRequest = r.request_type === 'item' || !r.request_type
          const isPending = String(r.status).toLowerCase() === 'pending'
          
          // If item_id is null, it's a custom request - skip it (item requests should have item_id)
          if (r.item_id === null || r.item_id === undefined) {
            return false
          }
          
          // If item_id exists, check if it's in the inventory
          const itemExists = inventoryItemIds.has(r.item_id)
          
          return isItemRequest && isPending && itemExists
        })
        setRequests(itemRequests)
      }
    } catch (error) {
      console.error('Error refreshing requests:', error)
    }
  }

  const toggleRequestExpansion = (requestId: number) => {
    setExpandedRequests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(requestId)) {
        newSet.delete(requestId)
      } else {
        newSet.add(requestId)
      }
      return newSet
    })
  }

  const openResponseModal = (request: any) => {
    setSelectedRequest(request)
    setAdminRemarks('')
    setApprovalDueDate('')
    setApprovalQuantity(request.quantity_requested || 1)
    setShowResponseModal(true)
    setShowConfirmation(false)
    setPendingAction(null)
  }

  const handleResponseAction = (action: 'approve' | 'reject') => {
    setPendingAction(action)
    setShowConfirmation(true)
  }

  const cancelConfirmation = () => {
    setShowConfirmation(false)
    setPendingAction(null)
  }

  const confirmResponse = async () => {
    if (!selectedRequest || !pendingAction) return

    setIsProcessing(true)
    try {
      if (pendingAction === 'approve') {
        if (!approvalDueDate) {
          showNotification('Please select a due date', 'error')
          setIsProcessing(false)
          return
        }
        
        const res = await apiFetch(`/api/requests/${selectedRequest.id}/approve-and-assign`, {
          method: 'POST',
          body: JSON.stringify({
            due_date: approvalDueDate,
            quantity: approvalQuantity
          })
        })
        
        if (res.ok) {
          await refreshRequests()
          showNotification('Request approved and assigned successfully!', 'success')
          closeResponseModal()
        } else {
          const errorData = await res.json().catch(() => ({}))
          showNotification(errorData.message || 'Failed to approve request', 'error')
        }
      } else if (pendingAction === 'reject') {
        const response = await apiFetch(`/api/requests/${selectedRequest.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'rejected',
            notes: adminRemarks || null
          })
        })
        
        if (response.ok) {
          await refreshRequests()
          showNotification('Request disapproved successfully!', 'success')
          closeResponseModal()
        } else {
          const errorData = await response.json().catch(() => ({}))
          showNotification(errorData.message || 'Failed to disapprove request', 'error')
        }
      }
    } catch (error) {
      console.error('Error processing request:', error)
      showNotification('Error processing request. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const closeResponseModal = () => {
    if (!isProcessing) {
      setShowResponseModal(false)
      setSelectedRequest(null)
      setAdminRemarks('')
      setApprovalDueDate('')
      setApprovalQuantity(1)
      setShowConfirmation(false)
      setPendingAction(null)
    }
  }

  // Filter requests based on search term
  const filterRequests = (requestsList: any[]) => {
    if (!searchTerm) return requestsList
    const lowerSearchTerm = searchTerm.toLowerCase()
    return requestsList.filter(request => 
      request.item_name?.toLowerCase().includes(lowerSearchTerm) ||
      request.teacher_name?.toLowerCase().includes(lowerSearchTerm) ||
      String(request.id).includes(searchTerm) ||
      request.quantity_requested?.toString().includes(searchTerm) ||
      request.status?.toLowerCase().includes(lowerSearchTerm)
    )
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const pendingRequests = requests.filter((r: any) => String(r.status).toLowerCase() === 'pending')
  const approvedRequests = requests.filter((r: any) => 
    String(r.status).toLowerCase() === 'approved' || String(r.status).toLowerCase() === 'assigned'
  )
  const rejectedRequests = requests.filter((r: any) => String(r.status).toLowerCase() === 'rejected')

  const filteredRequests = filterRequests(requests)
  
  // Pagination logic
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex)

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
                Loading requests...
              </p>
            </div>
          </div>
        )}
        
        {/* Topbar inside main-content to prevent sidebar overlap */}
        <AdminTopBar 
          currentUser={currentUser}
          onSearch={(term) => setSearchTerm(term)}
          searchValue={searchTerm}
          searchPlaceholder="Search item requests by teacher, item, ID, quantity, or status..."
        />
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            {/* Statistics Cards - Modern Design with Animations */}
            <div className="row mb-4">
              <div className="col-md-4 mb-3">
                <AnimatedKPI
                  label="Pending"
                  value={pendingRequests.length}
                  icon="bi-clock"
                  iconClass="kpi-icon-warning"
                  loading={loading}
                  dataReady={dataReady}
                />
                  </div>
              <div className="col-md-4 mb-3">
                <AnimatedKPI
                  label="Approved & Assigned"
                  value={approvedRequests.length}
                  icon="bi-check-circle"
                  iconClass="kpi-icon-success"
                  loading={loading}
                  dataReady={dataReady}
                />
                </div>
              <div className="col-md-4 mb-3">
                <AnimatedKPI
                  label="Rejected"
                  value={rejectedRequests.length}
                  icon="bi-x-circle"
                  iconClass="kpi-icon-danger"
                  loading={loading}
                  dataReady={dataReady}
                />
                </div>
              </div>

            {/* Requests Table - Modern Design */}
            <div className="standard-card">
              <div className="standard-card-header">
                <h3 className="standard-card-title">
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Item Requests
                </h3>
                <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                  {searchTerm ? (
                    <>Showing {filteredRequests.length} of {requests.length} requests</>
                  ) : (
                    <>Total: {requests.length} requests</>
                  )}
              </div>
            </div>

                <div className="table-responsive">
                <table className="table-modern">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Teacher</th>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                    {paginatedRequests.length > 0 ? (
                      paginatedRequests.map((request: any, index: number) => (
                        <React.Fragment key={request.id}>
                          <tr 
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleRequestExpansion(request.id)}
                            className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                          >
                            <td>{request.id}</td>
                            <td>{request.teacher_name}</td>
                            <td>{request.item_name}</td>
                            <td>{request.quantity_requested}</td>
                            <td>
                              <span className={`badge ${
                                request.status === 'pending' ? 'bg-warning' :
                                request.status === 'approved' ? 'bg-success' :
                                request.status === 'rejected' ? 'bg-danger' :
                                request.status === 'assigned' ? 'bg-info' :
                                'bg-light text-dark'
                              }`} style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '500'
                              }}>
                                {request.status?.toUpperCase()}
                              </span>
                            </td>
                            <td>{new Date(request.created_at).toLocaleDateString()}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => openResponseModal(request)}
                                title="Respond to Request"
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
                                Response
                              </button>
                            </td>
                          </tr>
                          {expandedRequests.has(request.id) && (
                            <tr>
                              <td colSpan={7}>
                                <div className="request-details-grid" style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                  gap: '20px',
                                  padding: '20px',
                                  backgroundColor: 'var(--gray-50)',
                                  border: '1px solid var(--gray-200)',
                                  borderRadius: '8px',
                                  margin: '10px 0'
                                }}>
                                  <div className="detail-section">
                                    <h6 style={{ color: 'var(--text-dark)', marginBottom: '15px', borderBottom: '2px solid var(--primary-blue)', paddingBottom: '5px' }}>
                                      <i className="bi bi-info-circle me-2"></i>Request Details
                                    </h6>
                                    <div className="detail-item">
                                      <strong>Request ID:</strong> {request.id}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Teacher:</strong> {request.teacher_name}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Item Name:</strong> {request.item_name}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Quantity Requested:</strong> {request.quantity_requested}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Quantity Assigned:</strong> {request.quantity_assigned || 'Not assigned'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Location:</strong> {request.location || 'Not specified'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Notes:</strong> {request.notes || 'No notes'}
                                    </div>
                                  </div>

                                  <div className="detail-section">
                                    <h6 style={{ color: 'var(--text-dark)', marginBottom: '15px', borderBottom: '2px solid var(--success-green)', paddingBottom: '5px' }}>
                                      <i className="bi bi-calendar-check me-2"></i>Status & Timeline
                                    </h6>
                                    <div className="detail-item">
                                      <strong>Status:</strong> 
                                      <span className={`badge ms-2 ${
                                        request.status === 'pending' ? 'bg-warning' :
                                        request.status === 'approved' ? 'bg-success' :
                                        request.status === 'rejected' ? 'bg-danger' :
                                        request.status === 'assigned' ? 'bg-info' :
                                        'bg-light text-dark'
                                      }`}>
                                        {request.status}
                                      </span>
                                    </div>
                                    <div className="detail-item">
                                      <strong>Created:</strong> {new Date(request.created_at).toLocaleString()}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Due Date:</strong> {request.due_date ? new Date(request.due_date).toLocaleDateString() : 'Not set'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Assigned At:</strong> {request.assigned_at ? new Date(request.assigned_at).toLocaleString() : 'Not assigned'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Returned At:</strong> {request.returned_at ? new Date(request.returned_at).toLocaleString() : 'Not returned'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Last Updated:</strong> {new Date(request.updated_at).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-5">
                          <i className={`bi ${searchTerm ? 'bi-search' : 'bi-file-earmark-text'}`} style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                          <h5 className="mt-3 text-muted">
                            {searchTerm ? 'No requests found' : 'No Item Requests'}
                          </h5>
                          <p className="text-muted">
                            {searchTerm 
                              ? `No requests match your search "${searchTerm}". Try a different search term.`
                              : 'No item requests have been submitted yet.'}
                          </p>
                        </td>
                      </tr>
                    )}
                    </tbody>
                  </table>
                </div>

              {/* Pagination Controls */}
              {filteredRequests.length > itemsPerPage && (
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
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length} requests
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
      {showResponseModal && selectedRequest && (
        <div 
          className="modal show d-block" 
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}
          onClick={() => {
            if (!showConfirmation) {
              closeResponseModal()
            }
          }}
        >
          <div 
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid var(--gray-200)', padding: '1.5rem' }}>
                <h5 className="modal-title" style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-chat-dots" style={{ color: '#16a34a' }}></i>
                  Respond to Item Request
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
                    {/* Request Details (Read-only) */}
                    <div className="request-details-card" style={{ 
                      backgroundColor: 'var(--light-blue)', 
                      borderRadius: '8px', 
                      padding: '1.25rem', 
                      marginBottom: '1.5rem',
                      border: '1px solid var(--border-light)'
                    }}>
                      <h6 style={{ color: '#16a34a', marginBottom: '1rem', fontWeight: '600', fontSize: '1rem' }}>
                        <i className="bi bi-info-circle me-2"></i>
                        Request Details
                      </h6>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                        <div>
                          <strong style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Item Name:</strong>
                          <div style={{ color: 'var(--text-dark)', fontWeight: '500', marginTop: '0.25rem' }}>{selectedRequest.item_name}</div>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Quantity Requested:</strong>
                          <div style={{ color: 'var(--text-dark)', fontWeight: '500', marginTop: '0.25rem' }}>{selectedRequest.quantity_requested}</div>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Requesting Teacher:</strong>
                          <div style={{ color: 'var(--text-dark)', fontWeight: '500', marginTop: '0.25rem' }}>{selectedRequest.teacher_name}</div>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Date Requested:</strong>
                          <div style={{ color: 'var(--text-dark)', fontWeight: '500', marginTop: '0.25rem' }}>{new Date(selectedRequest.created_at).toLocaleDateString()}</div>
                        </div>
                        {selectedRequest.location && (
                          <div>
                            <strong style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Location:</strong>
                            <div style={{ color: 'var(--text-dark)', fontWeight: '500', marginTop: '0.25rem' }}>{selectedRequest.location}</div>
                          </div>
                        )}
                      </div>
                      {selectedRequest.description && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                          <strong style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Description / Reason:</strong>
                          <div style={{ color: 'var(--text-dark)', marginTop: '0.25rem', lineHeight: '1.6' }}>
                            {selectedRequest.description}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Approval Fields - Only show for pending requests */}
                    {selectedRequest.status === 'pending' && (
                      <div className="row mb-4">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label" style={{ fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                              Due Date <span className="text-danger">*</span>
                            </label>
                            <input
                              type="date"
                              value={approvalDueDate}
                              onChange={(e) => setApprovalDueDate(e.target.value)}
                              className="form-control"
                              min={new Date().toISOString().split('T')[0]}
                              style={{
                                border: '2px solid var(--gray-300)',
                                borderRadius: '8px',
                                fontSize: '0.9375rem',
                                transition: 'border-color 0.2s'
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#16a34a'
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'var(--gray-300)'
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label" style={{ fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                              Quantity to Assign <span className="text-danger">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={selectedRequest.quantity_requested}
                              value={approvalQuantity}
                              onChange={(e) => setApprovalQuantity(parseInt(e.target.value) || 1)}
                              className="form-control"
                              style={{
                                border: '2px solid var(--gray-300)',
                                borderRadius: '8px',
                                fontSize: '0.9375rem',
                                transition: 'border-color 0.2s'
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#16a34a'
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'var(--gray-300)'
                              }}
                            />
                            <small className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                              Maximum: {selectedRequest.quantity_requested}
                            </small>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Optional Admin Remarks */}
                    <div className="mb-4">
                      <label className="form-label" style={{ fontWeight: '500', color: 'var(--gray-700)', marginBottom: '0.5rem' }}>
                        Admin Remarks (Optional)
                      </label>
                      <textarea
                        className="form-control"
                        rows={4}
                        value={adminRemarks}
                        onChange={(e) => setAdminRemarks(e.target.value)}
                        placeholder="Add any remarks or notes for the teacher..."
                        style={{
                          border: '2px solid var(--gray-300)',
                          borderRadius: '8px',
                          fontSize: '0.9375rem',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#16a34a'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--gray-300)'
                        }}
                      />
                      <small className="form-text text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        This message will be sent to the requesting teacher
                      </small>
                    </div>

                    {/* Response Action Buttons */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '1rem', 
                      justifyContent: 'center',
                      flexWrap: 'wrap'
                    }}>
                      {selectedRequest.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              if (!approvalDueDate || approvalQuantity < 1) {
                                showNotification('Please fill in the due date and quantity before approving', 'error')
                                return
                              }
                              handleResponseAction('approve')
                            }}
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
                            Approve
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
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="modal-footer" style={{ borderTop: '1px solid var(--gray-200)', padding: '1rem 1.5rem' }}>
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
                    <h5 style={{ fontWeight: '600', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                      Confirm Action
                    </h5>
                    <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
                      Are you sure you want to{' '}
                      <strong style={{ color: 'var(--text-dark)' }}>
                        {pendingAction === 'approve' ? 'approve' : 
                         'disapprove'} this request?
                      </strong>
                    </p>
                    {pendingAction === 'approve' && (
                      <div style={{
                        backgroundColor: '#dcfce7',
                        border: '1px solid #86efac',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left'
                      }}>
                        <p style={{ margin: 0, color: '#166534', fontSize: '0.875rem' }}>
                          <i className="bi bi-info-circle me-2"></i>
                          <strong>Note:</strong> This will approve the request, assign {approvalQuantity} item(s) to the teacher with a due date of {approvalDueDate ? new Date(approvalDueDate).toLocaleDateString() : 'N/A'}, and notify the teacher. The request will be removed from the active table.
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
                          <i className="bi bi-info-circle me-2"></i>
                          <strong>Note:</strong> Disapproved requests will be removed from the active table. The teacher will be notified.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer" style={{ borderTop: '1px solid var(--gray-200)', padding: '1rem 1.5rem', justifyContent: 'center', gap: '1rem' }}>
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
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
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

export default ItemRequestManagement

