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

const ReportManagement = () => {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const dataReady = useDataReady(loading)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // Dropdown expansion state
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set())
  
  // Response modal state
  const [showResponseModal, setShowResponseModal] = useState(false)
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [responseStatus, setResponseStatus] = useState('under_review')
  const [adminResponse, setAdminResponse] = useState('')
  
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReportId, setDeleteReportId] = useState<number | null>(null)
  const [deleteReportName, setDeleteReportName] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    loadReports()
  }, [location.pathname, currentUser])

  const loadReports = async () => {
    if (!currentUser) {
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      
      // Add timeout to prevent stuck loading (max 10 seconds)
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {
        console.warn('Reports data fetch timeout')
        setLoading(false)
      }, 10000)
      
        const requestsResponse = await apiFetch('/api/reports')
      
      clearTimeout(timeoutId)
      
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json()
          setRequests(requestsData)
        }
      } catch (error) {
        console.error('Error fetching reports:', error)
      } finally {
        setLoading(false)
      }
    }

  const refreshRequests = async () => {
    try {
      const requestsResponse = await apiFetch('/api/reports')
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setRequests(requestsData)
      }
    } catch (error) {
      console.error('Error refreshing reports:', error)
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

  const deleteRequest = (requestId: number, reportName: string) => {
    setDeleteReportId(requestId)
    setDeleteReportName(reportName)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteRequest = async () => {
    if (!deleteReportId) return
    
    setIsDeleting(true)
    try {
      const response = await apiFetch(`/api/reports/${deleteReportId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await refreshRequests()
        showNotification('Report deleted successfully!', 'success')
        setShowDeleteConfirm(false)
        setDeleteReportId(null)
        setDeleteReportName('')
      } else {
        const errorData = await response.json().catch(() => ({}))
        showNotification(errorData.message || 'Failed to delete report', 'error')
      }
    } catch (error) {
      console.error('Error deleting report:', error)
      showNotification('Error deleting report. Please try again.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const openResponseModal = (report: any) => {
    setSelectedReport(report)
    setResponseStatus(report.status === 'pending' ? 'under_review' : report.status)
    setAdminResponse(report.admin_response || '')
    setShowResponseModal(true)
  }

  const closeResponseModal = () => {
    setShowResponseModal(false)
    setSelectedReport(null)
    setResponseStatus('under_review')
    setAdminResponse('')
  }

  const submitResponse = async () => {
    if (!selectedReport) return

    try {
      const response = await apiFetch(`/api/reports/${selectedReport.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          status: responseStatus,
          admin_response: adminResponse
        })
      })

      if (response.ok) {
        await refreshRequests()
        closeResponseModal()
        showNotification('Response submitted successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({}))
        showNotification(`Failed to submit response: ${errorData.message || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error submitting response:', error)
      showNotification('Error submitting response. Please try again.', 'error')
    }
  }

  // Filter requests based on search term
  const filterRequests = (requestsList: any[]) => {
    if (!searchTerm) return requestsList
    const lowerSearchTerm = searchTerm.toLowerCase()
    return requestsList.filter(request => {
      const itemMatch = request.description?.match(/^(.+?)\s*\(Qty:\s*(\d+)\)(?:\s*-\s*(.+))?$/)
      const itemName = itemMatch ? itemMatch[1] : (request.description?.split(' - ')[0] || 'Unknown Item')
      
      return (
        itemName?.toLowerCase().includes(lowerSearchTerm) ||
        request.teacher_name?.toLowerCase().includes(lowerSearchTerm) ||
        String(request.id).includes(searchTerm) ||
        request.status?.toLowerCase().includes(lowerSearchTerm) ||
        request.notes?.toLowerCase().includes(lowerSearchTerm) ||
        request.description?.toLowerCase().includes(lowerSearchTerm)
      )
    })
  }

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const pendingReports = requests.filter((r: any) => String(r.status).toLowerCase() === 'pending')
  const approvedReports = requests.filter((r: any) => String(r.status).toLowerCase() === 'approved')
  const rejectedReports = requests.filter((r: any) => String(r.status).toLowerCase() === 'rejected')
  const missingReports = requests.filter((r: any) => r.notes?.toUpperCase().includes('MISSING') || r.description?.toUpperCase().includes('MISSING'))
  const damagedReports = requests.filter((r: any) => r.notes?.toUpperCase().includes('DAMAGED') || r.description?.toUpperCase().includes('DAMAGED'))

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
                Loading reports...
              </p>
            </div>
          </div>
        )}
        
        {/* Topbar inside main-content to prevent sidebar overlap */}
        <AdminTopBar 
          currentUser={currentUser}
          onSearch={(term) => setSearchTerm(term)}
          searchValue={searchTerm}
          searchPlaceholder="Search reports by teacher, item, ID, issue type, or status..."
        />
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            {/* Statistics Cards - Modern Design with Animations */}
            <div className="kpi-grid mb-4">
              <AnimatedKPI
                label="Pending"
                value={pendingReports.length}
                icon="bi-clock"
                iconClass="kpi-icon-warning"
                loading={loading}
                dataReady={dataReady}
              />
              <AnimatedKPI
                label="Approved"
                value={approvedReports.length}
                icon="bi-check-circle"
                iconClass="kpi-icon-success"
                loading={loading}
                dataReady={dataReady}
              />
              <AnimatedKPI
                label="Rejected"
                value={rejectedReports.length}
                icon="bi-x-circle"
                iconClass="kpi-icon-danger"
                loading={loading}
                dataReady={dataReady}
              />
              <AnimatedKPI
                label="Missing Items"
                value={missingReports.length}
                icon="bi-exclamation-triangle"
                iconClass="kpi-icon-danger"
                loading={loading}
                dataReady={dataReady}
              />
              <AnimatedKPI
                label="Damaged Items"
                value={damagedReports.length}
                icon="bi-tools"
                iconClass="kpi-icon-warning"
                loading={loading}
                dataReady={dataReady}
              />
              </div>

            {/* Reports Table - Modern Design */}
            <div className="standard-card">
              <div className="standard-card-header">
                <h3 className="standard-card-title">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Issue Reports
                </h3>
                <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                  {searchTerm ? (
                    <>Showing {filteredRequests.length} of {requests.length} reports</>
                  ) : (
                    <>Total: {requests.length} reports</>
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
                        <th>Issue Type</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                    {paginatedRequests.length > 0 ? (
                      paginatedRequests.map((request: any, index: number) => {
                        // Extract item name and quantity from description
                        const itemMatch = request.description?.match(/^(.+?)\s*\(Qty:\s*(\d+)\)(?:\s*-\s*(.+))?$/)
                        const itemName = itemMatch ? itemMatch[1] : (request.description?.split(' - ')[0] || 'Unknown Item')
                        const quantity = itemMatch ? itemMatch[2] : '1'
                        const isMissing = request.notes?.toUpperCase().includes('MISSING') || request.description?.toUpperCase().includes('MISSING')
                        const isDamaged = request.notes?.toUpperCase().includes('DAMAGED') || request.description?.toUpperCase().includes('DAMAGED')
                        
                        return (
                          <React.Fragment key={request.id}>
                            <tr 
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleRequestExpansion(request.id)}
                              className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                            >
                              <td>{request.id}</td>
                              <td>{request.teacher_name}</td>
                              <td>
                                <span className="badge bg-info" style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}>
                                  {itemName}
                                </span>
                                <br />
                                <small className="text-muted">Qty: {quantity}</small>
                              </td>
                              <td>
                                <span className={`badge ${
                                  isMissing ? 'bg-danger' :
                                  isDamaged ? 'bg-warning' :
                                  'bg-secondary'
                                }`} style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}>
                                  {isMissing ? 'MISSING' :
                                   isDamaged ? 'DAMAGED' : 'OTHER'}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${
                                  request.status === 'pending' ? 'bg-warning' :
                                  request.status === 'under_review' ? 'bg-info' :
                                  request.status === 'in_progress' ? 'bg-primary' :
                                  request.status === 'resolved' ? 'bg-success' :
                                  request.status === 'approved' ? 'bg-success' :
                                  request.status === 'rejected' ? 'bg-danger' :
                                  'bg-light text-dark'
                                }`} style={{
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}>
                                  {request.status?.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td>{new Date(request.created_at).toLocaleDateString()}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="btn-group btn-group-sm">
                                <button 
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => openResponseModal(request)}
                                  title="Respond to Report"
                                    style={{
                                      borderRadius: '6px',
                                      padding: '4px 12px',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.05)'
                                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)'
                                      e.currentTarget.style.boxShadow = 'none'
                                    }}
                                >
                                  <i className="bi bi-chat-dots"></i>
                                </button>
                                <button 
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => deleteRequest(request.id, request.item_name || 'Report')}
                                  title="Delete Report"
                                    style={{
                                      borderRadius: '6px',
                                      padding: '4px 12px',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.05)'
                                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)'
                                      e.currentTarget.style.boxShadow = 'none'
                                    }}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
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
                                      <i className="bi bi-info-circle me-2"></i>Report Details
                                    </h6>
                                    <div className="detail-item">
                                      <strong>Report ID:</strong> {request.id}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Teacher:</strong> {request.teacher_name}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Item Name:</strong> {itemName}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Quantity:</strong> {quantity}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Location:</strong> {request.location || 'Not specified'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Subject:</strong> {request.subject || 'Not specified'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Description:</strong> {request.description || 'No description'}
                                    </div>
                                    <div className="detail-item">
                                      <strong>Notes:</strong> {request.notes || 'No notes'}
                                    </div>
                                    {request.admin_response && (
                                      <div className="detail-item">
                                        <strong>Admin Response:</strong> 
                                        <div className="alert alert-info mt-2 mb-0">
                                          {request.admin_response}
                                        </div>
                                      </div>
                                    )}
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
                                        'bg-light text-dark'
                                      }`}>
                                        {request.status}
                                      </span>
                                    </div>
                                    <div className="detail-item">
                                      <strong>Created:</strong> {new Date(request.created_at).toLocaleString()}
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
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-5">
                          <i className={`bi ${searchTerm ? 'bi-search' : 'bi-exclamation-triangle'}`} style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                          <h5 className="mt-3 text-muted">
                            {searchTerm ? 'No reports found' : 'No Issue Reports'}
                          </h5>
                          <p className="text-muted">
                            {searchTerm 
                              ? `No reports match your search "${searchTerm}". Try a different search term.`
                              : 'No issue reports have been submitted yet.'}
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
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length} reports
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

      {/* Response Modal */}
      {showResponseModal && selectedReport && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-chat-dots me-2"></i>
                  Respond to Report #{selectedReport.id}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={closeResponseModal}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Report Details</h6>
                    <p><strong>Teacher:</strong> {selectedReport.teacher_name}</p>
                    <p><strong>Item:</strong> {selectedReport.description?.split(' - ')[0] || 'Unknown Item'}</p>
                    <p><strong>Location:</strong> {selectedReport.location}</p>
                    <p><strong>Current Status:</strong> 
                      <span className={`badge ms-2 ${
                        selectedReport.status === 'pending' ? 'bg-warning' :
                        selectedReport.status === 'under_review' ? 'bg-info' :
                        selectedReport.status === 'in_progress' ? 'bg-primary' :
                        selectedReport.status === 'resolved' ? 'bg-success' :
                        selectedReport.status === 'rejected' ? 'bg-danger' :
                        'bg-light text-dark'
                      }`}>
                        {selectedReport.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <div className="col-md-6">
                    <h6>Response</h6>
                    <div className="mb-3">
                      <label className="form-label">Update Status</label>
                      <select 
                        className="form-select"
                        value={responseStatus}
                        onChange={(e) => setResponseStatus(e.target.value)}
                      >
                        <option value="under_review">Under Review</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Admin Response</label>
                      <textarea 
                        className="form-control"
                        rows={4}
                        value={adminResponse}
                        onChange={(e) => setAdminResponse(e.target.value)}
                        placeholder="Enter your response to the teacher..."
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={closeResponseModal}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => {
                    setResponseStatus('rejected')
                    submitResponse()
                  }}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  Reject Report
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={submitResponse}
                >
                  <i className="bi bi-send me-1"></i>
                  Submit Response
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false)
            setDeleteReportId(null)
            setDeleteReportName('')
          }
        }}
        onConfirm={confirmDeleteRequest}
        title="Delete Report"
        message={`Are you sure you want to delete the report "${deleteReportName}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        type="delete"
        warningMessage="This action cannot be undone."
        isLoading={isDeleting}
      />
    </div>
  )
}

export default ReportManagement
