import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import { AnimatedKPI } from '../components/AnimatedKPI'
import BudgetWidget from '../components/BudgetWidget'
import { useDataReady } from '../hooks/useDataReady'
import '../css/global.css'
import '../css/dashboard.css'

interface TeacherDashboardData {
  assignedItemsCount: number
  pendingRequestsCount: number
  approvedRequestsCount: number
  itemsDueSoon: number
  recentActivity: any[]
  myRequests: any[]
  myAssignedItems: any[]
}

export default function TeacherDashboard() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const dataReady = useDataReady(loading)
  
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData>({
    assignedItemsCount: 0,
    pendingRequestsCount: 0,
    approvedRequestsCount: 0,
    itemsDueSoon: 0,
    recentActivity: [],
    myRequests: [],
    myAssignedItems: []
  })

  // Pagination state for Recent Activity
  const [activityPage, setActivityPage] = useState(1)
  const itemsPerPage = 4

  // Fetch teacher-specific dashboard data - using optimized dashboard endpoint
  useEffect(() => {
    const fetchTeacherDashboardData = async () => {
      if (!currentUser) {
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        
        // Add timeout to prevent stuck loading
        let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {
          console.warn('Teacher dashboard data fetch timeout')
          setLoading(false)
        }, 10000)
        
        // Use optimized dashboard endpoint instead of fetching all requests
        const dashboardRes = await apiFetch(`/api/dashboard/teacher?teacher_name=${encodeURIComponent(currentUser.name)}`)
        
        clearTimeout(timeoutId)

        if (dashboardRes.ok) {
          const data = await dashboardRes.json()
          
          setDashboardData({
            assignedItemsCount: data.assignedItemsCount || 0,
            pendingRequestsCount: data.pendingRequestsCount || 0,
            approvedRequestsCount: data.approvedRequestsCount || 0,
            itemsDueSoon: data.itemsDueSoon || 0,
            recentActivity: data.recentActivity || [],
            myRequests: data.myRequests || [],
            myAssignedItems: data.myAssignedItems || []
          })
          
          setTimeout(() => {
            setDataReady(true)
          }, 100)
        } else {
          console.error('Failed to fetch teacher dashboard data')
          setLoading(false)
          setDataReady(false)
        }
      } catch (error) {
        console.error('Error fetching teacher dashboard data:', error)
        setLoading(false)
        setDataReady(false)
      } finally {
        setLoading(false)
      }
    }

    if (currentUser) {
      fetchTeacherDashboardData()
    }
  }, [currentUser])

  // Reset to page 1 when activity data changes
  useEffect(() => {
    setActivityPage(1)
  }, [dashboardData.recentActivity.length])

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <h1 className="dashboard-title">My Dashboard</h1>
        <p className="dashboard-subtitle">
          Welcome back, {currentUser?.name}! Here's an overview of your items and requests.
        </p>
      </div>

      {/* Budget Widget - Read-only for Teachers */}
      <div style={{ marginBottom: '1.5rem' }}>
        <BudgetWidget />
      </div>

      {/* Teacher-Specific KPI Cards */}
      <div className="kpi-grid kpi-grid-teacher">
        <AnimatedKPI
          key={`assigned-items-${dataReady}`}
          label="My Assigned Items"
          value={dashboardData.assignedItemsCount}
          icon="bi-box-seam"
          iconClass="kpi-icon-primary"
          loading={loading}
          dataReady={dataReady}
        />
        
        <AnimatedKPI
          key={`pending-requests-${dataReady}`}
          label="Pending Requests"
          value={dashboardData.pendingRequestsCount}
          icon="bi-clock-history"
          iconClass="kpi-icon-warning"
          loading={loading}
          dataReady={dataReady}
        />
        
        <AnimatedKPI
          key={`approved-requests-${dataReady}`}
          label="Approved Requests"
          value={dashboardData.approvedRequestsCount}
          icon="bi-check-circle"
          iconClass="kpi-icon-success"
          loading={loading}
          dataReady={dataReady}
        />
        
        <AnimatedKPI
          key={`items-due-soon-${dataReady}`}
          label="Items Due Soon"
          value={dashboardData.itemsDueSoon}
          icon="bi-calendar-exclamation"
          iconClass="kpi-icon-danger"
          loading={loading}
          dataReady={dataReady}
        />
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Recent Activity - Teacher's Own Activity Only */}
        <div className="standard-card">
          <div className="standard-card-header">
            <h3 className="standard-card-title">
              <i className="bi bi-clock-history"></i>
              My Recent Activity
            </h3>
          </div>
          <div className="standard-card-body">
            {loading ? (
              <div className="empty-state">
                <div className="loading-spinner"></div>
                <p className="mt-2">Loading activity...</p>
              </div>
            ) : dashboardData.recentActivity.length > 0 ? (
              <>
                <div className={`activity-list ${dataReady ? 'fade-in' : ''}`}>
                  {(() => {
                    const startIndex = (activityPage - 1) * itemsPerPage
                    const endIndex = startIndex + itemsPerPage
                    const paginatedActivities = dashboardData.recentActivity.slice(startIndex, endIndex)
                    
                    return (
                      <>
                        {paginatedActivities.map((activity: any, index: number) => (
                          <div 
                            key={startIndex + index} 
                            className={`activity-item ${dataReady ? 'fade-in-slide' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              padding: 'var(--space-3) 0',
                              borderBottom: index < paginatedActivities.length - 1 ? '1px solid var(--gray-200)' : 'none',
                              animationDelay: `${index * 0.1}s`
                            }}
                          >
                            <i className={`bi ${activity.icon}`} style={{ 
                              color: activity.color, 
                              fontSize: '1.25rem',
                              width: '20px',
                              textAlign: 'center'
                            }}></i>
                            <div style={{ flex: 1 }}>
                              <div className="activity-text" style={{ 
                                fontWeight: '500', 
                                marginBottom: 'var(--space-1)'
                              }}>
                                {activity.text}
                              </div>
                              <div className="activity-time" style={{ 
                                fontSize: '0.75rem'
                              }}>
                                {activity.time}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>
                
                {/* Pagination Controls */}
                {(() => {
                  const totalPages = Math.ceil(dashboardData.recentActivity.length / itemsPerPage)
                  const hasMultiplePages = totalPages > 1
                  
                  if (!hasMultiplePages) return null
                  
                  return (
                    <div className="activity-pagination">
                      <button
                        className="btn-pagination btn-pagination-prev"
                        onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                        disabled={activityPage === 1}
                        title="Previous page"
                      >
                        <i className="bi bi-chevron-left"></i>
                        <span>Previous</span>
                      </button>
                      
                      <div className="pagination-info">
                        <span className="pagination-text">
                          Page {activityPage} of {totalPages}
                        </span>
                        <span className="pagination-count">
                          ({dashboardData.recentActivity.length} total)
                        </span>
                      </div>
                      
                      <button
                        className="btn-pagination btn-pagination-next"
                        onClick={() => setActivityPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={activityPage === totalPages}
                        title="Next page"
                      >
                        <span>Next</span>
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-clock-history"></i>
                </div>
                <div className="empty-state-title">No recent activity</div>
                <div className="empty-state-description">Your activity will appear here as you make requests</div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions - Teacher Specific */}
        <div className="standard-card">
          <div className="standard-card-header">
            <h3 className="standard-card-title">
              <i className="bi bi-lightning"></i>
              Quick Actions
            </h3>
          </div>
          <div className="standard-card-body">
            <div className="quick-actions-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)'
            }}>
              <button 
                className="btn-standard btn-primary"
                onClick={() => navigate('/send-request/item')}
              >
                <i className="bi bi-file-earmark-text"></i> Request Item
              </button>
              <button 
                className="btn-standard btn-outline-primary"
                onClick={() => navigate('/send-request/custom')}
              >
                <i className="bi bi-plus-circle"></i> Custom Request
              </button>
              <button 
                className="btn-standard btn-outline-primary"
                onClick={() => navigate('/assigned-items')}
              >
                <i className="bi bi-box-seam"></i> Inventory
              </button>
              <button 
                className="btn-standard btn-outline-primary"
                onClick={() => navigate('/settings')}
              >
                <i className="bi bi-gear"></i> Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Summary Card */}
      <div className="standard-card">
        <div className="standard-card-header">
          <h3 className="standard-card-title">
            <i className="bi bi-info-circle"></i>
            Summary
          </h3>
        </div>
        <div className="standard-card-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--space-4)'
          }}>
            <div style={{
              padding: 'var(--space-4)',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--gray-200)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                Total Requests Made
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-dark)' }}>
                {dashboardData.myRequests.length}
              </div>
            </div>
            <div style={{
              padding: 'var(--space-4)',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--gray-200)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                Items Currently Assigned
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-dark)' }}>
                {dashboardData.assignedItemsCount}
              </div>
            </div>
            <div style={{
              padding: 'var(--space-4)',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--gray-200)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: 'var(--space-2)' }}>
                Requests Awaiting Response
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-dark)' }}>
                {dashboardData.pendingRequestsCount}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

