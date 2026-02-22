import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'

interface Notification {
  id: string
  type: 'pending' | 'overdue' | 'assigned' | 'urgent'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

interface AdminNotificationDropdownProps {
  currentUser: { name: string; role: string }
}

const AdminNotificationDropdown: React.FC<AdminNotificationDropdownProps> = ({ currentUser }) => {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    // Default to all enabled
    return { newUser: true, inventory: true, requests: true }
  }

  // Load notifications
  useEffect(() => {
    const loadNotifications = async () => {
      let allNotifications: Notification[] = []
      
      try {
        // Load read state and preferences from localStorage
        const readNotifications = getReadNotifications()
        const preferences = getNotificationPreferences()
        
        // Get pending requests
        const requestsResponse = await apiFetch('/api/requests')
        if (requestsResponse.ok) {
          const allRequests = await requestsResponse.json()
          const now = new Date()
          
          // Only add request-related notifications if requests preference is enabled
          if (preferences.requests) {
            // Urgent requests (high priority) - must come before pending to avoid duplicates
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

            // Pending requests (exclude urgent ones to avoid duplicates)
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

          // Overdue items (assigned but not returned)
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

          // Recently assigned items
          const assignedRequests = allRequests.filter((req: any) => 
            req.status === 'assigned' && 
            req.assigned_at &&
            new Date(req.assigned_at) > new Date(now.getTime() - (24 * 60 * 60 * 1000)) // Last 24 hours
          )
          const assignedNotifications = assignedRequests.map((req: any) => {
            const id = `assigned-${req.id}`
            return {
              id,
            type: 'assigned' as const,
            title: 'Item Assigned',
              message: `Assigned ${req.item_name || 'item'} to ${req.teacher_name || 'Unknown'}`,
            timestamp: new Date(req.assigned_at),
              read: readNotifications.has(id)
            }
          })
          allNotifications = [...allNotifications, ...assignedNotifications]
          }
        }

        // Sort and limit notifications
        allNotifications = allNotifications
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 15) // Limit to 15 most recent

        setNotifications(allNotifications)
        setUnreadCount(allNotifications.filter(n => !n.read).length)
        
      } catch (error) {
        console.error('Failed to load admin notifications:', error)
        setNotifications([])
        setUnreadCount(0)
      }
    }

    if (currentUser?.name) {
      loadNotifications()
    }
    
    // Reload notifications when preferences change (check every 2 seconds)
    const interval = setInterval(() => {
      if (currentUser?.name) {
        loadNotifications()
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [currentUser?.name])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
      
      // Save to localStorage
      const readNotifications = getReadNotifications()
      readNotifications.add(notificationId)
      saveReadNotifications(readNotifications)
      
      return updated
    })
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(notif => ({ ...notif, read: true }))
      
      // Save all notification IDs to localStorage
      const readNotifications = new Set(prev.map(n => n.id))
      saveReadNotifications(readNotifications)
      
      return updated
    })
    setUnreadCount(0)
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

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div 
      className="notification-dropdown" 
      ref={dropdownRef}
    >
      {/* Bell Icon */}
      <button
        className="notification-trigger"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
      >
        <i className="bi bi-bell-fill" style={{ fontSize: '1.25rem' }}></i>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="notification-panel">
          {/* Header */}
          <div className="notification-header">
            <h6>Admin Notifications</h6>
            {unreadCount > 0 && (
              <button 
                className="notification-mark-read"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <i className="bi bi-bell-slash"></i>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const visual = getNotificationVisual(notification.type)
                return (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => {
                      markAsRead(notification.id)
                      if (notification.id.startsWith('inspection-')) {
                        navigate('/return-review')
                        setIsOpen(false)
                      }
                    }}
                    style={{ cursor: notification.id.startsWith('inspection-') ? 'pointer' : 'default' }}
                  >
                    <div
                      className="notification-avatar"
                      style={{ backgroundColor: visual.bg, color: visual.color }}
                    >
                      <i className={`bi ${visual.icon}`}></i>
                    </div>
                    <div className="notification-content flex-grow-1">
                      <p className="notification-title">{notification.title}</p>
                      <p className="notification-message">{notification.message}</p>
                      <span className="notification-time">{formatTimestamp(notification.timestamp)}</span>
                    </div>
                    {!notification.read && <div className="notification-dot" />}
                  </div>
                )
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button 
                className="notification-footer-btn" 
                onClick={() => {
                  setIsOpen(false)
                  navigate('/notifications')
                }}
              >
                See previous notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminNotificationDropdown
