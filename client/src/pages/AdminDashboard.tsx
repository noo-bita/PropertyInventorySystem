import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import DashboardChart from '../components/DashboardChart'
import BudgetWidget from '../components/BudgetWidget'
import { useCountUp } from '../hooks/useCountUp'
import { useDataReady } from '../hooks/useDataReady'
import '../css/global.css'
import '../css/dashboard.css'

// KPI Card Component with Count-up Animation
interface KPICardProps {
  label: string
  value: number
  icon: string
  iconClass: string
  loading: boolean
  dataReady: boolean
}

function KPICard({ label, value, icon, iconClass, loading, dataReady }: KPICardProps) {
  const targetValue = dataReady ? value : 0
  const { count } = useCountUp(targetValue, {
    duration: 1200,
    startOnMount: dataReady
  })

  return (
    <div className={`kpi-card kpi-card-modern ${dataReady ? 'fade-in' : ''}`}>
      <div className="kpi-info">
        <h3 className="kpi-label">{label}</h3>
        <div className="kpi-value">
          {loading ? (
            <div className="loading-spinner"></div>
          ) : dataReady ? (
            <span className="kpi-number">{count.toLocaleString()}</span>
          ) : null}
        </div>
      </div>
      <div className={`kpi-icon-wrapper ${iconClass}`}>
        <i className={`bi ${icon} kpi-icon`}></i>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  
  const [dashboardData, setDashboardData] = useState({
    totalItems: 0,
    pendingRequests: 0,
    pendingInspection: 0,
    totalUsers: 0,
    availableItems: 0,
    recentActivity: [],
    requestsData: [] as any[],
    reportsData: [] as any[],
    inventoryData: [] as any[]
  })
  const [loading, setLoading] = useState(true)
  const dataReady = useDataReady(loading)
  
  // Pagination state for Recent Activity
  const [activityPage, setActivityPage] = useState(1)
  const itemsPerPage = 4

  // Fetch dashboard data - using optimized dashboard endpoint
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) {
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        
        let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {
          console.warn('Dashboard data fetch timeout')
          setLoading(false)
        }, 10000)
        
        // Use optimized dashboard endpoint - request full data for charts
        const dashboardRes = await apiFetch('/api/dashboard/admin?include_full_data=true')
        
        clearTimeout(timeoutId)

        if (dashboardRes.ok) {
          const data = await dashboardRes.json()
          
          console.log('Dashboard data received:', data)
          
          // Ensure all required fields are present
          const dashboardDataUpdate = {
            totalItems: data.totalItems ?? 0,
            pendingRequests: data.pendingRequests ?? 0,
            pendingInspection: data.pendingInspection ?? 0,
            totalUsers: data.totalUsers ?? 0,
            availableItems: data.availableItems ?? 0,
            recentActivity: Array.isArray(data.recentActivity) ? data.recentActivity : [],
            requestsData: Array.isArray(data.requestsData) ? data.requestsData : [],
            reportsData: Array.isArray(data.reportsData) ? data.reportsData : [],
            inventoryData: Array.isArray(data.inventoryData) ? data.inventoryData : []
          }
          
          console.log('Setting dashboard data:', dashboardDataUpdate)
          setDashboardData(dashboardDataUpdate)
          
          setTimeout(() => {
            setDataReady(true)
          }, 100)
        } else {
          let errorData = {}
          try {
            errorData = await dashboardRes.json()
          } catch (e) {
            console.error('Failed to parse error response:', e)
          }
          console.error('Failed to fetch dashboard data:', {
            status: dashboardRes.status,
            statusText: dashboardRes.statusText,
            error: errorData
          })
          
          // Fallback: Try fetching data the old way if new endpoint fails
          console.log('Attempting fallback to individual endpoints...')
          try {
            const [inventoryRes, requestsRes, usersRes, reportsRes] = await Promise.all([
              apiFetch('/api/inventory'),
              apiFetch('/api/requests'),
              apiFetch('/api/users'),
              apiFetch('/api/reports')
            ])
            
            const inventory = inventoryRes.ok ? await inventoryRes.json() : []
            const requests = requestsRes.ok ? await requestsRes.json() : []
            const users = usersRes.ok ? await usersRes.json() : []
            const reports = reportsRes.ok ? await reportsRes.json() : []

            const totalItems = inventory.length
            const availableItems = inventory.reduce((sum: number, item: any) => sum + (item.available || 0), 0)
            const pendingRequests = requests.filter((req: any) => 
              req.status === 'pending' || req.status === 'under_review'
            ).length
            const pendingInspection = requests.filter((req: any) => 
              req.status === 'returned_pending_inspection' && req.inspection_status === 'pending'
            ).length
            const totalUsers = users.length

            const recentActivity = [
              ...requests.slice(0, 5).map((req: any) => ({
                type: 'request',
                icon: 'bi-file-earmark-text',
                color: '#3182ce',
                text: `New ${req.request_type || 'item'} request from ${req.teacher_name}`,
                time: new Date(req.created_at).toLocaleString()
              })),
              ...reports.slice(0, 3).map((report: any) => ({
                type: 'report',
                icon: 'bi-exclamation-triangle',
                color: '#e53e3e',
                text: `New report: ${report.notes?.includes('MISSING') ? 'Missing' : report.notes?.includes('DAMAGED') ? 'Damaged' : 'Other'} item`,
                time: new Date(report.created_at).toLocaleString()
              }))
            ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10)

            setDashboardData({
              totalItems,
              pendingRequests,
              pendingInspection,
              totalUsers,
              availableItems,
              recentActivity,
              requestsData: requests,
              reportsData: reports,
              inventoryData: inventory
            })
            
            setTimeout(() => {
              setDataReady(true)
            }, 100)
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError)
            setDataReady(false)
          }
          
          setLoading(false)
          
          // Show user-friendly error message
          if (dashboardRes.status === 401 || dashboardRes.status === 403) {
            console.error('Authentication failed - please log in again')
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setLoading(false)
        setDataReady(false)
      } finally {
        setLoading(false)
      }
    }

    if (currentUser) {
      fetchDashboardData()
    }
  }, [currentUser])

  useEffect(() => {
    setActivityPage(1)
  }, [dashboardData.recentActivity.length])

  return (
    <div className="dashboard-content">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <p className="dashboard-subtitle">
          Welcome back, {currentUser?.name}! Here's what's happening with your inventory system.
        </p>
      </div>

      {/* Budget Widget - Prominent placement */}
      <div style={{ marginBottom: '1.5rem' }}>
        <BudgetWidget />
      </div>

      {/* KPI Cards - Enhanced Modern Design with Animations */}
      <div className="kpi-grid">
        <KPICard
          key={`total-items-${dataReady}`}
          label="Total Items"
          value={dashboardData.totalItems}
          icon="bi-box"
          iconClass="kpi-icon-primary"
          loading={loading}
          dataReady={dataReady}
        />
        
        <KPICard
          key={`pending-requests-${dataReady}`}
          label="Pending Requests"
          value={dashboardData.pendingRequests}
          icon="bi-file-earmark-text"
          iconClass="kpi-icon-warning"
          loading={loading}
          dataReady={dataReady}
        />
        
        <KPICard
          key={`pending-inspection-${dataReady}`}
          label="Pending Inspection"
          value={dashboardData.pendingInspection}
          icon="bi-clipboard-check"
          iconClass="kpi-icon-warning"
          loading={loading}
          dataReady={dataReady}
        />
        
        <KPICard
          key={`users-${dataReady}`}
          label="Users"
          value={dashboardData.totalUsers}
          icon="bi-people"
          iconClass="kpi-icon-info"
          loading={loading}
          dataReady={dataReady}
        />
        
        <KPICard
          key={`available-items-${dataReady}`}
          label="Available Items"
          value={dashboardData.availableItems}
          icon="bi-check-circle"
          iconClass="kpi-icon-success"
          loading={loading}
          dataReady={dataReady}
        />
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Recent Activity */}
        <div className="standard-card">
          <div className="standard-card-header">
            <h3 className="standard-card-title">
              <i className="bi bi-clock-history"></i>
              Recent Activity
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
                    const totalPages = Math.ceil(dashboardData.recentActivity.length / itemsPerPage)
                    
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
                              borderBottomColor: index < paginatedActivities.length - 1 ? undefined : 'transparent',
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
                <div className="empty-state-description">Activity will appear here as users interact with the system</div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
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
                onClick={() => navigate('/inventory')}
              >
                <i className="bi bi-plus"></i> Add Item
              </button>
              <button 
                className="btn-standard btn-outline-primary"
                onClick={() => navigate('/manage-requests/item')}
              >
                <i className="bi bi-file-earmark-text"></i> Manage Requests
              </button>
              <button 
                className="btn-standard btn-outline-primary"
                onClick={() => navigate('/reports')}
              >
                <i className="bi bi-file-earmark-bar-graph"></i> Generate Report
              </button>
              <button 
                className="btn-standard btn-outline-primary"
                onClick={() => navigate('/users')}
              >
                <i className="bi bi-people"></i> Manage Users
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Dashboard Charts */}
      <div className="standard-card">
        <div className="standard-card-header">
          <h3 className="standard-card-title">
            <i className="bi bi-graph-up"></i>
            System Analytics
          </h3>
        </div>
        <div className="standard-card-body">
          <DashboardChart
            dashboardData={dashboardData}
            requestsData={dashboardData.requestsData}
            reportsData={dashboardData.reportsData}
            inventoryData={dashboardData.inventoryData}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}

