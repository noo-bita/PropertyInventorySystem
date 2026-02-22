import React, { useState, useEffect } from 'react'
import { apiFetch } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import TeacherTopBar from '../components/TeacherTopBar'
import AdminTopBar from '../components/AdminTopBar'
import ConfirmationModal from '../components/ConfirmationModal'
import { showNotification } from '../utils/notifications'

const SendRequest = () => {
  const { user: currentUser } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [approvalDueDate, setApprovalDueDate] = useState('')
  const [approvalQuantity, setApprovalQuantity] = useState(1)
  
  // Custom request response modal state
  const [showCustomResponseModal, setShowCustomResponseModal] = useState(false)
  const [customResponse, setCustomResponse] = useState('')
  const [customResponseStatus, setCustomResponseStatus] = useState('under_review')
  
  // Dropdown expansion state
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set())
  
  // Confirmation modal state
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingRequestId, setPendingRequestId] = useState<number | null>(null)
  const [pendingRequestName, setPendingRequestName] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        // Get requests
        const requestsResponse = await apiFetch('/api/requests')
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json()
          setRequests(requestsData)
        }
      } catch (error) {
        console.error('Error fetching requests:', error)
      } finally {
        setLoading(false)
      }
    }

    if (currentUser) {
      fetchRequests()
    } else {
      setLoading(false)
    }
  }, [currentUser])

  // Admin View - Manage Requests
  const AdminView = () => {
    const pendingRequests = requests.filter((r: any) => String(r.status).toLowerCase() === 'pending')
    const approvedRequests = requests.filter((r: any) => 
      String(r.status).toLowerCase() === 'approved' || String(r.status).toLowerCase() === 'assigned'
    )
    const rejectedRequests = requests.filter((r: any) => String(r.status).toLowerCase() === 'rejected')

    return (
      <>
        {/* Request Status Cards */}
        <div className="request-status-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '16px', 
          marginBottom: '20px' 
        }}>
          <div className="request-status-card" style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #ffc107'
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="text-warning mb-1">Pending</h6>
                <h3 className="mb-0">{pendingRequests.length}</h3>
              </div>
              <i className="bi bi-clock text-warning" style={{ fontSize: '24px' }}></i>
            </div>
          </div>

          <div className="request-status-card" style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #28a745'
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="text-success mb-1">Approved & Assigned</h6>
                <h3 className="mb-0">{approvedRequests.length}</h3>
              </div>
              <i className="bi bi-check-circle text-success" style={{ fontSize: '24px' }}></i>
            </div>
          </div>

          <div className="request-status-card" style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #dc3545'
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="text-danger mb-1">Rejected</h6>
                <h3 className="mb-0">{rejectedRequests.length}</h3>
              </div>
              <i className="bi bi-x-circle text-danger" style={{ fontSize: '24px' }}></i>
            </div>
          </div>

        </div>

        {/* Requests Table */}
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">All Requests</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Teacher</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request: any) => (
                    <React.Fragment key={request.id}>
                      <tr 
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleRequestExpansion(request.id)}
                      >
                        <td>{request.id}</td>
                        <td>{request.teacher_name}</td>
                        <td>
                          <span className={`badge ${
                            request.request_type === 'custom' ? 'bg-info' :
                            request.request_type === 'report' ? 'bg-warning' :
                            request.request_type === 'item' ? 'bg-primary' :
                            'bg-secondary'
                          }`}>
                            {request.request_type === 'custom' ? 'Custom' :
                             request.request_type === 'report' ? 'Report' :
                             request.request_type === 'item' ? 'Item' :
                             'Unknown'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            request.status === 'pending' ? 'bg-warning' :
                            request.status === 'approved' ? 'bg-success' :
                            request.status === 'rejected' ? 'bg-danger' :
                            request.status === 'assigned' ? 'bg-info' :
                            request.status === 'returned' ? 'bg-secondary' :
                            'bg-light text-dark'
                          }`}>
                            {request.status}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            request.priority === 'urgent' ? 'bg-danger' :
                            request.priority === 'high' ? 'bg-warning' :
                            request.priority === 'medium' ? 'bg-info' :
                            'bg-secondary'
                          }`}>
                            {request.priority || 'N/A'}
                          </span>
                        </td>
                        <td>{new Date(request.created_at).toLocaleDateString()}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="btn-group btn-group-sm">
                            {request.status === 'pending' && request.request_type === 'custom' && (
                              <button 
                                className="btn btn-outline-info btn-sm"
                                onClick={() => openCustomResponseModal(request)}
                                title="Respond to Custom Request"
                              >
                                <i className="bi bi-chat-dots"></i>
                              </button>
                            )}
                            {request.status === 'pending' && request.request_type !== 'custom' && (
                              <button 
                                className="btn btn-outline-success btn-sm"
                                onClick={() => openApprovalModal(request)}
                                title="Approve Request"
                              >
                                <i className="bi bi-check"></i>
                              </button>
                            )}
                            <button 
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => deleteRequest(request.id, request.item_name)}
                              title="Delete Request"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRequests.has(request.id) && (
                        <tr className="expanded-details">
                          <td colSpan={6}>
                            <div className="request-details-grid" style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                              gap: '20px',
                              padding: '20px',
                              backgroundColor: '#f8f9fa',
                              border: '1px solid #dee2e6',
                              borderRadius: '8px',
                              margin: '10px 0'
                            }}>
                              {/* Request Details */}
                              <div className="detail-section">
                                <h6 style={{ color: '#495057', marginBottom: '15px', borderBottom: '2px solid #16a34a', paddingBottom: '5px' }}>
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
                                {request.request_type === 'custom' && (
                                  <>
                                    <div className="detail-item">
                                      <strong>Description:</strong> {request.description || 'No description'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Subject:</strong> {request.subject || 'No subject'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Admin Response:</strong> {request.admin_response || 'No response yet'}
                                    </div>
                                    {request.photo && (
                                      <div className="detail-item">
                                        <strong>Item Photo:</strong>
                                        <div className="mt-2">
                                          <img 
                                            src={request.photo} 
                                            alt="Item photo" 
                                            style={{ 
                                              maxWidth: '200px', 
                                              maxHeight: '200px', 
                                              objectFit: 'cover',
                                              borderRadius: '8px',
                                              border: '1px solid #dee2e6'
                                            }} 
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>

                              {/* Status & Dates */}
                              <div className="detail-section">
                                <h6 style={{ color: '#495057', marginBottom: '15px', borderBottom: '2px solid #28a745', paddingBottom: '5px' }}>
                                  <i className="bi bi-calendar-check me-2"></i>Status & Timeline
                                </h6>
                                <div className="detail-item">
                                  <strong>Status:</strong> 
                                  <span className={`badge ms-2 ${
                                    request.status === 'pending' ? 'bg-warning' :
                                    request.status === 'approved' ? 'bg-success' :
                                    request.status === 'rejected' ? 'bg-danger' :
                                    request.status === 'assigned' ? 'bg-info' :
                                    request.status === 'returned' ? 'bg-secondary' :
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Custom Response Modal */}
        <CustomResponseModal />
      </>
    )
  }

  // Function to refresh requests
  const refreshRequests = async () => {
    try {
      const requestsResponse = await apiFetch('/api/requests')
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setRequests(requestsData)
      }
    } catch (error) {
      console.error('Error refreshing requests:', error)
    }
  }

  // Toggle request expansion
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

  // Request management functions
  const openApprovalModal = (request: any) => {
    setSelectedRequest(request)
    setApprovalDueDate('')
    setApprovalQuantity(request.quantity_requested || 1)
    setShowApprovalModal(true)
  }

  const openCustomResponseModal = (request: any) => {
    setSelectedRequest(request)
    setCustomResponse('')
    setCustomResponseStatus('under_review')
    setShowCustomResponseModal(true)
  }

  const deleteRequest = (requestId: number, requestName: string) => {
    setPendingRequestId(requestId)
    setPendingRequestName(requestName)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteRequest = async () => {
    if (!pendingRequestId) return
    
    setIsProcessing(true)
    try {
      const response = await apiFetch(`/api/requests/${pendingRequestId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await refreshRequests()
        showNotification('Request deleted successfully!', 'success')
        setShowDeleteConfirm(false)
        setPendingRequestId(null)
        setPendingRequestName('')
      } else {
        const errorData = await response.json().catch(() => ({}))
        showNotification(errorData.message || 'Failed to delete request', 'error')
      }
    } catch (error) {
      console.error('Error deleting request:', error)
      showNotification('Error deleting request. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const rejectRequest = (requestId: number, requestName: string) => {
    setPendingRequestId(requestId)
    setPendingRequestName(requestName)
    setShowRejectConfirm(true)
  }

  const confirmRejectRequest = async () => {
    if (!pendingRequestId) return
    
    setIsProcessing(true)
    try {
      const response = await apiFetch(`/api/requests/${pendingRequestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected' })
      })
      
      if (response.ok) {
        await refreshRequests()
        showNotification('Request rejected successfully!', 'success')
        setShowApprovalModal(false)
        setShowRejectConfirm(false)
        setPendingRequestId(null)
        setPendingRequestName('')
      } else {
        const errorData = await response.json().catch(() => ({}))
        showNotification(errorData.message || 'Failed to reject request', 'error')
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
      showNotification('Error rejecting request. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const approveRequest = async () => {
    if (!selectedRequest) return
    
    try {
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
        setShowApprovalModal(false)
      } else {
        const errorData = await res.json().catch(() => ({}))
        showNotification(errorData.message || 'Failed to approve request', 'error')
      }
    } catch (error) {
      console.error('Error approving request:', error)
      showNotification('Error approving request. Please try again.', 'error')
    }
  }

  // Return item function
  const returnItem = async (requestId: number) => {
    try {
      const response = await apiFetch(`/api/requests/${requestId}/teacher-return`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await refreshRequests()
        showNotification('Item returned successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({}))
        showNotification(errorData.message || 'Failed to return item', 'error')
      }
    } catch (error) {
      console.error('Error returning item:', error)
      showNotification('Error returning item. Please try again.', 'error')
    }
  }

  const respondToCustomRequest = async () => {
    if (!selectedRequest) return
    try {
      const res = await apiFetch(`/api/requests/${selectedRequest.id}/custom-response`, {
        method: 'POST',
        body: JSON.stringify({
          status: customResponseStatus,
          admin_response: customResponse
        })
      })
      if (res.ok) {
        await refreshRequests()
        showNotification('Response sent successfully!', 'success')
        setShowCustomResponseModal(false)
      } else {
        const errorData = await res.json().catch(() => ({}))
        showNotification(errorData.message || 'Failed to send response', 'error')
      }
    } catch (error) {
      console.error('Error sending response:', error)
      showNotification('Error sending response. Please try again.', 'error')
    }
  }

  // Custom Response Modal
  const CustomResponseModal = () => {
    if (!showCustomResponseModal || !selectedRequest) return null

    return (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Respond to Custom Request</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowCustomResponseModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <strong>Item:</strong> {selectedRequest.item_name}<br/>
                <strong>Teacher:</strong> {selectedRequest.teacher_name}<br/>
                <strong>Quantity:</strong> {selectedRequest.quantity_requested}<br/>
                <strong>Description:</strong> {selectedRequest.description || 'N/A'}
              </div>
              
              <div className="mb-3">
                <label className="form-label">Response Status *</label>
                <select 
                  className="form-select"
                  value={customResponseStatus}
                  onChange={(e) => setCustomResponseStatus(e.target.value)}
                >
                  <option value="under_review">Under Review</option>
                  <option value="purchasing">Being Purchased</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Admin Response</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={customResponse}
                  onChange={(e) => setCustomResponse(e.target.value)}
                  placeholder="Add your response to the teacher..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowCustomResponseModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={respondToCustomRequest}
              >
                Send Response
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Teacher View - Submit Requests (currently unused due to admin-only access check)
  // @ts-ignore - Intentionally unused, kept for potential future use
  const TeacherView = () => {
    if (!currentUser) return null
    
    const myRequests = requests.filter((r: any) => String(r.teacher_name).toLowerCase() === String(currentUser?.name || '').toLowerCase())
    const pendingRequests = myRequests.filter((r: any) => String(r.status).toLowerCase() === 'pending')
    const approvedRequests = myRequests.filter((r: any) => String(r.status).toLowerCase() === 'approved')
    const rejectedRequests = myRequests.filter((r: any) => String(r.status).toLowerCase() === 'rejected')
    const assignedRequests = myRequests.filter((r: any) => String(r.status).toLowerCase() === 'assigned')

    return (
      <>
        {/* Request Status Cards */}
        <div className="request-status-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '16px', 
          marginBottom: '20px' 
        }}>
          <div className="request-status-card" style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #ffc107'
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="text-warning mb-1">Pending</h6>
                <h3 className="mb-0">{pendingRequests.length}</h3>
              </div>
              <i className="bi bi-clock text-warning" style={{ fontSize: '24px' }}></i>
            </div>
          </div>

          <div className="request-status-card" style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #28a745'
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="text-success mb-1">Approved & Assigned</h6>
                <h3 className="mb-0">{approvedRequests.length}</h3>
              </div>
              <i className="bi bi-check-circle text-success" style={{ fontSize: '24px' }}></i>
            </div>
          </div>

          <div className="request-status-card" style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '20px', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: '4px solid #dc3545'
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <h6 className="text-danger mb-1">Rejected</h6>
                <h3 className="mb-0">{rejectedRequests.length}</h3>
              </div>
              <i className="bi bi-x-circle text-danger" style={{ fontSize: '24px' }}></i>
            </div>
          </div>

        </div>

        {/* New Request Button */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Request Management</h4>
          <button className="btn btn-primary">
            <i className="bi bi-plus-circle me-2"></i>
            New Request
          </button>
        </div>

        {/* Assigned Items Section */}
        {assignedRequests.length > 0 && (
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
                <i className="bi bi-box-seam text-success" style={{ fontSize: '20px' }}></i>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Your Assigned Items</h4>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedRequests.map((request: any) => (
                    <tr key={request.id}>
                      <td>{request.item_name}</td>
                      <td>{request.quantity_assigned}</td>
                      <td>{request.due_date ? new Date(request.due_date).toLocaleDateString() : 'Not set'}</td>
                      <td>
                        <span className={`badge ${
                          request.status === 'assigned' ? 'bg-info' : 'bg-secondary'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => returnItem(request.id)}
                          title="Return Item"
                        >
                          <i className="bi bi-arrow-return-left"></i>
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Redirect to specific request pages */}
        <div className="request-status-card" style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '40px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <h4 style={{ marginBottom: '20px', color: '#166534' }}>
            <i className="bi bi-file-earmark-text me-2"></i>
            Request Management
          </h4>
          <p className="text-muted mb-4">Choose the type of request you want to manage:</p>
          
          <div className="row">
            <div className="col-md-4 mb-3">
              <a href="/send-request/item" className="btn btn-outline-primary btn-lg w-100">
                <i className="bi bi-box-seam me-2"></i>
                Item Request
              </a>
            </div>
            <div className="col-md-4 mb-3">
              <a href="/send-request/custom" className="btn btn-outline-info btn-lg w-100">
                <i className="bi bi-sliders me-2"></i>
                Custom Request
              </a>
            </div>
            <div className="col-md-4 mb-3">
              <a href="/send-request/report" className="btn btn-outline-warning btn-lg w-100">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Report Issue
              </a>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar currentUser={currentUser || { name: '', role: 'TEACHER' }} />
        <main className="main-content">
          {currentUser?.role === 'ADMIN' ? <AdminTopBar /> : <TeacherTopBar />}
          <div className="dashboard-content">
            <div className="container-fluid py-4">
              <div className="request-status-card" style={{ 
                background: 'white', 
                borderRadius: '12px', 
                padding: '20px', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '20px'
              }}>
                <div className="skeleton skeleton-title" style={{ width: '300px', height: '28px', marginBottom: '20px' }}></div>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th><div className="skeleton skeleton-text" style={{ width: '40px', height: '16px' }}></div></th>
                        <th><div className="skeleton skeleton-text" style={{ width: '100px', height: '16px' }}></div></th>
                        <th><div className="skeleton skeleton-text" style={{ width: '120px', height: '16px' }}></div></th>
                        <th><div className="skeleton skeleton-text" style={{ width: '80px', height: '16px' }}></div></th>
                        <th><div className="skeleton skeleton-text" style={{ width: '100px', height: '16px' }}></div></th>
                        <th><div className="skeleton skeleton-text" style={{ width: '100px', height: '16px' }}></div></th>
                        <th><div className="skeleton skeleton-text" style={{ width: '80px', height: '16px' }}></div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="skeleton-table-row">
                          <td><div className="skeleton skeleton-table-cell" style={{ width: '40px' }}></div></td>
                          <td><div className="skeleton skeleton-table-cell" style={{ width: '120px' }}></div></td>
                          <td><div className="skeleton skeleton-table-cell" style={{ width: '150px' }}></div></td>
                          <td><div className="skeleton skeleton-table-cell" style={{ width: '60px' }}></div></td>
                          <td><div className="skeleton skeleton-table-cell" style={{ width: '80px' }}></div></td>
                          <td><div className="skeleton skeleton-table-cell" style={{ width: '100px' }}></div></td>
                          <td><div className="skeleton skeleton-table-cell" style={{ width: '80px' }}></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">Access Denied</h4>
        <p>You must be logged in to access this page.</p>
      </div>
    )
  }

  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">Access Denied</h4>
        <p>Only administrators can access this page.</p>
      </div>
    )
  }

  return (
    <>
      <style>
        {`
          .expanded-details {
            background-color: #f8f9fa;
          }
          .expanded-details td {
            border-top: none;
            padding: 0;
          }
          .detail-item {
            margin-bottom: 8px;
            padding: 4px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .detail-item:last-child {
            border-bottom: none;
          }
          .detail-section h6 {
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .request-details-grid {
            font-size: 14px;
          }
          .request-details-grid strong {
            color: #495057;
            min-width: 140px;
            display: inline-block;
          }
        `}
      </style>
      <div className="dashboard-container">
        <Sidebar currentUser={currentUser} />
      
      <main className="main-content">
        {currentUser.role === 'ADMIN' ? (
          <AdminTopBar 
            searchPlaceholder="Search requests..." 
            currentUser={currentUser}
          />
        ) : (
          <TeacherTopBar 
            searchPlaceholder="Search requests..." 
            currentUser={currentUser}
          />
        )}
        
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Request Management</h1>
            <div className="d-flex align-items-center gap-3">
              <span className="text-muted">Welcome, {currentUser.name}</span>
              <span className={`badge ${currentUser.role === 'ADMIN' ? 'bg-danger' : 'bg-primary'}`}>
                {currentUser.role}
              </span>
            </div>
          </div>

          <AdminView />
        </div>
      </main>

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Approve Request</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowApprovalModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Request Details</label>
                  <div className="card">
                    <div className="card-body">
                      <p><strong>Teacher:</strong> {selectedRequest.teacher_name}</p>
                      <p><strong>Item:</strong> {selectedRequest.item_name}</p>
                      <p><strong>Quantity Requested:</strong> {selectedRequest.quantity_requested}</p>
                    </div>
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                        Due Date *
                      </label>
                      <input
                        type="date"
                        value={approvalDueDate}
                        onChange={(e) => setApprovalDueDate(e.target.value)}
                        className="form-control"
                        style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <small className="text-muted">Set when the item should be returned</small>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
                        Quantity to Assign *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedRequest.quantity_requested}
                        value={approvalQuantity}
                        onChange={(e) => setApprovalQuantity(parseInt(e.target.value) || 1)}
                        className="form-control"
                        style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
                      />
                      <small className="text-muted">Maximum: {selectedRequest.quantity_requested}</small>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowApprovalModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => rejectRequest(selectedRequest.id, selectedRequest.item_name)}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  Reject Request
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={approveRequest}
                  disabled={!approvalDueDate || approvalQuantity < 1}
                >
                  <i className="bi bi-check-circle me-1"></i>
                  Approve & Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRejectConfirm}
        onClose={() => {
          if (!isProcessing) {
            setShowRejectConfirm(false)
            setPendingRequestId(null)
            setPendingRequestName('')
          }
        }}
        onConfirm={confirmRejectRequest}
        title="Reject Request"
        message={`Are you sure you want to reject the request for "${pendingRequestName}"?`}
        confirmText="Reject"
        cancelText="Cancel"
        type="reject"
        warningMessage="Rejected requests will be removed from the active table. This action cannot be undone."
        isLoading={isProcessing}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isProcessing) {
            setShowDeleteConfirm(false)
            setPendingRequestId(null)
            setPendingRequestName('')
          }
        }}
        onConfirm={confirmDeleteRequest}
        title="Delete Request"
        message={`Are you sure you want to delete the request for "${pendingRequestName}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        type="delete"
        warningMessage="This action cannot be undone."
        isLoading={isProcessing}
      />
    </div>
    </>
  )
}

export default SendRequest