import React, { useState, useEffect, useRef } from 'react'
import { getApiBaseUrl } from '../utils/api'

interface Notification {
  id: string
  type: 'overdue' | 'assigned' | 'approved' | 'rejected'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

interface NotificationDropdownProps {
  currentUser: { name: string; role: string }
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ currentUser }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load read state from localStorage
  const getReadNotifications = (): Set<string> => {
    try {
      const read = localStorage.getItem('teacher_notifications_read')
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
      localStorage.setItem('teacher_notifications_read', JSON.stringify(Array.from(readIds)))
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
        
        // Only add request-related notifications if requests preference is enabled
        if (preferences.requests) {
        // Get approved requests for this teacher
        const requestsResponse = await fetch(`${getApiBaseUrl()}/api/requests`)
        if (requestsResponse.ok) {
          const allRequests = await requestsResponse.json()
          const teacherRequests = allRequests
            .filter((req: any) => req.teacher_name === currentUser.name && req.status === 'approved')
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5) // Get last 5 approved requests

          const approvedNotifications = teacherRequests.map((req: any) => {
            const id = `approved-${req.id}`
            return {
              id,
            type: 'approved' as const,
            title: 'Request Approved',
            message: `Your request for ${req.item_name} has been approved`,
            timestamp: new Date(req.created_at),
              read: readNotifications.has(id)
            }
          })

          allNotifications = [...allNotifications, ...approvedNotifications]
        }
        
        // Get custom requests for this teacher (approved or rejected)
        try {
          const customRequestsResponse = await fetch(`${getApiBaseUrl()}/api/custom-requests`)
          if (customRequestsResponse.ok) {
            const allCustomRequests = await customRequestsResponse.json()
            const teacherCustomRequests = allCustomRequests
              .filter((req: any) => req.teacher_name === currentUser.name && (req.status === 'purchasing' || req.status === 'approved' || req.status === 'rejected'))
              .sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
              .slice(0, 5) // Get last 5 custom requests

            const customRequestNotifications = teacherCustomRequests.map((req: any) => {
              const id = `custom-${req.status}-${req.id}`
              const status = req.status
              let type: 'approved' | 'rejected' | 'info' = 'info'
              let title = 'Custom Request Update'
              let message = ''
              
              if (status === 'approved') {
                type = 'approved'
                title = 'Custom Request Approved'
                message = `Your custom request for ${req.item_name} has been approved and added to inventory.`
              } else if (status === 'rejected') {
                type = 'rejected'
                title = 'Custom Request Disapproved'
                message = `Your custom request for ${req.item_name} has been disapproved.`
              } else if (status === 'purchasing') {
                type = 'info'
                title = 'Custom Request Being Processed'
                message = `Your custom request for ${req.item_name} is being processed/purchased.`
              }
              
              return {
                id,
                type,
                title,
                message,
                timestamp: new Date(req.updated_at || req.created_at),
                read: readNotifications.has(id)
              }
            })

            allNotifications = [...allNotifications, ...customRequestNotifications]
          }
        } catch (error) {
          console.error('Error loading custom request notifications:', error)
        }
        
        // Get assigned items to check for overdue and almost overdue
        try {
          const assignedResponse = await fetch(`${getApiBaseUrl()}/api/requests/teacher-assigned?teacher_name=${encodeURIComponent(currentUser.name)}`)
          if (assignedResponse.ok) {
            // Get full request details for assigned items
            const requestsResponse = await fetch(`${getApiBaseUrl()}/api/requests`)
            if (requestsResponse.ok) {
              const allRequests = await requestsResponse.json()
              const teacherAssignedRequests = allRequests.filter((req: any) => 
                req.teacher_name === currentUser.name && req.status === 'assigned' && req.due_date
              )

              const now = new Date()
              const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))

              teacherAssignedRequests.forEach((req: any) => {
                const dueDate = new Date(req.due_date)
                
                if (dueDate < now) {
                  // Overdue
                  const id = `overdue-${req.id}`
                  allNotifications.push({
                    id,
                    type: 'overdue' as const,
                    title: 'Overdue Item Alert',
                    message: `${req.item_name} is past its return deadline`,
                    timestamp: dueDate,
                    read: readNotifications.has(id)
                  })
                } else if (dueDate <= threeDaysFromNow) {
                  // Almost overdue (within 3 days)
                  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
                  const id = `almost-overdue-${req.id}`
                  allNotifications.push({
                    id,
                    type: 'overdue' as const,
                    title: 'Item Due Soon',
                    message: `${req.item_name} is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
                    timestamp: dueDate,
                    read: readNotifications.has(id)
                  })
                }
              })
            }
          }
        } catch (assignedError) {
          // Assigned items API failed, continue without them
          }
        }

        // Sort and limit notifications
        allNotifications = allNotifications
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 10) // Limit to 10 most recent

        setNotifications(allNotifications)
        setUnreadCount(allNotifications.filter(n => !n.read).length)
        
      } catch (error) {
        console.error('Failed to load notifications:', error)
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

  const getNotificationVisual = (type: string, title: string) => {
    const variants: Record<string, { icon: string; color: string; bg: string }> = {
      overdue: { icon: 'bi-exclamation-triangle-fill', color: 'var(--danger-red)', bg: 'rgba(239,68,68,0.15)' },
      approved: { icon: 'bi-check-circle-fill', color: 'var(--success-green)', bg: 'rgba(16,185,129,0.15)' },
      assigned: { icon: 'bi-clipboard-check', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.15)' },
      rejected: { icon: 'bi-x-circle-fill', color: 'var(--danger-red)', bg: 'rgba(239,68,68,0.15)' },
      default: { icon: 'bi-bell-fill', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)' }
    }

    if (title.includes('Due Soon')) {
      return { icon: 'bi-clock-fill', color: 'var(--warning-orange)', bg: 'rgba(245,158,11,0.15)' }
    }

    return variants[type] || variants.default
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
        onClick={() => {
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
            <h6>Notifications</h6>
            {unreadCount > 0 && (
              <button 
                className="notification-mark-read"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-list">
            {/* Notifications List */}
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <i className="bi bi-bell-slash"></i>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const visual = getNotificationVisual(notification.type, notification.title)
                return (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => markAsRead(notification.id)}
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
              <button className="notification-footer-btn" onClick={() => setIsOpen(false)}>
                See previous notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationDropdown
