import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import TeacherTopBar from '../components/TeacherTopBar'
import AdminTopBar from '../components/AdminTopBar'
import { AnimatedKPI } from '../components/AnimatedKPI'
import { useDataReady } from '../hooks/useDataReady'
import { showNotification } from '../utils/notifications'
import ReturnItemModal from '../components/ReturnItemModal'
import ConfirmationModal from '../components/ConfirmationModal'

// Constants
const NEAR_OVERDUE_DAYS = 3 // Items due within 3 days are considered "near overdue"

// Utility function to calculate item status based on due date
const getItemStatus = (item: any): { status: 'active' | 'near-due' | 'overdue', daysUntilDue: number | null } => {
  if (!item.due_date || item.status !== 'assigned') {
    return { status: 'active', daysUntilDue: null }
  }

  const dueDate = new Date(item.due_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)

  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) {
    return { status: 'overdue', daysUntilDue }
  } else if (daysUntilDue <= NEAR_OVERDUE_DAYS) {
    return { status: 'near-due', daysUntilDue }
  } else {
    return { status: 'active', daysUntilDue }
  }
}

// Format due date for tooltip
const formatDueDateTooltip = (dueDate: string | null): string => {
  if (!dueDate) return 'No due date set'
  const date = new Date(dueDate)
  return `Due: ${date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`
}

const AssignedItems = () => {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [assignedItems, setAssignedItems] = useState<any[]>([])
  const [rejectedReturns, setRejectedReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const dataReady = useDataReady(loading)
  
  // Ref to prevent concurrent API calls
  const isLoadingRef = useRef(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [rejectedPage, setRejectedPage] = useState(1)

  const loadAssignedItems = useCallback(async () => {
    if (!currentUser) {
      setLoading(false)
      isLoadingRef.current = false
      return
    }
    
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('Already loading, skipping duplicate call')
      return
    }
    
    isLoadingRef.current = true
    try {
      setLoading(true)
      
      // Add timeout to prevent stuck loading (max 10 seconds)
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {
        console.warn('Assigned items fetch timeout')
        setLoading(false)
      }, 10000)
      
      console.log('Loading assigned items...')
      
      // Fetch both assigned items and inventory items in parallel
      const [requestsResponse, inventoryResponse] = await Promise.all([
        apiFetch('/api/requests'),
        apiFetch('/api/inventory')
      ])
      
      clearTimeout(timeoutId)
      
      if (requestsResponse.ok && inventoryResponse.ok) {
        const requestsData = await requestsResponse.json()
        const inventoryData = await inventoryResponse.json()
        
        // Create a Set of inventory item IDs for quick lookup
        const inventoryItemIds = new Set(
          inventoryData.map((item: any) => item.id)
        )
        
        // Filter for assigned items only (exclude returned and returned_pending_inspection)
        let assigned = requestsData.filter((r: any) => 
          r.status === 'assigned'
        )
        
        // Filter out assigned items whose inventory item no longer exists
        // Keep items with null item_id (custom requests) as they don't reference inventory
        assigned = assigned.filter((r: any) => {
          // If item_id is null, it's a custom request - keep it
          if (r.item_id === null || r.item_id === undefined) {
            return true
          }
          // If item_id exists, check if it's in the inventory
          return inventoryItemIds.has(r.item_id)
        })
        
        // Also get rejected returns for teacher view
        const rejectedReturns = requestsData.filter((r: any) => {
          const itemTeacherName = String(r.teacher_name || '').trim().toLowerCase()
          const currentUserName = String(currentUser?.name || '').trim().toLowerCase()
          return itemTeacherName === currentUserName && 
                 r.status === 'returned' && 
                 r.inspection_status === 'rejected'
        })
        
        // Store rejected returns in state
        setRejectedReturns(rejectedReturns)
        
        // Debug log for teacher view
        if (currentUser?.role !== 'ADMIN') {
          const teacherAssigned = assigned.filter((r: any) => {
            const itemTeacherName = String(r.teacher_name || '').trim().toLowerCase()
            const currentUserName = String(currentUser?.name || '').trim().toLowerCase()
            return itemTeacherName === currentUserName && r.status === 'assigned'
          })
          console.log('Teacher assigned items:', {
            teacherName: currentUser?.name,
            totalAssigned: assigned.length,
            myAssigned: teacherAssigned.length,
            myAssignedItems: teacherAssigned
          })
        }
        
        setAssignedItems(assigned)
      }
    } catch (error) {
      console.error('Error fetching assigned items:', error)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [currentUser])

  // Reset loading when navigating to this page
  useEffect(() => {
    if (currentUser && location.pathname === '/assigned-items') {
      setLoading(true)
      loadAssignedItems()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, currentUser?.id]) // Only depend on currentUser.id to prevent infinite loops

  // Refresh data when page comes into focus (e.g., after approval from another tab/page)
  useEffect(() => {
    const handleFocus = () => {
      if (location.pathname === '/assigned-items' && currentUser) {
        loadAssignedItems()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, currentUser?.id]) // Only depend on currentUser.id to prevent infinite loops

  const [showReturnModal, setShowReturnModal] = useState(false)
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<any>(null)
  const [isReturning, setIsReturning] = useState(false)
  
  // Admin return confirmation modal state
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)
  const [itemToReturn, setItemToReturn] = useState<any>(null)

  const openReturnModal = (item: any) => {
    setSelectedItemForReturn(item)
    setShowReturnModal(true)
  }

  const closeReturnModal = () => {
    if (!isReturning) {
      setShowReturnModal(false)
      setSelectedItemForReturn(null)
    }
  }

  // Admin return function - opens confirmation modal
  const adminReturnItem = (item: any) => {
    if (!item || !item.id) {
      showNotification('Invalid item', 'error')
      return
    }
    setItemToReturn(item)
    setShowReturnConfirm(true)
  }

  // Confirm admin return - actually performs the return
  const confirmAdminReturn = async () => {
    if (!itemToReturn || !itemToReturn.id) {
      setShowReturnConfirm(false)
      setItemToReturn(null)
      return
    }

    try {
      console.log('Admin returning item:', itemToReturn.id)
      
      const response = await apiFetch(`/api/requests/${itemToReturn.id}/teacher-return`, {
        method: 'POST',
        body: JSON.stringify({
          is_damaged: false,
          notes: 'Returned by admin'
        })
      })
      
      console.log('Return response status:', response.status, response.ok)
      
      if (response.ok) {
        const responseData = await response.json().catch(() => null)
        console.log('Return response data:', responseData)
        
        // Refresh the list - item will be removed as it's no longer 'assigned'
        await loadAssignedItems()
        showNotification('Item marked as returned. It will appear in the Return Review table for inspection.', 'success')
        setShowReturnConfirm(false)
        setItemToReturn(null)
      } else {
        // Get error message from response
        let errorMessage = 'Failed to return item'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
          console.error('Return error:', errorData)
        } catch (e) {
          // If response is not JSON, try text
          try {
            const errorText = await response.text()
            if (errorText) {
              errorMessage = errorText
            }
          } catch (textError) {
            console.error('Error reading response:', textError)
          }
        }
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error returning item:', error)
      showNotification(error?.message || 'Error returning item. Please try again.', 'error')
    } finally {
      setIsReturning(false)
    }
  }

  const closeReturnConfirm = () => {
    if (!isReturning) {
      setShowReturnConfirm(false)
      setItemToReturn(null)
    }
  }

  // Teacher return function - uses modal for notes and damage status
  const returnItem = async (data: { isDamaged: boolean; notes: string }) => {
    if (!selectedItemForReturn) return
    
    setIsReturning(true)
    try {
      const response = await apiFetch(`/api/requests/${selectedItemForReturn.id}/teacher-return`, {
        method: 'POST',
        body: JSON.stringify({
          is_damaged: data.isDamaged,
          notes: data.notes || null
        })
      })
      
      if (response.ok) {
        const responseData = await response.json()
        // Refresh the list - item will be removed as it's no longer 'assigned'
        await loadAssignedItems()
        showNotification('Item returned successfully! Awaiting inspection by Admin/Custodian.', 'success')
        closeReturnModal()
      } else {
        // Get error message from response
        let errorMessage = 'Failed to return item'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch (e) {
          // If response is not JSON, try text
          const errorText = await response.text()
          if (errorText) {
            errorMessage = errorText
          }
        }
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error returning item:', error)
      showNotification(error?.message || 'Error returning item. Please try again.', 'error')
    } finally {
      setIsReturning(false)
    }
  }

  // Filter assigned items based on search term
  const filteredItems = assignedItems.filter(item => {
    if (!searchTerm) return true
    const lowerSearchTerm = searchTerm.toLowerCase()
    return (
      item.item_name?.toLowerCase().includes(lowerSearchTerm) ||
      item.teacher_name?.toLowerCase().includes(lowerSearchTerm) ||
      String(item.id).includes(searchTerm) ||
      item.quantity_assigned?.toString().includes(searchTerm) ||
      item.quantity_requested?.toString().includes(searchTerm) ||
      item.status?.toLowerCase().includes(lowerSearchTerm)
    )
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Reset to page 1 when assignedItems changes
  useEffect(() => {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [assignedItems.length, itemsPerPage, currentPage, filteredItems.length])

  // Admin View - All Assigned Items
  const AdminView = () => {
    // Pagination logic
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedItems = filteredItems.slice(startIndex, endIndex)

    const currentlyAssigned = assignedItems.filter(item => item.status === 'assigned').length
    const returned = assignedItems.filter(item => item.status === 'returned').length
    const overdue = assignedItems.filter(item => 
      item.status === 'assigned' && 
      item.due_date && 
      new Date(item.due_date) < new Date()
    ).length

    return (
      <>
        {/* Statistics Cards - Modern Design with Animations */}
        <div className="row mb-4">
          <div className="col-md-4 mb-3">
            <AnimatedKPI
              label="Currently Assigned"
              value={currentlyAssigned}
              icon="bi-box-seam"
              iconClass="kpi-icon-info"
              loading={loading}
              dataReady={dataReady}
            />
          </div>
          <div className="col-md-4 mb-3">
            <AnimatedKPI
              label="Returned"
              value={returned}
              icon="bi-check-circle"
              iconClass="kpi-icon-success"
              loading={loading}
              dataReady={dataReady}
            />
          </div>
          <div className="col-md-4 mb-3">
            <AnimatedKPI
              label="Overdue"
              value={overdue}
              icon="bi-exclamation-triangle"
              iconClass="kpi-icon-warning"
              loading={loading}
              dataReady={dataReady}
            />
          </div>
        </div>

        {/* Table Card - Modern Design */}
        <div className="standard-card">
            <div className="standard-card-header">
            <h3 className="standard-card-title">
            <i className="bi bi-box-seam me-2"></i>
            All Assigned Items
            </h3>
            <div className="text-muted" style={{ fontSize: '0.875rem' }}>
              {searchTerm ? (
                <>Showing {filteredItems.length} of {assignedItems.length} items</>
              ) : (
                <>Total: {assignedItems.length} items</>
              )}
            </div>
          </div>
          
          <div className="table-responsive">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Teacher</th>
                  <th>Quantity</th>
                  <th>Assigned Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item: any, index: number) => {
                    const isOverdue = item.status === 'assigned' && 
                      item.due_date && 
                      new Date(item.due_date) < new Date()
                    
                    return (
                      <tr key={item.id} className={`${index % 2 === 0 ? 'even-row' : 'odd-row'} ${isOverdue ? 'low-stock-row' : ''}`}>
                    <td>{item.id}</td>
                    <td>{item.item_name}</td>
                    <td>{item.teacher_name}</td>
                    <td>{item.quantity_assigned || item.quantity_requested}</td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          {item.due_date ? (
                            <span className={isOverdue ? 'text-danger fw-bold' : ''}>
                              {new Date(item.due_date).toLocaleDateString()}
                            </span>
                          ) : 'N/A'}
                        </td>
                    <td>
                      <span className={`badge ${
                        item.status === 'assigned' ? 'bg-info' :
                        item.status === 'returned' ? 'bg-success' :
                        'bg-light text-dark'
                          }`} style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {item.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                        {item.status === 'assigned' && (
                          <button 
                            className="btn btn-outline-primary btn-sm"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('Return button clicked for item:', item.id)
                              adminReturnItem(item)
                            }}
                            disabled={isReturning}
                            title="Mark as Returned"
                              style={{
                                borderRadius: '6px',
                                padding: '4px 12px',
                                transition: 'all 0.2s ease',
                                opacity: isReturning ? 0.6 : 1,
                                cursor: isReturning ? 'not-allowed' : 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                if (!isReturning) {
                                  e.currentTarget.style.transform = 'scale(1.05)'
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)'
                                e.currentTarget.style.boxShadow = 'none'
                              }}
                          >
                            {isReturning ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1" style={{ width: '0.875rem', height: '0.875rem' }}></span>
                                Returning...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-arrow-return-left me-1"></i>
                                Return
                              </>
                            )}
                          </button>
                        )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-5">
                      <i className="bi bi-search" style={{ fontSize: '3rem', color: '#6c757d' }}></i>
                      <h5 className="mt-3 text-muted">
                        {searchTerm ? 'No items found' : 'No Assigned Items'}
                      </h5>
                      <p className="text-muted">
                        {searchTerm 
                          ? `No items match your search "${searchTerm}". Try a different search term.`
                          : 'No items have been assigned yet.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredItems.length > itemsPerPage && (
            <div className="inventory-pagination" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-4)',
              borderTop: '1px solid var(--gray-200)',
              marginTop: 'var(--space-4)'
            }}>
              <div className="pagination-info" style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)'
              }}>
                Showing {startIndex + 1} to {Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
        </div>

              <div className="pagination-controls" style={{
                display: 'flex',
                gap: 'var(--space-2)',
                alignItems: 'center'
              }}>
                <button
                  className="btn-standard btn-outline-primary"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    opacity: currentPage === 1 ? 0.5 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <i className="bi bi-chevron-left"></i>
                  Previous
                </button>
                
                <div className="pagination-page-info" style={{
                  padding: '0 var(--space-3)',
                  fontSize: '0.875rem',
                  color: 'var(--gray-600)',
                  fontWeight: '500'
                }}>
                  Page {currentPage} of {totalPages}
              </div>
                
                <button
                  className="btn-standard btn-outline-primary"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  // Teacher View - My Assigned Items
  const TeacherView = () => {
    // Debug: Log all assigned items to see what we're working with
    if (currentUser?.role !== 'ADMIN') {
      console.log('All assignedItems:', assignedItems)
      console.log('Current teacher name:', currentUser?.name)
    }
    
    // First filter by teacher and only show assigned items (exclude returned), then apply search filter
    const myAssignedItems = assignedItems.filter((item: any) => {
      const itemTeacherName = String(item.teacher_name || '').trim().toLowerCase()
      const currentUserName = String(currentUser?.name || '').trim().toLowerCase()
      const isMatch = itemTeacherName === currentUserName && item.status === 'assigned'
      
      // Debug logging
      if (currentUser?.role !== 'ADMIN' && item.teacher_name) {
        console.log('Checking item:', {
          itemId: item.id,
          itemName: item.item_name,
          itemTeacherName: item.teacher_name,
          currentUserName: currentUser?.name,
          status: item.status,
          isMatch: isMatch,
          teacherNameMatch: itemTeacherName === currentUserName,
          statusMatch: item.status === 'assigned'
        })
      }
      
      return isMatch
    })
    
    // Debug: Log filtered results
    if (currentUser?.role !== 'ADMIN') {
      console.log('Filtered myAssignedItems:', myAssignedItems)
    }
    
    // Apply search filter to teacher's items
    const filteredMyItems = myAssignedItems.filter(item => {
      if (!searchTerm) return true
      const lowerSearchTerm = searchTerm.toLowerCase()
      return (
        item.item_name?.toLowerCase().includes(lowerSearchTerm) ||
        String(item.id).includes(searchTerm) ||
        item.quantity_assigned?.toString().includes(searchTerm) ||
        item.quantity_requested?.toString().includes(searchTerm) ||
        item.status?.toLowerCase().includes(lowerSearchTerm)
      )
    })
    
    // Sort items: overdue first, then near due, then active
    const sortedItems = [...filteredMyItems].sort((a, b) => {
      const statusA = getItemStatus(a)
      const statusB = getItemStatus(b)
      
      // Priority: overdue > near-due > active
      const priority = { 'overdue': 0, 'near-due': 1, 'active': 2 }
      const priorityDiff = priority[statusA.status] - priority[statusB.status]
      
      if (priorityDiff !== 0) return priorityDiff
      
      // If same priority, sort by days until due (ascending)
      if (statusA.daysUntilDue !== null && statusB.daysUntilDue !== null) {
        return statusA.daysUntilDue - statusB.daysUntilDue
      }
      
      return 0
    })
    
    // Pagination logic
    const totalPages = Math.ceil(sortedItems.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedItems = sortedItems.slice(startIndex, endIndex)
    
    return (
      <>
        <div className="standard-card">
          <div className="standard-card-header">
            <h3 className="standard-card-title">
            <i className="bi bi-box-seam me-2"></i>
            Inventory
            </h3>
            <div className="text-muted" style={{ fontSize: '0.875rem' }}>
              {searchTerm ? (
                <>Showing {sortedItems.length} of {myAssignedItems.length} items</>
              ) : (
                <>Total: {myAssignedItems.length} item{myAssignedItems.length !== 1 ? 's' : ''} in your Inventory</>
              )}
            </div>
        </div>

          {sortedItems.length > 0 ? (
            <>
          <div className="table-responsive">
                <table className="table-modern">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Assigned Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                    {paginatedItems.map((item: any, index: number) => {
                      const itemStatus = getItemStatus(item)
                      const isOverdue = itemStatus.status === 'overdue'
                      const isNearDue = itemStatus.status === 'near-due'
                      const isDamaged = item.inspection_status === 'damaged' || item.inspection_status === 'Damaged'
                      
                      // Determine row styling classes - NO red background for damaged items
                      const rowClasses = [
                        index % 2 === 0 ? 'even-row' : 'odd-row',
                        isOverdue ? 'assigned-item-overdue' : '',
                        isNearDue ? 'assigned-item-near-due' : ''
                      ].filter(Boolean).join(' ')
                      
                      return (
                        <tr 
                          key={item.id} 
                          className={rowClasses}
                          style={{
                            borderLeft: isOverdue 
                              ? '4px solid #ef4444' 
                              : isNearDue 
                              ? '4px solid #f59e0b' 
                              : '4px solid transparent'
                          }}
                        >
                    <td>{item.item_name}</td>
                    <td>{item.quantity_assigned || item.quantity_requested}</td>
                    <td>{new Date(item.created_at).toLocaleDateString()}</td>
                          <td>
                            {item.due_date ? (
                              <span 
                                className={isOverdue ? 'text-danger fw-bold' : isNearDue ? 'text-warning fw-semibold' : ''}
                                title={formatDueDateTooltip(item.due_date)}
                              >
                                {new Date(item.due_date).toLocaleDateString()}
                                {itemStatus.daysUntilDue !== null && (
                                  <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>
                                    {itemStatus.daysUntilDue < 0 
                                      ? `${Math.abs(itemStatus.daysUntilDue)} day${Math.abs(itemStatus.daysUntilDue) !== 1 ? 's' : ''} overdue`
                                      : itemStatus.daysUntilDue === 0
                                      ? 'Due today'
                                      : `${itemStatus.daysUntilDue} day${itemStatus.daysUntilDue !== 1 ? 's' : ''} remaining`
                                    }
                                  </small>
                                )}
                              </span>
                            ) : 'N/A'}
                          </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        {/* Assignment Status Badge */}
                        <span className={`badge ${
                          item.status === 'assigned' ? 'bg-info' :
                          item.status === 'returned' ? 'bg-success' :
                          'bg-light text-dark'
                              }`} style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                display: 'inline-block'
                              }}>
                                {item.status.toUpperCase()}
                        </span>
                        
                        {/* Due Date Status Badge - Only show for Near Due (not overdue or active) */}
                        {item.status === 'assigned' && item.due_date && itemStatus.status === 'near-due' && (
                          <span 
                            className="badge bg-warning"
                            title={formatDueDateTooltip(item.due_date)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              display: 'inline-block'
                            }}
                          >
                            <i className="bi bi-clock-fill me-1"></i>
                            NEAR DUE
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.status === 'assigned' && !isDamaged && (
                        <button 
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => openReturnModal(item)}
                          title="Return Item"
                                style={{
                                  borderRadius: '6px',
                                  padding: '4px 12px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)'
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)'
                                  e.currentTarget.style.boxShadow = 'none'
                                }}
                        >
                          <i className="bi bi-arrow-return-left me-1"></i>
                          Return
                        </button>
                      )}
                      {isDamaged && (
                        <span 
                          className="badge bg-danger"
                          title="This item is marked as damaged"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            display: 'inline-block'
                          }}
                        >
                          <i className="bi bi-exclamation-triangle-fill me-1"></i>
                          DAMAGED
                        </span>
                      )}
                    </td>
                    <td>
                      {item.notes && item.notes.includes('Please proceed to the office') ? (
                        <div style={{ 
                          padding: '8px 12px', 
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          fontSize: '0.875rem', 
                          color: '#374151',
                          borderLeft: '3px solid #dc2626',
                          maxWidth: '300px'
                        }}>
                          <i className="bi bi-info-circle me-1" style={{ color: '#dc2626' }}></i>
                          {item.notes.includes('Please proceed to the office') 
                            ? 'Please proceed to the office for further details regarding this damaged item.'
                            : item.notes}
                        </div>
                      ) : item.notes ? (
                        <div style={{ 
                          padding: '8px 12px', 
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          fontSize: '0.875rem', 
                          color: '#374151',
                          maxWidth: '300px'
                        }}>
                          {item.notes}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>

              {/* Pagination Controls */}
              {sortedItems.length > itemsPerPage && (
                <div className="inventory-pagination" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--space-4)',
                  borderTop: '1px solid var(--gray-200)',
                  marginTop: 'var(--space-4)'
                }}>
                  <div className="pagination-info" style={{
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)'
                  }}>
                    Showing {startIndex + 1} to {Math.min(endIndex, sortedItems.length)} of {sortedItems.length} items
                  </div>
                  
                  <div className="pagination-controls" style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    alignItems: 'center'
                  }}>
                    <button
                      className="btn-standard btn-outline-primary"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        opacity: currentPage === 1 ? 0.5 : 1,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <i className="bi bi-chevron-left"></i>
                      Previous
                    </button>
                    
                    <div className="pagination-page-info" style={{
                      padding: '0 var(--space-3)',
                      fontSize: '0.875rem',
                      color: 'var(--gray-600)',
                      fontWeight: '500'
                    }}>
                      Page {currentPage} of {totalPages}
                    </div>
                    
                    <button
                      className="btn-standard btn-outline-primary"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </>
        ) : (
          <div className="text-center py-5">
              <i className={`bi ${searchTerm ? 'bi-search' : 'bi-box-seam'}`} style={{ fontSize: '3rem', color: '#6c757d' }}></i>
              <h5 className="mt-3 text-muted">
                {searchTerm ? 'No items found' : 'No Items'}
              </h5>
              <p className="text-muted">
                {searchTerm 
                  ? `No items match your search "${searchTerm}". Try a different search term.`
                  : "You don't have any items in your Inventory yet."}
              </p>
          </div>
        )}

        {/* Rejected Returns Section - Only for Teachers */}
        {currentUser?.role !== 'ADMIN' && rejectedReturns.length > 0 && (
          <div className="standard-card mt-4">
            <div className="standard-card-header">
              <h3 className="standard-card-title">
                <i className="bi bi-x-circle me-2" style={{ color: '#ef4444' }}></i>
                Rejected Returns
              </h3>
              <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                Total: {rejectedReturns.length} rejected return{rejectedReturns.length !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Returned Date</th>
                    <th>Admin Response</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedReturns.map((item: any, index: number) => {
                    // Extract admin response from notes
                    const adminResponse = item.notes?.includes('Admin Response (Rejected):') 
                      ? item.notes.split('Admin Response (Rejected):')[1]?.trim() 
                      : item.notes?.includes('Admin Response:')
                      ? item.notes.split('Admin Response:')[1]?.trim()
                      : item.notes || 'No response provided'
                    
                    return (
                      <tr 
                        key={item.id}
                        className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                        style={{
                          borderLeft: '4px solid #ef4444'
                        }}
                      >
                        <td>
                          <div style={{ fontWeight: '500' }}>{item.item_name}</div>
                          {item.location && (
                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                              Location: {item.location}
                            </small>
                          )}
                        </td>
                        <td>{item.quantity_assigned || item.quantity_requested}</td>
                        <td>
                          {item.returned_at
                            ? new Date(item.returned_at).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>
                          <div style={{ 
                            maxWidth: '300px',
                            padding: '0.5rem',
                            backgroundColor: '#fef2f2',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            fontSize: '0.875rem',
                            color: '#991b1b',
                            lineHeight: '1.5'
                          }}>
                            {adminResponse}
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-danger" style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            <i className="bi bi-x-circle me-1"></i>
                            REJECTED
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
                Loading assigned items...
              </p>
            </div>
          </div>
        )}
        
        {/* Topbar inside main-content to prevent sidebar overlap */}
        {currentUser.role === 'ADMIN' ? (
          <AdminTopBar 
            currentUser={currentUser}
            onSearch={(term) => setSearchTerm(term)}
            searchValue={searchTerm}
            searchPlaceholder="Search by item name, teacher, ID, quantity, or status..."
          />
        ) : (
          <TeacherTopBar 
            currentUser={currentUser}
            onSearch={(term) => setSearchTerm(term)}
            searchValue={searchTerm}
            searchPlaceholder="Search your Inventory..."
          />
        )}
      
        <div className="dashboard-content">
        <div className="container-fluid py-4">
          {currentUser.role === 'ADMIN' ? <AdminView /> : <TeacherView />}
        </div>
      </div>
      </main>

      {/* Return Item Modal */}
      {selectedItemForReturn && (
        <ReturnItemModal
          isOpen={showReturnModal}
          onClose={closeReturnModal}
          onConfirm={returnItem}
          item={selectedItemForReturn}
          isLoading={isReturning}
        />
      )}

      {/* Admin Return Confirmation Modal */}
      <ConfirmationModal
        isOpen={showReturnConfirm}
        onClose={closeReturnConfirm}
        onConfirm={confirmAdminReturn}
        title="Mark Item as Returned"
        message={
          itemToReturn
            ? `Are you sure you want to mark "${itemToReturn.item_name}" (ID: ${itemToReturn.id}) as returned? It will be moved to the Return Review table for inspection.`
            : 'Are you sure you want to mark this item as returned?'
        }
        confirmText="Mark as Returned"
        cancelText="Cancel"
        type="info"
        warningMessage="The item will be moved to the Return Review table where you can inspect its condition."
        isLoading={isReturning}
      />
    </div>
  )
}

export default AssignedItems
