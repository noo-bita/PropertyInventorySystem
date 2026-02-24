import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import '../css/global.css'

interface Notification {
  id: string
  type: 'pending' | 'overdue' | 'assigned' | 'urgent'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

const Notifications: React.FC = () => {
  const { user: currentUser } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  // Load read state from localStorage
  const getReadNotifications = (): Set<string> => {
    try {
      const read = localStorage.getItem('admin_notifications_read')
      if (read) {
        return new Set(JSON.parse(read))
      }
    } catch (e) {
      console.error('Error loading read notifications:', e)
    }
    return new Set()
  }

  // Save read state to localStorage
  const saveReadNotifications = (readIds: Set<string>) => {
    try {
      localStorage.setItem('admin_notifications_read', JSON.stringify(Array.from(readIds)))
    } catch (e) {
      console.error('Error saving read notifications:', e)
    }
  }

  // Load notification preferences from localStorage
  const getNotificationPreferences = () => {
    try {
      const saved = localStorage.getItem('notification_preferences')
      if (saved) {
        const prefs = JSON.parse(saved)
        return {
          newUser: prefs.newUser !== undefined ? prefs.newUser : true,
          inventory: prefs.inventory !== undefined ? prefs.inventory : true,
          requests: prefs.requests !== undefined ? prefs.requests : true
        }
      }
    } catch (e) {
      console.error('Error loading notification preferences:', e)
    }
    return { newUser: true, inventory: true, requests: true }
  }

  // Load all notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (!currentUser?.name) {
        setLoading(false)
        return
      }

      setLoading(true)
      let allNotifications: Notification[] = []
      
      try {
        const readNotifications = getReadNotifications()
        const preferences = getNotificationPreferences()
        
        // Get all requests
        const requestsResponse = await apiFetch('/api/requests')
        if (requestsResponse.ok) {
          const allRequests = await requestsResponse.json()
          const now = new Date()
          
          if (preferences.requests) {
            // Urgent requests
            const urgentRequests = allRequests.filter((req: any) => 
              req.status === 'pending' && 
              req.priority === 'urgent'
            )
            const urgentNotificationIds = new Set(urgentRequests.map((req: any) => req.id))
            const urgentNotifications = urgentRequests.map((req: any) => {
              const id = `urgent-${req.id}`
              return {
                id,
                type: 'urgent' as const,
                title: 'Urgent Request',
                message: `URGENT: ${req.teacher_name || 'Unknown'} needs ${req.item_name || 'item'}`,
                timestamp: new Date(req.created_at),
                read: readNotifications.has(id)
              }
            })
            allNotifications = [...allNotifications, ...urgentNotifications]

            // Pending requests (exclude urgent ones)
            const pendingRequests = allRequests.filter((req: any) => 
              req.status === 'pending' && 
              !urgentNotificationIds.has(req.id)
            )
            const pendingNotifications = pendingRequests.map((req: any) => {
              const id = `pending-${req.id}`
              return {
                id,
                type: 'pending' as const,
                title: 'Pending Request',
                message: `${req.teacher_name || 'Unknown'} requested ${req.item_name || 'item'}`,
                timestamp: new Date(req.created_at),
                read: readNotifications.has(id)
              }
            })
            allNotifications = [...allNotifications, ...pendingNotifications]

            // Overdue items
            const overdueRequests = allRequests.filter((req: any) => 
              req.status === 'assigned' && 
              req.due_date && 
              new Date(req.due_date) < now
            )
            const overdueNotifications = overdueRequests.map((req: any) => {
              const id = `overdue-${req.id}`
              return {
                id,
                type: 'overdue' as const,
                title: 'Overdue Item',
                message: `${req.teacher_name || 'Unknown'} hasn't returned ${req.item_name || 'item'}`,
                timestamp: new Date(req.due_date),
                read: readNotifications.has(id)
              }
            })
            allNotifications = [...allNotifications, ...overdueNotifications]

            // Pending inspection items
            const pendingInspectionRequests = allRequests.filter((req: any) => 
              req.status === 'returned_pending_inspection' && 
              req.inspection_status === 'pending'
            )
            const pendingInspectionNotifications = pendingInspectionRequests.map((req: any) => {
              const id = `inspection-${req.id}`
              return {
                id,
                type: 'pending' as const,
                title: 'Item Pending Inspection',
                message: `${req.item_name || 'Item'} returned by ${req.teacher_name || 'Unknown'} - awaiting inspection`,
                timestamp: new Date(req.returned_at || req.updated_at),
                read: readNotifications.has(id)
              }
            })
            allNotifications = [...allNotifications, ...pendingInspectionNotifications]

            // All assigned items (not just recent)
            const assignedRequests = allRequests.filter((req: any) => 
              req.status === 'assigned'
            )
            const assignedNotifications = assignedRequests.map((req: any) => {
              const id = `assigned-${req.id}`
              return {
                id,
                type: 'assigned' as const,
                title: 'Item Assigned',
                message: `Assigned ${req.item_name || 'item'} to ${req.teacher_name || 'Unknown'}`,
                timestamp: new Date(req.assigned_at || req.created_at),
                read: readNotifications.has(id)
              }
            })
            allNotifications = [...allNotifications, ...assignedNotifications]
          }
        }

        // Sort by timestamp (newest first)
        allNotifications = allNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

        setNotifications(allNotifications)
      } catch (error) {
        console.error('Failed to load notifications:', error)
        setNotifications([])
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [currentUser?.name])

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
      
