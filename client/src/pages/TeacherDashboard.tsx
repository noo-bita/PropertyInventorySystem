import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import { AnimatedKPI } from '../components/AnimatedKPI'
import BudgetWidget from '../components/BudgetWidget'
import { useDataReady } from '../hooks/useDataReady'

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

  // Fetch teacher-specific dashboard data
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
        
        // Fetch only teacher-relevant data
        const [requestsRes, assignedRes] = await Promise.all([
          apiFetch('/api/requests'),
          apiFetch(`/api/requests/teacher-assigned?teacher_name=${encodeURIComponent(currentUser.name)}`)
        ])
        
        clearTimeout(timeoutId)

        const allRequests = requestsRes.ok ? await requestsRes.json() : []
        const assignedItems = assignedRes.ok ? await assignedRes.json() : []

        // Filter data for this specific teacher
        const teacherName = currentUser.name
        const myRequests = allRequests.filter((req: any) => req.teacher_name === teacherName)
        const myAssignedItems = allRequests.filter((req: any) => 
          req.teacher_name === teacherName && 
          (req.status === 'assigned' || req.status === 'returned')
        )

        // Calculate teacher-specific metrics
        const assignedItemsCount = myAssignedItems.filter((item: any) => item.status === 'assigned').length
        const pendingRequestsCount = myRequests.filter((req: any) => 
          req.status === 'pending' || req.status === 'under_review'
        ).length
        const approvedRequestsCount = myRequests.filter((req: any) => 
          req.status === 'approved' || req.status === 'assigned'
        ).length

        // Calculate items due soon (within 3 days)
        const now = new Date()
        const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))
        const itemsDueSoon = myAssignedItems.filter((item: any) => {
          if (!item.due_date || item.status !== 'assigned') return false
          const dueDate = new Date(item.due_date)
          return dueDate <= threeDaysFromNow && dueDate >= now
        }).length

        // Get recent activity (only teacher's own activity)
        const recentActivity = myRequests
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
          .map((req: any) => {
            let icon = 'bi-file-earmark-text'
            let color = '#3182ce'
            let text = ''
            
            if (req.status === 'approved' || req.status === 'assigned') {
              icon = 'bi-check-circle'
              color = '#10b981'
              text = `Your request for ${req.item_name} was ${req.status === 'assigned' ? 'assigned' : 'approved'}`
            } else if (req.status === 'pending' || req.status === 'under_review') {
              icon = 'bi-clock'
              color = '#f59e0b'
              text = `Your request for ${req.item_name} is ${req.status === 'under_review' ? 'under review' : 'pending'}`
            } else if (req.status === 'rejected') {
              icon = 'bi-x-circle'
              color = '#ef4444'
              text = `Your request for ${req.item_name} was rejected`
            } else {
              text = `Request for ${req.item_name} - ${req.status}`
            }
            
            return {
              type: 'request',
              icon,
              color,
              text,
              time: new Date(req.created_at).toLocaleString()
            }
          })

        setDashboardData({
          assignedItemsCount,
          pendingRequestsCount,
          approvedRequestsCount,
          itemsDueSoon,
          recentActivity,
          myRequests,
          myAssignedItems
        })
        
        setTimeout(() => {
          setDataReady(true)
        }, 100)
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

