import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch, getApiBaseUrl } from '../utils/api'
import Sidebar from '../components/Sidebar'
import TeacherTopBar from '../components/TeacherTopBar'
import AdminTopBar from '../components/AdminTopBar'
import TeacherItemRequestModal from '../components/TeacherItemRequestModal'
import TeacherQrScanner from '../components/TeacherQrScanner'
import { showNotification } from '../utils/notifications'
import '../css/global.css'
import '../css/send-request.css'
import '../css/modals.css'

interface InventoryItem {
  id: number | string
  name: string
  category: string
  available: number
  location?: string
  quantity: number
  status?: string
  description?: string
  serial_number?: string | null
  purchase_date?: string | null
  purchase_price?: number | null
  purchase_type?: string
  supplier?: string | null
  consumable?: boolean
  photo?: string | null
  isGrouped?: boolean
  groupedItems?: InventoryItem[]
  secondary_category?: string
}

const ItemRequestPage = () => {
  const { user: currentUser } = useAuth()
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<number | string>>(new Set())
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Map inventory item to ensure consistent structure
  const mapInventoryItem = (item: any): InventoryItem => ({
    id: item.id,
    name: item.name || item.item_name,
    category: item.category || item.item_category,
    secondary_category: item.secondary_category || item.secondaryCategory || null,
    available: item.available || item.item_available || 0,
    location: item.location || item.item_location,
    quantity: item.quantity || item.item_quantity || 0,
    status: item.status || item.item_status || 'Available',
    description: item.description || item.item_description,
    consumable: item.consumable ?? false,
    serial_number: item.serial_number || item.serialNumber || null,
    purchase_date: item.purchase_date || item.purchaseDate || null,
    purchase_price: item.purchase_price || item.purchasePrice || null,
    purchase_type: item.purchase_type || item.purchaseType || 'purchased',
    supplier: item.supplier || null,
    photo: item.photo || null
  })

  // Group items by name (same logic as admin inventory)
  const processInventoryItems = (items: any[]): InventoryItem[] => {
    // First, map all items to ensure consistent structure
    const mappedItems = items.map((item: any) => mapInventoryItem(item))
    
    // Group ALL items by name
    const itemGroups = new Map<string, InventoryItem[]>()
    mappedItems.forEach(item => {
      const key = item.name?.toLowerCase().trim() || 'unnamed'
      if (!itemGroups.has(key)) {
        itemGroups.set(key, [])
      }
      itemGroups.get(key)!.push(item)
    })
    
    // Create grouped items - only group if conditions are met
    const groupedItems: InventoryItem[] = []
    const individualItems: InventoryItem[] = []
    
    itemGroups.forEach((items, nameKey) => {
      const totalItems = items.length
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
      
      // Group ONLY if:
      // 1. There are multiple items with the same name (totalItems > 1), OR
      // 2. The total quantity across all items is greater than 1
      const shouldGroup = totalItems > 1 || totalQuantity > 1
      
      if (shouldGroup) {
        const firstItem = items[0]
        const totalAvailable = items.reduce((sum, item) => sum + (item.available || 0), 0)
        
        // Create a grouped item
        const groupedItem: InventoryItem = {
          ...firstItem,
          id: `group-${nameKey}`, // Use a special ID for groups
          quantity: totalQuantity,
          available: totalAvailable,
          isGrouped: true,
          groupedItems: items, // Store individual items
          status: totalAvailable === 0 ? 'Out of Stock' : 
                  totalAvailable < 5 || (totalAvailable / totalQuantity) < 0.2 ? 'Low Stock' : 
                  'Available'
        }
        groupedItems.push(groupedItem)
      } else {
        // Don't group - show as individual item
        individualItems.push(...items)
      }
    })
    
    // Combine grouped items and individual items
    return [...groupedItems, ...individualItems]
  }

  // Load inventory items
  useEffect(() => {
    loadInventoryItems()
  }, [])

  const loadInventoryItems = async () => {
    try {
      setLoading(true)
      const response = await apiFetch('/api/inventory')
      if (response.ok) {
        const items = await response.json()
        // Filter out items with status 'Under Maintenance' or 'Damaged' - not requestable by teachers
        const availableItems = (items || []).filter((item: any) => 
          item.status !== 'Under Maintenance' && item.status !== 'Damaged'
        )
        // Process items to group them
        const processedItems = processInventoryItems(availableItems)
        setInventoryItems(processedItems)
      }
    } catch (error) {
      console.error('Error loading inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestClick = (item: InventoryItem) => {
    if (item.available <= 0) {
      showNotification('This item is currently out of stock.', 'error')
      return
    }
    if (item.status === 'Under Maintenance') {
      showNotification('This item is currently under maintenance and cannot be requested.', 'error')
      return
    }
    if (item.status === 'Damaged') {
      showNotification('This item is damaged and cannot be requested.', 'error')
      return
    }
    setSelectedItem(item)
    setShowRequestModal(true)
  }

  const handleRequestSuccess = () => {
    // Refresh inventory to show updated availability (items are automatically reserved)
    loadInventoryItems()
    setSelectedItem(null)
    setShowRequestModal(false)
  }

  // Get status badge color (same as admin inventory)
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Available':
        return 'badge-success'
      case 'Low Stock':
        return 'badge-warning'
      case 'Out of Stock':
        return 'badge-danger'
      default:
        return 'badge-secondary'
    }
  }


  const stopQRScanner = () => {
    setShowQRScanner(false)
    // Clean up any video streams
    document.querySelectorAll('video').forEach((video) => {
      const mediaStream = (video as HTMLVideoElement).srcObject as MediaStream | null
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop())
      }
      ;(video as HTMLVideoElement).srcObject = null
    })
    // Clear scanner elements
    const teacherEl = document.getElementById('teacher-qr-inline')
    if (teacherEl) {
      teacherEl.innerHTML = ''
    }
    ;(window as any).__TEACHER_QR_ACTIVE = false
  }

  // Toggle item expansion
  const toggleItemExpansion = (itemId: number | string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // Filter items - Enhanced search functionality
  const filteredItems = inventoryItems.filter(item => {
    // Include items where primary OR secondary category matches
    const matchesCategory = selectedCategory === 'All Categories' || 
      item.category === selectedCategory || 
      item.secondary_category === selectedCategory
    
    if (!searchTerm.trim()) {
      return matchesCategory
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase()
    const matchesSearch = 
      item.name?.toLowerCase().includes(lowerSearchTerm) ||
      item.category?.toLowerCase().includes(lowerSearchTerm) ||
      item.secondary_category?.toLowerCase().includes(lowerSearchTerm) ||
      item.location?.toLowerCase().includes(lowerSearchTerm) ||
      item.description?.toLowerCase().includes(lowerSearchTerm) ||
      String(item.id).includes(searchTerm) ||
      // Also search in grouped items
      (item.isGrouped && item.groupedItems?.some((gi: InventoryItem) => 
        gi.name?.toLowerCase().includes(lowerSearchTerm) ||
        gi.location?.toLowerCase().includes(lowerSearchTerm)
      ))
    
    return matchesSearch && matchesCategory
  })

  // Get unique categories (including secondary categories)
  const getCategories = () => {
    const categorySet = new Set<string>()
    inventoryItems.forEach(item => {
      if (item.category) categorySet.add(item.category)
      if (item.secondary_category) categorySet.add(item.secondary_category)
    })
    return ['All Categories', ...Array.from(categorySet).sort()]
  }
  const categories = getCategories()

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  // Admin View - Manage Item Requests (keep existing functionality)
  const AdminView = () => {
    const [requests, setRequests] = useState<any[]>([])
    const [showApprovalModal, setShowApprovalModal] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [approvalDueDate, setApprovalDueDate] = useState('')
    const [approvalQuantity, setApprovalQuantity] = useState(1)

    useEffect(() => {
      const fetchRequests = async () => {
        try {
          const requestsResponse = await apiFetch('/api/requests')
          if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json()
            setRequests(requestsData)
          }
        } catch (error) {
          console.error('Error fetching requests:', error)
        }
      }
      fetchRequests()
    }, [])

    const refreshRequests = async () => {
      try {
        const requestsResponse = await apiFetch('/api/requests')
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json()
          setRequests(requestsData)
        }
      } catch (error) {
        console.error('Error refreshing requests:', error)
      }
    }

    const openApprovalModal = (request: any) => {
      setSelectedRequest(request)
      setApprovalDueDate('')
      setApprovalQuantity(request.quantity_requested || 1)
      setShowApprovalModal(true)
    }

    const approveRequest = async () => {
      if (!selectedRequest) return
      try {
        const res = await apiFetch(`/api/requests/${selectedRequest.id}/approve-and-assign`, {
          method: 'POST',
          body: JSON.stringify({
            due_date: approvalDueDate,
            quantity: approvalQuantity
          })
        })
        if (res.ok) {
          await refreshRequests()
          showNotification('Request approved and assigned successfully!', 'success')
          setShowApprovalModal(false)
        } else {
          const errorData = await res.json().catch(() => ({}))
          showNotification(errorData.message || 'Failed to approve request', 'error')
        }
      } catch (error) {
        console.error('Error approving request:', error)
        showNotification('Error approving request. Please try again.', 'error')
      }
    }

    const deleteRequest = async (requestId: number) => {
      try {
        const response = await apiFetch(`/api/requests/${requestId}`, {
          method: 'DELETE'
        })
        if (response.ok) {
          await refreshRequests()
          showNotification('Request deleted successfully!', 'success')
        } else {
          const errorData = await response.json().catch(() => ({}))
          showNotification(errorData.message || 'Failed to delete request', 'error')
        }
      } catch (error) {
        console.error('Error deleting request:', error)
        showNotification('Error deleting request. Please try again.', 'error')
      }
    }

    const itemRequests = requests.filter((r: any) => r.request_type === 'item' || !r.request_type)

    return (
      <>
        <div className="standard-card mb-4">
          <div className="standard-card-header">
            <h3 className="standard-card-title">
              <i className="bi bi-box-seam me-2"></i>
              Item Requests Management
            </h3>
          </div>
          <div className="standard-card-body">
            <div className="table-responsive">
              <table className="table table-modern">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Teacher</th>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRequests.map((request: any) => (
                    <tr key={request.id}>
                      <td>{request.id}</td>
                      <td>{request.teacher_name}</td>
                      <td>{request.item_name}</td>
                      <td>{request.quantity_requested}</td>
                      <td>
                        <span className={`badge ${
                          request.status === 'pending' ? 'bg-warning' :
                          request.status === 'approved' ? 'bg-success' :
                          request.status === 'assigned' ? 'bg-info' :
                          request.status === 'returned' ? 'bg-secondary' :
                          'bg-light text-dark'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td>{new Date(request.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          {request.status === 'pending' && (
                            <button
                              className="btn btn-outline-success btn-sm"
                              onClick={() => openApprovalModal(request)}
                              title="Approve Request"
                            >
                              <i className="bi bi-check"></i>
                            </button>
                          )}
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => deleteRequest(request.id)}
                            title="Delete Request"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Approval Modal */}
        {showApprovalModal && selectedRequest && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Approve Request</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowApprovalModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <strong>Item:</strong> {selectedRequest.item_name}<br/>
                    <strong>Teacher:</strong> {selectedRequest.teacher_name}<br/>
                    <strong>Quantity Requested:</strong> {selectedRequest.quantity_requested}
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Due Date *</label>
                        <input
                          type="date"
                          value={approvalDueDate}
                          onChange={(e) => setApprovalDueDate(e.target.value)}
                          className="form-control"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Quantity to Assign *</label>
                        <input
                          type="number"
                          min="1"
                          max={selectedRequest.quantity_requested}
                          value={approvalQuantity}
                          onChange={(e) => setApprovalQuantity(parseInt(e.target.value) || 1)}
                          className="form-control"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowApprovalModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={approveRequest}
                    disabled={!approvalDueDate || approvalQuantity < 1}
                  >
                    <i className="bi bi-check-circle me-1"></i>
                    Approve & Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Teacher View - New Inventory List Design
  const TeacherView = () => {
    const [myRequests, setMyRequests] = useState<any[]>([])
    const [requestsCurrentPage, setRequestsCurrentPage] = useState(1)
    const requestsPerPage = 10

    useEffect(() => {
      const loadMyRequests = async () => {
        try {
          const response = await apiFetch('/api/requests')
          if (response.ok) {
            const allRequests = await response.json()
            const filtered = allRequests.filter((r: any) =>
              String(r.teacher_name).toLowerCase() === String(currentUser?.name).toLowerCase()
            )
            setMyRequests(filtered)
            setRequestsCurrentPage(1) // Reset to first page when requests are loaded
          }
        } catch (error) {
          console.error('Error loading my requests:', error)
        }
      }
      if (currentUser) {
        loadMyRequests()
      }
    }, [currentUser])

    // Pagination calculations for requests
    const requestsTotalPages = Math.ceil(myRequests.length / requestsPerPage)
    const requestsStartIndex = (requestsCurrentPage - 1) * requestsPerPage
    const requestsEndIndex = requestsStartIndex + requestsPerPage
    const paginatedRequests = myRequests.slice(requestsStartIndex, requestsEndIndex)

    return (
      <>
        {/* Inventory List Section */}
        <div className="standard-card mb-4">
          <div className="standard-card-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 className="standard-card-title">
                <i className="bi bi-box-seam me-2"></i>
                Available Inventory Items
              </h3>
              <p className="dashboard-subtitle mb-0">
                Click "Request" to submit a request for an item
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* QR Scanner Button */}
              <button
                type="button"
                onClick={() => {
                  stopQRScanner()
                  setShowQRScanner(true)
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--primary-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#15803d'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-blue)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
                title="Scan QR Code"
              >
                <i className="bi bi-qr-code-scan" style={{ fontSize: '18px' }}></i>
                Scan QR
              </button>
              
              {/* Category Filter - Only show when not loading */}
              {!loading && (
              <select 
                className="category-filter"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                  setCurrentPage(1)
                }}
                style={{
                  padding: '10px 15px',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: 'var(--text-dark)',
                  cursor: 'pointer',
                  minWidth: '150px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    zIndex: 1,
                    position: 'relative'
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              )}
            </div>
          </div>
          <div className="standard-card-body">
            
            {/* Search Results Info */}
            {searchTerm && (
              <div className="mb-3" style={{
                fontSize: '0.875rem',
                color: 'var(--gray-600)',
                fontStyle: 'italic'
              }}>
                <i className="bi bi-info-circle me-1"></i>
                Found {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} matching "{searchTerm}"
              </div>
            )}

            {/* Empty State */}
            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-inbox"></i>
                </div>
                <div className="empty-state-title">No items found</div>
                <div className="empty-state-description">
                  {searchTerm || selectedCategory !== 'All Categories'
                    ? 'Try adjusting your search or filter criteria'
                    : 'No items are currently available in the inventory'}
                </div>
              </div>
            ) : (
              <>
                {/* Inventory Table - Same structure as Admin Inventory */}
                <div className="inventory-table inventory-table-modern">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}></th>
                        <th>Item ID</th>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Available</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item, index) => {
                        // Determine if item is low stock
                        const isLowStock = item.available < 5 || (item.quantity > 0 && (item.available / item.quantity) < 0.2)
                        const isGrouped = item.isGrouped
                        
                        return (
                          <React.Fragment key={item.id}>
                            {/* Main row */}
                            <tr 
                              className={`${expandedItems.has(item.id) ? 'expanded-row' : ''} ${isLowStock ? 'low-stock-row' : ''} ${index % 2 === 0 ? 'even-row' : 'odd-row'} ${isGrouped ? 'grouped-electronics-row' : ''}`}
                              onClick={() => toggleItemExpansion(item.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>
                                <i className={`bi ${expandedItems.has(item.id) ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                              </td>
                              <td>
                                {isGrouped ? (
                                  <span className="item-id" style={{ fontStyle: 'italic', color: '#6c757d' }}>
                                    Group
                                  </span>
                                ) : (
                                  <span className="item-id">#{String(item.id).padStart(3, '0')}</span>
                                )}
                              </td>
                          <td>
                            <div className="item-info-cell">
                              <span>{item.name}</span>
                                  {isGrouped && (
                                    <span style={{
                                      marginLeft: '0.5rem',
                                      fontSize: '0.75rem',
                                      color: '#16a34a',
                                      fontWeight: '500'
                                    }}>
                                      ({item.groupedItems?.length || 0} items)
                                    </span>
                                  )}
                            </div>
                          </td>
                              <td>
                                <div>
                                  {item.category}
                                  {item.secondary_category && (
                                    <span style={{
                                      marginLeft: '0.5rem',
                                      fontSize: '0.75rem',
                                      color: '#6c757d',
                                      fontStyle: 'italic'
                                    }}>
                                      ({item.secondary_category})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{item.quantity}</td>
                          <td>
                                <span className={isLowStock ? 'low-stock-indicator' : ''}>
                              {item.available}
                            </span>
                          </td>
                              <td>
                                <span className={`badge badge-modern ${
                                  item.status === 'Available' ? 'badge-success' :
                                  item.status === 'Low Stock' ? 'badge-warning' :
                                  'badge-danger'
                                } ${isLowStock ? 'badge-low-stock' : ''}`}>
                                  {item.status}
                                  {isLowStock && <i className="bi bi-exclamation-triangle-fill ms-1" style={{ fontSize: '10px' }}></i>}
                                </span>
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div className="action-buttons action-buttons-modern">
                            <button
                                    className="action-btn-modern action-btn-request"
                              onClick={() => handleRequestClick(item)}
                              disabled={item.available === 0}
                              title={
                                item.available === 0
                                  ? 'Item is out of stock'
                                        : item.isGrouped
                                        ? 'Request items from this group'
                                  : 'Request this item'
                              }
                            >
                                    <i className="bi bi-cart-plus"></i>
                                    <span>Request</span>
                            </button>
                                </div>
                          </td>
                        </tr>
                            {expandedItems.has(item.id) && (
                              <>
                                {isGrouped ? (
                                  // Expanded view for grouped items - show individual items
                                  <>
                                    <tr className="expanded-details-header" style={{ backgroundColor: '#f8f9fa' }}>
                                      <td colSpan={8} style={{ padding: '0.75rem 1rem', fontWeight: '600', color: '#495057' }}>
                                        <i className="bi bi-box-seam" style={{ marginRight: '0.5rem' }}></i>
                                        Individual Items ({item.groupedItems?.length || 0})
                                      </td>
                                    </tr>
                                    {item.groupedItems?.map((individualItem: InventoryItem, idx: number) => {
                                      const individualLowStock = individualItem.available < 5 || (individualItem.quantity > 0 && (individualItem.available / individualItem.quantity) < 0.2)
                                      return (
                                        <tr 
                                          key={individualItem.id}
                                          className="electronics-individual-item-summary"
                                          style={{ 
                                            backgroundColor: '#f0fdf4'
                                          }}
                                        >
                                          <td style={{ paddingLeft: '3rem' }}></td>
                                          <td>
                                            <span className="item-id">#{String(individualItem.id).padStart(3, '0')}</span>
                                          </td>
                                          <td>
                                            <div className="item-info-cell">
                                              <span>{individualItem.name}</span>
                                            </div>
                                          </td>
                                          <td>
                                            <div>
                                              {individualItem.category}
                                              {individualItem.secondary_category && (
                                                <span style={{
                                                  marginLeft: '0.5rem',
                                                  fontSize: '0.75rem',
                                                  color: '#6c757d',
                                                  fontStyle: 'italic'
                                                }}>
                                                  ({individualItem.secondary_category})
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td>{individualItem.quantity}</td>
                                          <td>
                                            <span className={individualLowStock ? 'low-stock-indicator' : ''}>
                                              {individualItem.available}
                                            </span>
                                          </td>
                                          <td>
                                            <span className={`badge badge-modern ${
                                              individualItem.status === 'Available' ? 'badge-success' :
                                              individualItem.status === 'Low Stock' ? 'badge-warning' :
                                              'badge-danger'
                                            } ${individualLowStock ? 'badge-low-stock' : ''}`}>
                                              {individualItem.status}
                                              {individualLowStock && <i className="bi bi-exclamation-triangle-fill ms-1" style={{ fontSize: '10px' }}></i>}
                                            </span>
                                          </td>
                                          <td onClick={(e) => e.stopPropagation()}>
                                            <div className="action-buttons action-buttons-modern">
                                              <button 
                                                className="action-btn-modern action-btn-request"
                                                onClick={() => handleRequestClick(individualItem)}
                                                disabled={individualItem.available === 0}
                                                title={individualItem.available > 0 ? 'Request this item' : 'Out of stock'}
                                              >
                                                <i className="bi bi-cart-plus"></i>
                                                <span>Request</span>
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </>
                                ) : (
                                  // Expanded view for individual (non-grouped) items
                                  <tr className="expanded-details">
                                    <td colSpan={8}>
                                      <div className="item-details-grid">
                                        <div className="item-info-section">
                                          <div className="info-row">
                                            <div className="detail-item">
                                              <label>ITEM NAME:</label>
                                              <span>{item.name}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>AVAILABLE:</label>
                                              <span>{item.available}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>DESCRIPTION:</label>
                                              <span>{item.description || 'No description available'}</span>
                                            </div>
                                          </div>
                                          
                                          <div className="info-row">
                                            <div className="detail-item">
                                              <label>CATEGORY:</label>
                                              <span>
                                                {item.category}
                                                {item.secondary_category && (
                                                  <span style={{
                                                    marginLeft: '0.5rem',
                                                    fontSize: '0.875rem',
                                                    color: '#6c757d',
                                                    fontStyle: 'italic'
                                                  }}>
                                                    (Secondary: {item.secondary_category})
                                                  </span>
                                                )}
                                              </span>
                                            </div>
                                            <div className="detail-item">
                                              <label>LOCATION:</label>
                                              <span>{item.location || 'N/A'}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>QUANTITY:</label>
                                              <span>{item.quantity}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>STATUS:</label>
                                              <span>{item.status}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            )}
                          </React.Fragment>
                        )
                      })}
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
              </>
            )}
          </div>
        </div>

        {/* My Requests History */}
        {myRequests.length > 0 && (
          <div className="standard-card">
            <div className="standard-card-header">
              <h3 className="standard-card-title">
                <i className="bi bi-clock-history me-2"></i>
                My Item Requests
              </h3>
            </div>
            <div className="standard-card-body">
              <div className="table-responsive">
                <table className="table table-modern">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>Request Date</th>
                      <th>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((request: any) => (
                      <tr key={request.id}>
                        <td>{request.item_name}</td>
                        <td>{request.quantity_requested}</td>
                        <td>
                          <span className={`badge ${
                            request.status === 'pending' ? 'bg-warning' :
                            request.status === 'approved' ? 'bg-success' :
                            request.status === 'assigned' ? 'bg-info' :
                            request.status === 'returned' ? 'bg-secondary' :
                            'bg-light text-dark'
                          }`}>
                            {request.status}
                          </span>
                        </td>
                        <td>{new Date(request.created_at).toLocaleDateString()}</td>
                        <td>{request.due_date ? new Date(request.due_date).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls for Requests */}
              {myRequests.length > requestsPerPage && (
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
                    Showing {requestsStartIndex + 1} to {Math.min(requestsEndIndex, myRequests.length)} of {myRequests.length} requests
                  </div>
                  
                  <div className="pagination-controls" style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    alignItems: 'center'
                  }}>
                    <button
                      className="btn-standard btn-outline-primary"
                      onClick={() => setRequestsCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={requestsCurrentPage === 1}
                      style={{
                        opacity: requestsCurrentPage === 1 ? 0.5 : 1,
                        cursor: requestsCurrentPage === 1 ? 'not-allowed' : 'pointer'
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
                      Page {requestsCurrentPage} of {requestsTotalPages}
                    </div>
                    
                    <button
                      className="btn-standard btn-outline-primary"
                      onClick={() => setRequestsCurrentPage(prev => Math.min(requestsTotalPages, prev + 1))}
                      disabled={requestsCurrentPage === requestsTotalPages}
                      style={{
                        opacity: requestsCurrentPage === requestsTotalPages ? 0.5 : 1,
                        cursor: requestsCurrentPage === requestsTotalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Next
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
                Loading inventory items...
              </p>
            </div>
          </div>
        )}
        
        {currentUser.role === 'ADMIN' ? (
          <AdminTopBar />
        ) : (
          <TeacherTopBar
            currentUser={currentUser}
            searchPlaceholder="Search items by name, category, location, or description..."
            onSearch={(term) => {
              setSearchTerm(term)
              setCurrentPage(1)
            }}
            searchValue={searchTerm}
          />
        )}
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            {currentUser.role === 'ADMIN' ? <AdminView /> : <TeacherView />}
          </div>
        </div>
      </main>

      {/* Request Modal */}
      {showRequestModal && selectedItem && currentUser && (
        <TeacherItemRequestModal
          item={selectedItem}
          currentUser={currentUser}
          onClose={() => {
            setShowRequestModal(false)
            setSelectedItem(null)
          }}
          onSuccess={handleRequestSuccess}
        />
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && currentUser && (
        <TeacherQrScanner
          isOpen={showQRScanner}
          onClose={stopQRScanner}
          onRequestSuccess={handleRequestSuccess}
        />
      )}

    </div>
  )
}

export default ItemRequestPage