      const readNotifications = getReadNotifications()
      readNotifications.add(notificationId)
      saveReadNotifications(readNotifications)
      
      return updated
    })
  }

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(notif => ({ ...notif, read: true }))
      
      const readNotifications = new Set(prev.map(n => n.id))
      saveReadNotifications(readNotifications)
      
      return updated
    })
  }

  const getNotificationVisual = (type: string) => {
    const iconMap: Record<string, { icon: string; color: string; bg: string }> = {
      pending: { icon: 'bi-clock-fill', color: 'var(--warning-orange)', bg: 'rgba(245,158,11,0.15)' },
      overdue: { icon: 'bi-exclamation-triangle-fill', color: 'var(--danger-red)', bg: 'rgba(239,68,68,0.15)' },
      assigned: { icon: 'bi-person-check-fill', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.15)' },
      urgent: { icon: 'bi-lightning-fill', color: 'var(--danger-red)', bg: 'rgba(239,68,68,0.15)' },
      default: { icon: 'bi-bell-fill', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)' }
    }

    return iconMap[type] || iconMap.default
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${weeks}w ago`
    if (months < 12) return `${months}mo ago`
    return timestamp.toLocaleDateString()
  }

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.read
    if (filter === 'read') return notif.read
    return true
  })

  const unreadCount = notifications.filter(n => !n.read).length

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
        <AdminTopBar 
          currentUser={currentUser}
          onSearch={() => {}}
          searchValue=""
          searchPlaceholder=""
        />
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            <div className="standard-card">
              <div className="standard-card-header">
                <h3 className="standard-card-title">
                  <i className="bi bi-bell-fill me-2"></i>
                  All Notifications
                </h3>
                <div className="d-flex align-items-center gap-3">
                  <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                    {unreadCount > 0 && (
                      <span className="badge bg-danger me-2">{unreadCount} unread</span>
                    )}
                    {filteredNotifications.length} {filter === 'all' ? 'total' : filter} notifications
                  </div>
                  {unreadCount > 0 && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={markAllAsRead}
                      style={{
                        borderRadius: '6px',
                        padding: '6px 16px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <i className="bi bi-check-all me-1"></i>
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="d-flex gap-2 p-3 border-bottom" style={{ borderColor: 'var(--gray-200)' }}>
                <button
                  className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('all')}
                  style={{ borderRadius: '6px' }}
                >
                  All ({notifications.length})
                </button>
                <button
                  className={`btn btn-sm ${filter === 'unread' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('unread')}
                  style={{ borderRadius: '6px' }}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  className={`btn btn-sm ${filter === 'read' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setFilter('read')}
                  style={{ borderRadius: '6px' }}
                >
                  Read ({notifications.length - unreadCount})
                </button>
              </div>

              {/* Notifications List */}
              <div className="table-responsive">
                {loading ? (
                  <div className="text-center py-5">
                    <div className="loading-spinner"></div>
                    <p className="mt-2 text-muted">Loading notifications...</p>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-bell-slash" style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                    <h5 className="mt-3 text-muted">
                      {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
                    </h5>
                    <p className="text-muted">
                      {filter === 'all' 
                        ? 'You don\'t have any notifications yet.'
                        : `You don't have any ${filter} notifications.`
                      }
                    </p>
                  </div>
                ) : (
                  <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {filteredNotifications.map((notification) => {
                      const visual = getNotificationVisual(notification.type)
                      return (
                        <div
                          key={notification.id}
                          className={`notification-item ${!notification.read ? 'unread' : ''}`}
                          onClick={() => markAsRead(notification.id)}
                          style={{
                            cursor: 'pointer',
                            padding: '1rem',
                            borderBottom: '1px solid var(--gray-200)',
                            transition: 'background-color 0.2s ease',
                            backgroundColor: notification.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--gray-50)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = notification.read ? 'transparent' : 'rgba(59, 130, 246, 0.05)'
                          }}
                        >
                          <div className="d-flex align-items-start gap-3">
                            <div
                              className="notification-avatar"
                              style={{ 
                                backgroundColor: visual.bg, 
                                color: visual.color,
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <i className={`bi ${visual.icon}`} style={{ fontSize: '1.25rem' }}></i>
                            </div>
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-start justify-content-between">
                                <div>
                                  <p className="notification-title mb-1" style={{ 
                                    fontWeight: notification.read ? '500' : '600',
                                    color: 'var(--text-dark)',
                                    margin: 0
                                  }}>
                                    {notification.title}
                                  </p>
                                  <p className="notification-message mb-1" style={{ 
                                    color: 'var(--gray-600)',
                                    margin: 0,
                                    fontSize: '0.875rem'
                                  }}>
                                    {notification.message}
                                  </p>
                                  <span className="notification-time" style={{ 
                                    color: 'var(--gray-500)',
                                    fontSize: '0.75rem'
                                  }}>
                                    {formatTimestamp(notification.timestamp)}
                                  </span>
                                </div>
                                {!notification.read && (
                                  <div 
                                    className="notification-dot"
                                    style={{
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--accent-blue)',
                                      flexShrink: 0,
                                      marginTop: '4px'
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Notifications
