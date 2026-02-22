import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import TeacherTopBar from '../components/TeacherTopBar'
import AdminTopBar from '../components/AdminTopBar'
import ReportForm from '../components/ReportForm'
import { AnimatedKPI } from '../components/AnimatedKPI'
import { useDataReady } from '../hooks/useDataReady'

const ReportPage = () => {
  const { user: currentUser } = useAuth()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const dataReady = useDataReady(loading)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reportsResponse = await apiFetch('/api/reports')
        if (reportsResponse.ok) {
          const reportsData = await reportsResponse.json()
          setRequests(reportsData)
        }
      } catch (error) {
        console.error('Error fetching reports:', error)
      } finally {
        setLoading(false)
      }
    }

    if (currentUser) {
      fetchReports()
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchReports, 30000)
      
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [currentUser])

  const refreshRequests = async () => {
    try {
      const reportsResponse = await apiFetch('/api/reports')
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json()
        setRequests(reportsData)
      }
    } catch (error) {
      console.error('Error refreshing reports:', error)
    }
  }

  // Admin View - Manage Reports
  const AdminView = () => {
    const reports = requests // All reports are already filtered by the API
    
    console.log('AdminView - requests state:', requests)
    console.log('AdminView - reports length:', reports.length)
    
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
            <i className="bi bi-exclamation-triangle me-2"></i>
            Issue Reports Management
          </h4>
          
          <div className="mb-3">
            <button 
              className="btn btn-primary btn-sm" 
              onClick={async () => {
                console.log('Manual fetch test...')
                try {
                  const response = await apiFetch('/api/reports')
                  console.log('Manual fetch response:', response)
                  const data = await response.json()
                  console.log('Manual fetch data:', data)
                  setRequests(data)
                } catch (error) {
                  console.error('Manual fetch error:', error)
                }
              }}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              Test Fetch Reports
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="alert alert-warning">
              <i className="bi bi-exclamation-triangle me-2"></i>
              No reports found. Reports will appear here when teachers submit them.
            </div>
          ) : (
            <div className="alert alert-success">
              <i className="bi bi-check-circle me-2"></i>
              Found {reports.length} report(s)
            </div>
          )}
          
          {reports.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Teacher</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report: any) => {
                    // Extract item name and quantity from description (format: "Item Name (Qty: X) - Description" or "Item Name (Qty: X)")
                    const itemMatch = report.description?.match(/^(.+?)\s*\(Qty:\s*(\d+)\)(?:\s*-\s*(.+))?$/)
                    const itemName = itemMatch ? itemMatch[1] : (report.description?.split(' - ')[0] || 'Unknown Item')
                    const quantity = itemMatch ? itemMatch[2] : '1'
                    return (
                      <tr key={report.id}>
                        <td>{report.id}</td>
                        <td>{report.teacher_name}</td>
                        <td>
                          <span className="badge bg-info text-dark">
                            {itemName}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-warning text-dark">
                            {quantity}
                          </span>
                        </td>
                        <td>{report.location}</td>
                      <td>
                        <span className={`badge ${
                          report.status === 'pending' ? 'bg-warning' :
                          report.status === 'under_review' ? 'bg-info' :
                          report.status === 'in_progress' ? 'bg-primary' :
                          report.status === 'resolved' ? 'bg-success' :
                          report.status === 'rejected' ? 'bg-danger' :
                          'bg-light text-dark'
                        }`}>
                          {report.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>{new Date(report.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            {report.status === 'pending' && (
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Report History */}
        <div className="request-status-card" style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <h4 style={{ marginBottom: '20px', color: '#166534' }}>
            <i className="bi bi-clock-history me-2"></i>
            Report History
          </h4>
          
          <div className="row">
            <div className="col-md-6">
              <div className="card border-danger">
                <div className="card-header bg-danger text-white">
                  <h6 className="mb-0">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Missing Items
                  </h6>
                </div>
                <div className="card-body">
                  <h4 className="text-danger">
                    {reports.filter(r => r.status === 'pending').length}
                  </h4>
                  <p className="text-muted mb-0">Pending reports</p>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card border-warning">
                <div className="card-header bg-warning text-white">
                  <h6 className="mb-0">
                    <i className="bi bi-check-circle me-2"></i>
                    Resolved Reports
                  </h6>
                </div>
                <div className="card-body">
                  <h4 className="text-success">
                    {reports.filter(r => r.status === 'resolved').length}
                  </h4>
                  <p className="text-muted mb-0">Resolved reports</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Teacher View - Submit Reports
  const TeacherView = () => {
    const myReports = requests.filter((r: any) => 
      String(r.teacher_name).toLowerCase() === String(currentUser.name).toLowerCase()
    )
    
    // Calculate status counts
    const pendingCount = myReports.filter((r: any) => r.status === 'pending').length
    const underReviewCount = myReports.filter((r: any) => r.status === 'under_review').length
    const inProgressCount = myReports.filter((r: any) => r.status === 'in_progress').length
    const resolvedCount = myReports.filter((r: any) => r.status === 'resolved').length
    const rejectedCount = myReports.filter((r: any) => r.status === 'rejected').length
    
    return (
      <>
        {/* Header Section */}
        <div className="standard-card mb-4">
          <div className="standard-card-header">
            <div>
              <h3 className="standard-card-title">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Report Item Issues
              </h3>
              <p className="dashboard-subtitle mb-0">
                Report missing, damaged, or other issues with items assigned to you
              </p>
            </div>
          </div>
        </div>

        {/* Status Summary Cards - Enhanced Modern Design with Animations */}
        <div className="kpi-grid">
          <AnimatedKPI
            label="Pending"
            value={pendingCount}
            icon="bi-clock"
            iconClass="kpi-icon-warning"
            loading={loading}
            dataReady={dataReady}
          />
          
          <AnimatedKPI
            label="Under Review"
            value={underReviewCount}
            icon="bi-eye"
            iconClass="kpi-icon-info"
            loading={loading}
            dataReady={dataReady}
          />
          
          <AnimatedKPI
            label="In Progress"
            value={inProgressCount}
            icon="bi-gear"
            iconClass="kpi-icon-primary"
            loading={loading}
            dataReady={dataReady}
          />
          
          <AnimatedKPI
            label="Resolved"
            value={resolvedCount}
            icon="bi-check-circle"
            iconClass="kpi-icon-success"
            loading={loading}
            dataReady={dataReady}
          />
          
          <AnimatedKPI
            label="Rejected"
            value={rejectedCount}
            icon="bi-x-circle"
            iconClass="kpi-icon-danger"
            loading={loading}
            dataReady={dataReady}
          />
        </div>

        {/* Report Form Section */}
        <div className="standard-card mb-4">
          <div className="standard-card-body">
            <ReportForm currentUser={currentUser} onRequestSubmit={refreshRequests} />
          </div>
        </div>

        {/* My Issue Reports History */}
        <div className="standard-card">
          <div className="standard-card-header">
            <h3 className="standard-card-title">
              <i className="bi bi-clock-history me-2"></i>
              My Issue Reports
            </h3>
            <div className="text-muted" style={{ fontSize: '0.875rem' }}>
              {myReports.length > 0 
                ? `Total: ${myReports.length} report${myReports.length !== 1 ? 's' : ''}`
                : 'No reports yet'}
            </div>
          </div>
          <div className="standard-card-body">
            
            {myReports.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-modern">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>Admin Response</th>
                      <th>Report Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myReports.map((report: any, index: number) => {
                      // Extract item name and quantity from description (format: "Item Name (Qty: X) - Description" or "Item Name (Qty: X)")
                      const itemMatch = report.description?.match(/^(.+?)\s*\(Qty:\s*(\d+)\)(?:\s*-\s*(.+))?$/)
                      const itemName = itemMatch ? itemMatch[1] : (report.description?.split(' - ')[0] || 'Unknown Item')
                      const quantity = itemMatch ? itemMatch[2] : '1'
                      const description = itemMatch ? (itemMatch[3] || 'No description provided') : (report.description?.split(' - ').slice(1).join(' - ') || 'No description provided')
                      return (
                        <tr key={report.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                          <td>{report.id}</td>
                          <td>
                            <span className="badge bg-info text-dark" style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {itemName}
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-warning text-dark" style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {quantity}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              report.status === 'pending' ? 'bg-warning' :
                              report.status === 'under_review' ? 'bg-info' :
                              report.status === 'in_progress' ? 'bg-primary' :
                              report.status === 'resolved' ? 'bg-success' :
                              report.status === 'rejected' ? 'bg-danger' :
                              'bg-light text-dark'
                            }`} style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {report.status === 'pending' && <i className="bi bi-clock me-1"></i>}
                              {report.status === 'under_review' && <i className="bi bi-eye me-1"></i>}
                              {report.status === 'in_progress' && <i className="bi bi-gear me-1"></i>}
                              {report.status === 'resolved' && <i className="bi bi-check-circle me-1"></i>}
                              {report.status === 'rejected' && <i className="bi bi-x-circle me-1"></i>}
                              {report.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {report.admin_response ? (
                              <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                <i className="bi bi-chat-dots me-1"></i>
                                {report.admin_response}
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '0.875rem' }}>No response yet</span>
                            )}
                          </td>
                          <td>{new Date(report.created_at).toLocaleDateString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-5">
                <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                <h5 className="mt-3 text-muted">No Issue Reports</h5>
                <p className="text-muted">
                  You haven't submitted any issue reports yet. Use the form above to report missing, damaged, or other issues with your assigned items.
                </p>
              </div>
            )}
          </div>
        </div>
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
                Loading issue reports...
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

export default ReportPage
