import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import TeacherTopBar from '../components/TeacherTopBar'
import AdminTopBar from '../components/AdminTopBar'
import AdminDashboard from './AdminDashboard'
import TeacherDashboard from './TeacherDashboard'

/**
 * Main Dashboard Router Component
 * Conditionally renders AdminDashboard or TeacherDashboard based on user role
 */
export default function Dashboard() {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  
  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    // Small delay to show loading state
    const timer = setTimeout(() => {
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [location.pathname])

  // Determine which dashboard to show based on role
  const isAdmin = currentUser?.role === 'ADMIN'

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
                Loading dashboard...
              </p>
            </div>
          </div>
        )}
        
        {/* Topbar without search bar - sticky for better UX */}
        {isAdmin ? (
          <AdminTopBar 
            searchPlaceholder="Search dashboard..." 
            currentUser={currentUser}
            hideSearch={true}
          />
        ) : (
          <TeacherTopBar 
            searchPlaceholder="Search dashboard..." 
            currentUser={currentUser}
            hideSearch={true}
          />
        )}
        
        {/* Conditionally render Admin or Teacher Dashboard */}
        {isAdmin ? <AdminDashboard /> : <TeacherDashboard />}
      </main>
    </div>
  )
}
