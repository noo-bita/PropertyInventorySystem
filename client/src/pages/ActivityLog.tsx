import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'

interface ActivityLog {
  id: number
  user_name: string | null
  user_role: string | null
  action: string
  module: string
  description: string
  affected_item: string | null
  created_at: string
  ip_address: string | null
}

export default function ActivityLog() {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [selectedModule, setSelectedModule] = useState<string>('')
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')
  
  // Sort states
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const itemsPerPage = 20
  
  // Filter options
  const [modules, setModules] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [users, setUsers] = useState<Array<{id: number, name: string, role: string}>>([])

  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    loadFilterOptions()
    loadActivityLogs()
  }, [location.pathname])

  // Reload logs when filters or pagination change
  useEffect(() => {
    setCurrentPage(1)
    loadActivityLogs()
  }, [selectedModule, selectedAction, selectedUser, startDate, endDate, searchTerm, sortBy, sortOrder])

  useEffect(() => {
    loadActivityLogs()
  }, [currentPage])

  const loadFilterOptions = async () => {
    try {
      const response = await apiFetch('/api/activity-logs/filter-options')
      if (response.ok) {
        const data = await response.json()
        setModules(data.modules || [])
        setActions(data.actions || [])
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error loading filter options:', error)
      // Don't block page load if filter options fail
    }
  }

  const loadActivityLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: itemsPerPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      
      if (selectedModule) params.append('module', selectedModule)
      if (selectedAction) params.append('action', selectedAction)
      if (selectedUser) params.append('user_id', selectedUser)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (searchTerm) params.append('search', searchTerm)
      
      const response = await apiFetch(`/api/activity-logs?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setLogs(data.data || [])
        setTotalPages(data.pagination?.last_page || 1)
        setTotal(data.pagination?.total || 0)
      } else {
        setError('Failed to load activity logs')
      }
    } catch (error) {
      console.error('Error loading activity logs:', error)
      setError('Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const clearFilters = () => {
    setSelectedModule('')
    setSelectedAction('')
    setSelectedUser('')
    setStartDate('')
    setEndDate('')
    setSearchTerm('')
    setCurrentPage(1)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return 'text-success'
      case 'updated':
        return 'text-info'
      case 'deleted':
        return 'text-danger'
      case 'approved':
      case 'assigned':
        return 'text-success'
      case 'rejected':
        return 'text-danger'
      case 'login':
        return 'text-primary'
      case 'logout':
        return 'text-secondary'
      default:
        return 'text-dark'
    }
  }

  const getModuleBadge = (module: string) => {
    const colors: { [key: string]: string } = {
      'auth': 'bg-primary',
      'inventory': 'bg-info',
      'request': 'bg-warning',
      'report': 'bg-danger',
      'user': 'bg-success',
    }
    return colors[module] || 'bg-secondary'
  }

  return (
    <div className="dashboard-container">
      <Sidebar currentUser={currentUser} />
      
      <main className="main-content">
        <AdminTopBar 
          currentUser={currentUser}
          searchPlaceholder="Search activity logs..."
          onSearch={setSearchTerm}
          searchValue={searchTerm}
        />
        
        {/* Loading overlay - only covers main content, sidebar remains visible */}
        {loading && (
          <div className="main-content-loading">
            <div className="full-screen-spinner">
              <div className="loading-spinner-large"></div>
              <p style={{ marginTop: 'var(--space-4)', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                Loading activity logs...
              </p>
            </div>
          </div>
        )}
        
        {!loading && (
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Activity Log</h1>
            <p className="dashboard-subtitle">
              Monitor and track all system activities and user actions
            </p>
          </div>

          {/* Filters */}
          <div className="standard-card mb-4">
            <div className="standard-card-header">
              <h3 className="standard-card-title">
                <i className="bi bi-funnel"></i>
                Filters
              </h3>
            </div>
            <div className="standard-card-body">
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Module</label>
                  <select 
                    className="form-select"
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                  >
                    <option value="">All Modules</option>
                    {modules.map(module => (
                      <option key={module} value={module}>{module}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Action</label>
                  <select 
                    className="form-select"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                  >
                    <option value="">All Actions</option>
                    {actions.map(action => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">User</label>
                  <select 
                    className="form-select"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                  >
                    <option value="">All Users</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id.toString()}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button
                    className="btn btn-outline-secondary w-100"
                    onClick={clearFilters}
                  >
                    <i className="bi bi-x-circle"></i> Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="standard-card">
            <div className="standard-card-header">
              <h3 className="standard-card-title">
                <i className="bi bi-clock-history"></i>
                Activity Logs
                {total > 0 && <span className="badge bg-primary ms-2">{total}</span>}
              </h3>
            </div>
            <div className="standard-card-body">
              {error ? (
                <div className="alert alert-danger">{error}</div>
              ) : logs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <i className="bi bi-inbox"></i>
                  </div>
                  <div className="empty-state-title">No activity logs found</div>
                  <div className="empty-state-description">
                    Activity logs will appear here as users interact with the system
                  </div>
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table table-modern">
                      <thead>
                        <tr>
                          <th 
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleSort('created_at')}
                          >
                            Date & Time
                            {sortBy === 'created_at' && (
                              <i className={`bi bi-arrow-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                            )}
                          </th>
                          <th 
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleSort('user_name')}
                          >
                            User
                            {sortBy === 'user_name' && (
                              <i className={`bi bi-arrow-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                            )}
                          </th>
                          <th>Module</th>
                          <th>Action</th>
                          <th>Description</th>
                          <th>Affected Item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id}>
                            <td>{formatDate(log.created_at)}</td>
                            <td>
                              {log.user_name ? (
                                <>
                                  <div>{log.user_name}</div>
                                  <small className="text-muted">{log.user_role}</small>
                                </>
                              ) : (
                                <span className="text-muted">System</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${getModuleBadge(log.module)}`}>
                                {log.module}
                              </span>
                            </td>
                            <td>
                              <span className={getActionColor(log.action)}>
                                <strong>{log.action.charAt(0).toUpperCase() + log.action.slice(1)}</strong>
                              </span>
                            </td>
                            <td>{log.description}</td>
                            <td>
                              {log.affected_item ? (
                                <span className="text-muted">{log.affected_item}</span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-4">
                      <div>
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} entries
                      </div>
                      <nav>
                        <ul className="pagination mb-0">
                          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                            >
                              Previous
                            </button>
                          </li>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                              // Show first page, last page, current page, and pages around current
                              return page === 1 || 
                                     page === totalPages || 
                                     (page >= currentPage - 2 && page <= currentPage + 2)
                            })
                            .map((page, index, array) => {
                              // Add ellipsis if needed
                              const prevPage = array[index - 1]
                              const showEllipsis = prevPage && page - prevPage > 1
                              
                              return (
                                <React.Fragment key={page}>
                                  {showEllipsis && (
                                    <li className="page-item disabled">
                                      <span className="page-link">...</span>
                                    </li>
                                  )}
                                  <li className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                    <button
                                      className="page-link"
                                      onClick={() => setCurrentPage(page)}
                                    >
                                      {page}
                                    </button>
                                  </li>
                                </React.Fragment>
                              )
                            })}
                          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Next
                            </button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  )
}


