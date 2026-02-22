import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import UserManagement from './pages/UserManagement'
import Reports from './pages/Reports'
import Inventory from './pages/Inventory'
import SendRequest from './pages/SendRequest'
import ItemRequestPage from './pages/ItemRequestPage'
import CustomRequestPage from './pages/CustomRequestPage'
import ReportPage from './pages/ReportPage'
import AssignedItems from './pages/AssignedItems'
import QRGenerator from './pages/QRGenerator'
import Settings from './pages/Settings'
import Login from './pages/Login'
import ItemRequestManagement from './pages/ItemRequestManagement'
import CustomRequestManagement from './pages/CustomRequestManagement'
import ActivityLog from './pages/ActivityLog'
import Suppliers from './pages/Suppliers'
import ReturnReview from './pages/ReturnReview'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'

// Initialize theme from localStorage on app start
const initializeTheme = () => {
  // Safety check for browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  
  try {
    const savedAppearance = localStorage.getItem('appearance_preferences')
    if (savedAppearance) {
      const appearanceData = JSON.parse(savedAppearance)
      if (appearanceData.theme === 'dark') {
        document.body.classList.add('dark-theme')
        document.documentElement.classList.add('dark-theme')
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.body.classList.remove('dark-theme')
        document.documentElement.classList.remove('dark-theme')
        document.documentElement.setAttribute('data-theme', 'light')
      }
    }
  } catch (e) {
    console.error('Error initializing theme:', e)
  }
}

// Run theme initialization immediately (before React renders)
initializeTheme()

function Protected({ children, roles }: { children: JSX.Element, roles?: Array<'ADMIN' | 'TEACHER'> }) {
  const { user } = useAuth()
  const token = typeof window !== 'undefined' ? localStorage.getItem('api_token') : null
  if (!user || !token) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/inventory" element={<Protected roles={['ADMIN']}><Inventory /></Protected>} />
          <Route path="/assigned-items" element={<Protected roles={['ADMIN','TEACHER']}><AssignedItems /></Protected>} />
          <Route path="/send-request" element={<Protected roles={['ADMIN']}><SendRequest /></Protected>} />
          <Route path="/send-request/item" element={<Protected roles={['TEACHER']}><ItemRequestPage /></Protected>} />
          <Route path="/send-request/custom" element={<Protected roles={['TEACHER']}><CustomRequestPage /></Protected>} />
          <Route path="/send-request/report" element={<Protected roles={['TEACHER']}><ReportPage /></Protected>} />
          <Route path="/manage-requests/item" element={<Protected roles={['ADMIN']}><ItemRequestManagement /></Protected>} />
          <Route path="/manage-requests/custom" element={<Protected roles={['ADMIN']}><CustomRequestManagement /></Protected>} />
          <Route path="/return-review" element={<Protected roles={['ADMIN']}><ReturnReview /></Protected>} />
          <Route path="/qr-generator" element={<Protected roles={['ADMIN']}><QRGenerator /></Protected>} />
          <Route path="/suppliers" element={<Protected roles={['ADMIN']}><Suppliers /></Protected>} />
          <Route path="/users" element={<Protected roles={['ADMIN']}><UserManagement /></Protected>} />
          <Route path="/reports" element={<Protected roles={['ADMIN']}><Reports /></Protected>} />
          <Route path="/activity-log" element={<Protected roles={['ADMIN']}><ActivityLog /></Protected>} />
          <Route path="/settings" element={<Protected roles={['ADMIN','TEACHER']}><Settings /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
