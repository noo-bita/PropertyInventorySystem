import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import TeacherTopBar from '../components/TeacherTopBar'
import AdminTopBar from '../components/AdminTopBar'
import CustomRequestForm from '../components/CustomRequestForm'
import '../css/global.css'
import '../css/send-request.css'
import '../css/modals.css'

const CustomRequestPage = () => {
  const { user: currentUser } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Pagination state for teacher view
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        if (currentUser?.role === 'ADMIN') {
          // For admin, fetch all custom requests
          const requestsResponse = await apiFetch('/api/custom-requests')
          if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json()
            setRequests(requestsData)
          }
        } else {
          // For teacher, fetch their custom requests
          const requestsResponse = await apiFetch('/api/custom-requests')
          if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json()
            const teacherRequests = requestsData.filter((r: any) => r.teacher_id === currentUser?.id)
            setRequests(teacherRequests)
          }
        }
      } catch (error) {
        console.error('Error fetching custom requests:', error)
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

  const refreshRequests = async () => {
    try {
      if (currentUser?.role === 'ADMIN') {
        const requestsResponse = await apiFetch('/api/custom-requests')
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json()
          setRequests(requestsData)
        }
      } else {
        const requestsResponse = await apiFetch('/api/custom-requests')
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json()
          const teacherRequests = requestsData.filter((r: any) => r.teacher_id === currentUser?.id)
          setRequests(teacherRequests)
          // Reset to first page when requests are refreshed
          setCurrentPage(1)
        }
      }
    } catch (error) {
      console.error('Error refreshing custom requests:', error)
    }
  }

  // Admin View - Manage Custom Requests
  const AdminView = () => {
    const customRequests = requests
    
    return (
      <>
        <div className="request-status-card" style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginBottom: '20px', color: '#166534' }}>
            <i className="bi bi-sliders me-2"></i>
            Custom Requests Management
          </h4>
          
          <div className="table-responsive">
            <table className="table table-hover">
              <thead className="table-light">
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
                {customRequests.map((request: any) => (
                  <tr key={request.id}>
                    <td>{request.id}</td>
                    <td>{request.teacher_name}</td>
                    <td>{request.item_name}</td>
                    <td>{request.quantity_requested}</td>
                    <td>
                      <span className={`badge ${
                        request.status === 'pending' ? 'bg-warning' :
                        request.status === 'under_review' ? 'bg-info' :
                        request.status === 'purchasing' ? 'bg-primary' :
                        request.status === 'approved' ? 'bg-success' :
                        request.status === 'rejected' ? 'bg-danger' :
                        'bg-light text-dark'
                      }`}>
                        {request.status}
                      </span>
                    </td>
                    <td>{new Date(request.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        {request.status === 'pending' && (
                          <button className="btn btn-outline-info btn-sm">
                            <i className="bi bi-chat-dots"></i>
                          </button>
                        )}
                        <button className="btn btn-outline-danger btn-sm">
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Custom Request History */}
        <div className="request-status-card" style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginBottom: '20px', color: '#166534' }}>
            <i className="bi bi-clock-history me-2"></i>
            Custom Request History
          </h4>
          
          <div className="table-responsive">
            <table className="table table-hover">
              <thead className="table-light">
                <tr>
                  <th>Item</th>
                  <th>Teacher</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Admin Response</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {customRequests.map((request: any) => (
                  <tr key={request.id}>
                    <td>{request.item_name}</td>
                    <td>{request.teacher_name}</td>
                    <td>{request.description || 'N/A'}</td>
                    <td>
                      <span className={`badge ${
                        request.status === 'pending' ? 'bg-warning' :
                        request.status === 'under_review' ? 'bg-info' :
                        request.status === 'purchasing' ? 'bg-primary' :
                        request.status === 'approved' ? 'bg-success' :
                        request.status === 'rejected' ? 'bg-danger' :
                        'bg-light text-dark'
                      }`}>
                        {request.status}
                      </span>
                    </td>
                    <td>{request.admin_response || 'No response yet'}</td>
                    <td>{new Date(request.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )
  }

  // Teacher View - Submit Custom Requests
  const TeacherView = () => {
    const myRequests = requests // Already filtered for current teacher
    
    // Pagination calculations
    const totalPages = Math.ceil(myRequests.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedRequests = myRequests.slice(startIndex, endIndex)
    
    return (
      <>
        {/* Custom Request Form Section */}
        <div className="standard-card mb-4">
          <div className="standard-card-header">
            <div>
              <h3 className="standard-card-title">
                <i className="bi bi-sliders me-2"></i>
                Custom Request
              </h3>
              <p className="dashboard-subtitle mb-0">
                Request items that are not available in the current inventory
              </p>
            </div>
          </div>
          <div className="standard-card-body">
            <CustomRequestForm currentUser={currentUser} onRequestSubmit={refreshRequests} />
          </div>
        </div>

        {/* My Custom Requests History */}
        {myRequests.length > 0 && (
          <div className="standard-card">
            <div className="standard-card-header">
              <h3 className="standard-card-title">
                <i className="bi bi-clock-history me-2"></i>
                My Custom Request History
              </h3>
              <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                Total: {myRequests.length} request{myRequests.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="standard-card-body">
              <div className="table-responsive">
                <table className="table table-modern">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>Admin Response</th>
                      <th>Request Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((request: any, index: number) => (
                      <tr key={request.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                        <td>{request.id}</td>
                        <td>{request.item_name}</td>
                        <td>{request.quantity_requested}</td>
                        <td>
                          <span className={`badge ${
                            request.status === 'pending' ? 'bg-warning' :
                            request.status === 'under_review' ? 'bg-info' :
                            request.status === 'purchasing' ? 'bg-primary' :
                            request.status === 'approved' ? 'bg-success' :
                            request.status === 'rejected' ? 'bg-danger' :
                            'bg-light text-dark'
                          }`} style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            <i className={`bi ${
                              request.status === 'pending' ? 'bi-clock' :
                              request.status === 'under_review' ? 'bi-search' :
                              request.status === 'purchasing' ? 'bi-cart' :
                              request.status === 'approved' ? 'bi-check-circle' :
                              request.status === 'rejected' ? 'bi-x-circle' :
                              'bi-question-circle'
                            } me-1`}></i>
                            {request.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {request.admin_response ? (
                            <span className="text-success">
                              <i className="bi bi-chat-dots me-1"></i>
                              Response Available
                            </span>
                          ) : (
                            <span className="text-muted">No response yet</span>
                          )}
                        </td>
                        <td>{new Date(request.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
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
                    Showing {startIndex + 1} to {Math.min(endIndex, myRequests.length)} of {myRequests.length} requests
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
        )}
      </>
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
                Loading custom requests...
              </p>
            </div>
          </div>
        )}
        
        {currentUser.role === 'ADMIN' ? <AdminTopBar /> : <TeacherTopBar />}
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            {currentUser.role === 'ADMIN' ? <AdminView /> : <TeacherView />}
          </div>
        </div>
      </main>
    </div>
  )
}

export default CustomRequestPage
