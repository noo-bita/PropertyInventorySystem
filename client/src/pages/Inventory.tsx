import React, { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import AdminQrScanner from '../components/AdminQrScanner'
import InventoryFormModal from '../components/InventoryFormModal'
import ItemDetailsModal from '../components/ItemDetailsModal'
import ConfirmationModal from '../components/ConfirmationModal'
import BulkEditModal from '../components/BulkEditModal'
import { AnimatedKPI } from '../components/AnimatedKPI'
import { useDataReady } from '../hooks/useDataReady'
import { apiFetch, getApiBaseUrl } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { showNotification } from '../utils/notifications'
import '../css/global.css'
import '../css/inventory.css'
import '../css/modals.css'

export default function Inventory() {
  const { user } = useAuth()
  const location = useLocation()
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<number | string>>(new Set())
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [currentDamagedPage, setCurrentDamagedPage] = useState(1)
  const itemsPerPage = 10
  const [showQRScannerModal, setShowQRScannerModal] = useState(false)
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  const [scannedData, setScannedData] = useState<any>(null)
  const [existingItem, setExistingItem] = useState<any>(null)
     // const [isCameraLoading, setIsCameraLoading] = useState(false)
   const [isSubmitting, setIsSubmitting] = useState(false)
   // Legacy scanner state removed; using Html5Qrcode via scannerRef

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState<string>('')
  const [deleteGroupedItem, setDeleteGroupedItem] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Bulk edit modal state
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [bulkEditGroupedItem, setBulkEditGroupedItem] = useState<any>(null)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
   

  
     // Form state for new item
  const currentUserName = user?.name || user?.email || 'Admin User'

  const getEmptyItemState = useCallback(() => ({
    name: '',
    category: '',
    secondary_category: '',
    quantity: '',
    available: '',
    location: '',
    description: '',
    serialNumber: '',
    serialNumbers: '', // For multiple serial numbers (textarea input)
    purchaseDate: '',
    purchasePrice: '',
    purchaseType: 'purchased',
    supplier: '',
    addedBy: currentUserName,
    status: 'Available',
    photo: ''
  }), [currentUserName])

  const [newItem, setNewItem] = useState(() => getEmptyItemState())

  // Reset loading when navigating to this page
  useEffect(() => {
    setIsLoading(true)
    loadInventoryItems()
  }, [location.pathname]) // Reload when navigating to this page

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopQRScanner()
    }
  }, [])

  // Stop scanner when modals open
  useEffect(() => {
    if (showAddItemModal || showItemDetailsModal) {
      stopQRScanner()
    }
  }, [showAddItemModal, showItemDetailsModal])

  useEffect(() => {
    setNewItem(prev => ({
      ...prev,
      addedBy: currentUserName
    }))
  }, [currentUserName])

  const mapInventoryItem = (item: any) => ({
    ...item,
    serialNumber: item.serial_number || item.serialNumber,
    name: item.name || item.item_name,
    category: item.category || item.item_category,
    secondary_category: item.secondary_category || item.secondaryCategory || null,
    location: item.location || item.item_location,
    description: item.description || item.item_description,
    quantity: item.quantity || item.item_quantity,
    available: item.available || item.item_available,
    status: item.status || item.item_status,
    photo: item.photo || item.item_photo,
    purchaseType: item.purchase_type || item.purchaseType || 'purchased',
    purchasePrice: item.purchase_price ?? item.purchasePrice ?? 0,
    purchaseDate: item.purchase_date || item.purchaseDate || '',
    supplier: item.supplier || item.item_supplier || '',
    addedBy: item.added_by || item.addedBy || 'Admin User',
    createdAt: item.created_at || item.createdAt || item.createdAtFormatted || ''
  })

  const loadInventoryItems = async () => {
    try {
      setIsLoading(true)
      
      // Add timeout to prevent stuck loading (max 10 seconds)
      let timeoutId: NodeJS.Timeout | undefined = setTimeout(() => {
        console.warn('Inventory data fetch timeout')
        setIsLoading(false)
      }, 10000)
      
      const response = await fetch(`${getApiBaseUrl()}/api/inventory`)
      
      // Clear timeout after response received
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = undefined
      }
      
      if (response.ok) {
        const items = await response.json()
        const mappedItems = items.map((item: any) => mapInventoryItem(item))
        setInventoryItems(mappedItems)
      } else {
        console.error('Failed to load inventory items:', response.status)
      }
    } catch (error) {
      console.error('Error loading inventory items:', error)
    } finally {
      // Ensure loading is always cleared
      setIsLoading(false)
    }
  }

  
  
  // Inventory items state (loaded from API)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const dataReady = useDataReady(isLoading)

  // Dynamically extract categories from inventory items (both primary and secondary)
  const getCategories = () => {
    const categorySet = new Set<string>()
    
    // Add default primary categories
    const defaultCategories = ['Electronics', 'Furniture', 'Office Supplies', 'Tools', 'Books', 'Sports Equipment', 'Laboratory Equipment']
    defaultCategories.forEach(cat => {
      if (cat && cat.trim()) {
        categorySet.add(cat.trim())
      }
    })
    
    // Extract unique categories from inventory items (both primary and secondary)
    inventoryItems.forEach(item => {
      if (item.category && typeof item.category === 'string' && item.category.trim()) {
        categorySet.add(item.category.trim())
      }
      if (item.secondary_category && typeof item.secondary_category === 'string' && item.secondary_category.trim()) {
        categorySet.add(item.secondary_category.trim())
      }
    })
    
    // Convert to sorted array and add "All Categories" at the beginning
    const sortedCategories = Array.from(categorySet).sort()
    return ['All Categories', ...sortedCategories]
  }

  const categories = getCategories()

  const toggleItemExpansion = (itemId: number | string, item?: any) => {
    const newExpanded = new Set(expandedItems)
    
    // If this is a group item and we're opening it, close all other groups first
    if (item?.isGrouped && !newExpanded.has(itemId)) {
      // Remove all group items - find all expanded items that are groups
      const allItems = filteredItems || []
      const groupIds = Array.from(newExpanded).filter(id => {
        const foundItem = allItems.find((p: any) => p.id === id)
        return foundItem?.isGrouped
      })
      groupIds.forEach(id => newExpanded.delete(id))
    }
    
    // Toggle the clicked item
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

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

  // Helper function to create a grouping key based on item details
  const createGroupKey = (item: any, includeStatus: boolean = false) => {
    const parts = [
      item.name?.toLowerCase().trim() || 'unnamed',
      item.category?.toLowerCase().trim() || '',
      item.location?.toLowerCase().trim() || '',
      item.description?.toLowerCase().trim() || '',
      String(item.purchase_price || 0),
      item.purchase_type?.toLowerCase().trim() || '',
      item.supplier?.toLowerCase().trim() || '',
      item.secondary_category?.toLowerCase().trim() || ''
    ]
    if (includeStatus) {
      parts.push(item.status?.toLowerCase().trim() || '')
    }
    return parts.join('|')
  }

  // Group items by name for ALL categories (like Electronics method)
  const processInventoryItems = (items: any[]) => {
    // First, map all items to ensure consistent structure
    const mappedItems = items.map((item: any) => {
      const mapped = mapInventoryItem(item)
      // Ensure serial_number is available in both formats
      if (mapped.serialNumber && !mapped.serial_number) {
        mapped.serial_number = mapped.serialNumber
      } else if (mapped.serial_number && !mapped.serialNumber) {
        mapped.serialNumber = mapped.serial_number
      }
      return mapped
    })
    
    // Separate items by status
    const regularItems = mappedItems.filter(item => {
      const status = item.status || item.item_status || ''
      return status !== 'Damaged' && status !== 'Under Maintenance'
    })
    
    const damagedItems = mappedItems.filter(item => {
      const status = item.status || item.item_status || ''
      return status === 'Damaged' || status === 'Under Maintenance'
    })
    
    // Process regular items - group by name only
    const regularGroups = new Map<string, any[]>()
    regularItems.forEach(item => {
      const key = item.name?.toLowerCase().trim() || 'unnamed'
      if (!regularGroups.has(key)) {
        regularGroups.set(key, [])
      }
      regularGroups.get(key)!.push(item)
    })
    
    // Process damaged items - group by full item details (name, category, location, description, etc.)
    const damagedGroups = new Map<string, any[]>()
    damagedItems.forEach(item => {
      const key = createGroupKey(item, false) // Don't include status in key since all are damaged
      if (!damagedGroups.has(key)) {
        damagedGroups.set(key, [])
      }
      damagedGroups.get(key)!.push(item)
    })
    
    // Create grouped items for regular items
    const regularGroupedItems: any[] = []
    const regularIndividualItems: any[] = []
    
    regularGroups.forEach((items, nameKey) => {
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
        const groupedItem = {
          ...firstItem,
          id: `group-regular-${nameKey}`, // Use a special ID for groups
          quantity: totalQuantity,
          available: totalAvailable,
          isGrouped: true,
          groupedItems: items, // Store individual items for expanded view (already mapped)
          // Use the lowest status or calculate based on availability
          status: totalAvailable === 0 ? 'Out of Stock' : 
                  totalAvailable < 5 || (totalAvailable / totalQuantity) < 0.2 ? 'Low Stock' : 
                  'Available'
        }
        regularGroupedItems.push(groupedItem)
      } else {
        // Don't group - show as individual item (quantity = 1 and only one item exists)
        regularIndividualItems.push(...items)
      }
    })
    
    // Create grouped items for damaged items - group by full details
    const damagedGroupedItems: any[] = []
    const damagedIndividualItems: any[] = []
    
    damagedGroups.forEach((items, detailKey) => {
      const totalItems = items.length
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
      
      // For damaged items: Only group if there are multiple items (totalItems > 1)
      // Single items (qty=1) should not be grouped unless there are multiple items with same details
      const shouldGroup = totalItems > 1
      
      if (shouldGroup) {
        const firstItem = items[0]
        const totalAvailable = items.reduce((sum, item) => sum + (item.available || 0), 0)
        
        // Determine status - if all are damaged, show damaged; if mixed, show the most common
        const statuses = items.map(item => item.status || item.item_status || 'Damaged')
        const damagedCount = statuses.filter(s => s === 'Damaged').length
        const maintenanceCount = statuses.filter(s => s === 'Under Maintenance').length
        const groupStatus = damagedCount >= maintenanceCount ? 'Damaged' : 'Under Maintenance'
        
        // Create a grouped item for damaged items
        const groupedItem = {
          ...firstItem,
          id: `group-damaged-${detailKey}`, // Use a special ID for damaged groups
          quantity: totalQuantity,
          available: totalAvailable,
          isGrouped: true,
          groupedItems: items, // Store individual items for expanded view
          status: groupStatus
        }
        damagedGroupedItems.push(groupedItem)
      } else {
        // Don't group - show as individual item (only one item with these details)
        damagedIndividualItems.push(...items)
      }
    })
    
    // Combine all items: regular grouped, regular individual, damaged grouped, damaged individual
    return [
      ...regularGroupedItems, 
      ...regularIndividualItems,
      ...damagedGroupedItems,
      ...damagedIndividualItems
    ]
  }

  // Helper function to check if an item is damaged
  const isItemDamaged = (item: any): boolean => {
    const status = item.status || item.item_status || ''
    if (status === 'Damaged' || status === 'Under Maintenance') {
      return true
    }
    // Check grouped items
    if (item.isGrouped && item.groupedItems) {
      return item.groupedItems.some((gi: any) => {
        const giStatus = gi.status || gi.item_status || ''
        return giStatus === 'Damaged' || giStatus === 'Under Maintenance'
      })
    }
    return false
  }

  // Separate damaged items from regular items
  const allProcessedItems = processInventoryItems(inventoryItems)
  
  // Filter out damaged items from main inventory
  const filteredItems = allProcessedItems
    .filter(item => {
      // Exclude damaged items from main table
      if (isItemDamaged(item)) return false
      
      // Include items where primary OR secondary category matches
      const matchesCategory = selectedCategory === 'All Categories' || 
        item.category === selectedCategory || 
        item.secondary_category === selectedCategory
      const lowerSearchTerm = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm || 
        item.name?.toLowerCase().includes(lowerSearchTerm) ||
        item.description?.toLowerCase().includes(lowerSearchTerm) ||
        item.category?.toLowerCase().includes(lowerSearchTerm) ||
        item.secondary_category?.toLowerCase().includes(lowerSearchTerm) ||
        item.location?.toLowerCase().includes(lowerSearchTerm) ||
        item.serialNumber?.toLowerCase().includes(lowerSearchTerm) ||
        String(item.id).includes(searchTerm) ||
        // Also search in grouped items' serial numbers for all categories
        (item.isGrouped && item.groupedItems?.some((gi: any) => 
          gi.serialNumber?.toLowerCase().includes(lowerSearchTerm)
        ))
      return matchesCategory && matchesSearch
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  
  // Get damaged items separately
  const damagedItems = allProcessedItems
    .filter(item => isItemDamaged(item))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  // Pagination calculations for main inventory
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  // Pagination calculations for damaged items
  const totalDamagedPages = Math.ceil(damagedItems.length / itemsPerPage)
  const damagedStartIndex = (currentDamagedPage - 1) * itemsPerPage
  const damagedEndIndex = damagedStartIndex + itemsPerPage
  const paginatedDamagedItems = damagedItems.slice(damagedStartIndex, damagedEndIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchTerm])


  const handleOpenManualAddItem = () => {
    // Ensure QR scanner is stopped and no scanned data is carried over
    stopQRScanner()
    setScannedData(null)
    setExistingItem(null)
    setEditingItem(null)
    setIsEditMode(false)

    // Generate a stable serial number for this new item if it doesn't have one yet
    const timestamp = Date.now()
    const generatedSerial = `ITEM-${timestamp}`

    setNewItem(prev => ({
      ...getEmptyItemState(),
      ...prev,
      serialNumber: prev.serialNumber || generatedSerial,
      addedBy: currentUserName
    }))

    setShowAddItemModal(true)
  }

  const stopQRScanner = () => {
    // Stop search scanner if active
    setShowQRScannerModal(false)
    // Clear the global flag
    ;(window as any).__ADMIN_QR_ACTIVE = false
    // Stop all video streams
      document.querySelectorAll('video').forEach((video) => {
        const mediaStream = (video as HTMLVideoElement).srcObject as MediaStream | null
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop())
      }
      (video as HTMLVideoElement).srcObject = null
      })
    // Clear scanner elements
    const adminEl = document.getElementById('admin-qr-inline')
    if (adminEl) {
      adminEl.innerHTML = ''
    }
  }

  // Check if QR code already exists in database
  const checkQRExists = async (qrData: string) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/inventory/search?qr=${encodeURIComponent(qrData)}`)
      if (response.ok) {
        const result = await response.json()
        return result.exists ? result.item : null
      }
    } catch (error) {
      console.error('Error checking QR existence:', error)
    }
    return null
  }





  const handleEditItem = (item: any) => {
    
    // Ensure QR scanner is completely stopped first
    stopQRScanner()
    
    // Set both editingItem and existingItem for the modal
    setEditingItem(item)
    setExistingItem(item)
    setIsEditMode(true)
    setShowItemDetailsModal(true)
    
  }

  const handleUpdateItem = async (itemData: any) => {
    setIsSubmitting(true)
    
    try {
      // Simple approach - always use JSON like the working backup
      // Determine source from itemSource or fallback to purchaseType
      const itemSource = itemData.itemSource || (itemData.purchaseType === 'donated' ? 'donated' : 'purchased')
      
      const updateData = {
        name: itemData.name || editingItem.name,
        category: itemData.category || editingItem.category,
        secondary_category: itemData.secondary_category !== undefined ? itemData.secondary_category : editingItem.secondary_category,
        quantity: parseInt(itemData.quantity) || editingItem.quantity || 1,
        available: parseInt(itemData.available) || editingItem.available || 1,
        location: itemData.location || editingItem.location,
        description: itemData.description || editingItem.description,
        serial_number: itemData.serialNumber || editingItem.serialNumber,
        purchase_date: itemData.purchaseDate || editingItem.purchaseDate,
        purchase_price: itemSource === 'donated' ? null : (parseFloat(itemData.purchasePrice) || editingItem.purchasePrice || 0),
        source: itemSource ? itemSource.toUpperCase() : (editingItem.source || 'PURCHASED'),
        purchase_type: itemSource === 'donated' ? 'donated' : (itemData.purchaseType || editingItem.purchaseType || 'purchased'),
        supplier: itemData.supplier ?? editingItem.supplier ?? '',
        added_by: itemData.addedBy || editingItem.addedBy || 'Admin User',
        status: itemData.status || editingItem.status || 'Available',
        photo: itemData.photo || editingItem.photo,
        consumable: itemData.consumable !== undefined ? (itemData.consumable === true || itemData.consumable === 'consumable') : (editingItem.consumable || false)
      }
      
      
      const response = await apiFetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const updatedItemResponse = await response.json()
        
        // Reload inventory to ensure proper grouping (especially for status changes)
        await loadInventoryItems()
        
        // Close modal and show success message
        closeModal()
        
        // Check if budget was adjusted and show appropriate notification
        if (updatedItemResponse.budget_adjustment) {
          const adjustment = updatedItemResponse.budget_adjustment
          showNotification(
            `Item updated successfully! ${adjustment.message}`,
            'success'
          )
        } else {
          showNotification('Item updated successfully!', 'success')
        }
      } else {
        const errorData = await response.json()
        showNotification(`Error updating item: ${errorData.message || 'Unknown error'}`, 'error')
      }
      
    } catch (error) {
      console.error('Error updating item:', error)
      showNotification('Error updating item. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitItemFromModal = async (itemData: any) => {
    setIsSubmitting(true)
    
    try {
      const quantity = parseInt(itemData.quantity) || 1
      
      // Parse serial numbers from textarea (one per line or comma-separated)
      let serialNumbers: string[] = []
      if (itemData.serialNumbers && itemData.serialNumbers.trim()) {
        // Split by newline or comma, trim, and filter empty
        serialNumbers = itemData.serialNumbers
          .split(/[\n,]+/)
          .map((sn: string) => sn.trim())
          .filter((sn: string) => sn.length > 0)
      }
      
      const payload = {
         name: itemData.name,
         category: itemData.category,
         secondary_category: itemData.secondary_category || null,
         quantity: quantity,
         available: parseInt(itemData.available) || quantity,
         location: itemData.location,
         description: itemData.description,
         serial_numbers: serialNumbers, // Send array of serial numbers
         purchase_date: itemData.purchaseDate,
         purchase_price: itemData.itemSource === 'donated' ? null : (parseFloat(itemData.purchasePrice) || 0),
         source: itemData.itemSource ? itemData.itemSource.toUpperCase() : 'PURCHASED',
         purchase_type: itemData.itemSource === 'donated' ? 'donated' : (itemData.purchaseType || 'purchased'),
         supplier: itemData.supplier || '',
         added_by: itemData.addedBy || currentUserName,
         status: itemData.status || 'Available',
         photo: itemData.photo,
         consumable: itemData.consumable === true || itemData.consumable === 'consumable'
       }


      const response = await apiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const responseData = await response.json()
        
        // Backend now returns array of items when quantity > 1
        const items = Array.isArray(responseData) ? responseData : [responseData]
        const mappedItems = items.map((item: any) => mapInventoryItem(item))
        
        // Add all new items to the inventory list
        setInventoryItems(prevItems => [...prevItems, ...mappedItems])
        
        // Close modal and show success message
        closeModal()
        showNotification(
          items.length > 1 
            ? `${items.length} items added successfully with unique serial numbers!` 
            : 'Item added successfully!', 
          'success'
        )
        
        // Reset form
        setNewItem(getEmptyItemState())
      } else {
        const errorData = await response.json()
        console.error('Backend error response:', errorData)
        console.error('Response status:', response.status)
        showNotification(`Error adding item: ${errorData.message || 'Unknown error'}`, 'error')
      }
      
    } catch (error) {
      console.error('Error adding item:', error)
      showNotification('Error adding item. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

     const closeModal = () => {
     
     // Close modals first
     setShowAddItemModal(false)
     setShowItemDetailsModal(false)
     
          // Reset all related states
      setScannedData(null)
      setExistingItem(null)
      setEditingItem(null)
      setIsEditMode(false)
      setIsSubmitting(false)
     
     // Ensure QR scanner is completely stopped
     stopQRScanner()
     
     // Reset form to empty state, not default values
    setNewItem(getEmptyItemState())
     
   }

    const scanQRButton = (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button 
        className="add-item-btn"
        onClick={() => {
          stopQRScanner()
          setShowQRScannerModal(true)
        }}
        style={{
          background: 'linear-gradient(135deg, var(--primary-blue) 0%, #166534 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          fontWeight: '500',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #15803d 0%, #14532d 100%)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, var(--primary-blue) 0%, #166534 100%)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
        title="Scan QR Code"
      >
        <i className="bi bi-qr-code-scan" style={{ fontSize: '18px' }}></i>
        <span>Scan QR</span>
      </button>
    </div>
  )

  const handleDeleteItem = (itemId: number, itemName: string) => {
    setDeleteItemId(itemId)
    setDeleteItemName(itemName)
    setDeleteGroupedItem(null)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteItem = async () => {
    if (!deleteItemId) return
    
    setIsDeleting(true)
    try {
      const response = await apiFetch(`/api/inventory/${deleteItemId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove item from local state
        setInventoryItems(prevItems => prevItems.filter(item => item.id !== deleteItemId))
        showNotification('Item deleted successfully!', 'success')
        loadInventoryItems() // Refresh to update grouped items
        setShowDeleteConfirm(false)
        setDeleteItemId(null)
        setDeleteItemName('')
      } else {
        const errorData = await response.json().catch(() => ({}))
        showNotification(`Error deleting item: ${errorData.message || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      showNotification('Error deleting item. Please try again.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditGroup = (groupedItem: any) => {
    if (!groupedItem.groupedItems || groupedItem.groupedItems.length === 0) {
      showNotification('No items to edit in this group', 'error')
      return
    }
    setBulkEditGroupedItem(groupedItem)
    setShowBulkEditModal(true)
  }

  const handleDeleteGroup = (groupedItem: any) => {
    if (!groupedItem.groupedItems || groupedItem.groupedItems.length === 0) {
      showNotification('No items to delete in this group', 'error')
      return
    }
    setDeleteGroupedItem(groupedItem)
    setDeleteItemId(null)
    setDeleteItemName('')
    setShowDeleteConfirm(true)
  }

  const confirmDeleteGroup = async () => {
    if (!deleteGroupedItem) return

    try {
      setIsDeleting(true)
      const itemIds = deleteGroupedItem.groupedItems.map((item: any) => item.id)
      
      const response = await apiFetch('/api/inventory/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ item_ids: itemIds })
      })

      const data = await response.json()

      if (response.ok) {
        showNotification(
          `Successfully deleted ${data.deleted_count} item(s)${data.total_refunded > 0 ? `. Refunded ₱${data.total_refunded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to budget.` : ''}`,
          'success'
        )
        // Refresh inventory to update the list
        loadInventoryItems()
        // Close any expanded views
        setExpandedItems(new Set())
        setShowDeleteConfirm(false)
        setDeleteGroupedItem(null)
      } else {
        showNotification(
          data.message || `Error deleting items: ${data.errors?.join(', ') || 'Unknown error'}`,
          'error'
        )
      }
    } catch (error: any) {
      console.error('Error deleting group:', error)
      showNotification('Error deleting items. Please try again.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkUpdate = async (updateData: any) => {
    if (!bulkEditGroupedItem) return

    try {
      setIsBulkUpdating(true)
      const itemIds = bulkEditGroupedItem.groupedItems.map((item: any) => item.id)
      
      const response = await apiFetch('/api/inventory/bulk-update', {
        method: 'POST',
        body: JSON.stringify({
          item_ids: itemIds,
          ...updateData
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Check if budget was refunded and show appropriate notification
        let notificationMessage = `Successfully updated ${data.updated_count || itemIds.length} item(s)!`
        if (data.budget_adjustment) {
          const adjustment = data.budget_adjustment
          if (adjustment.refunded_message) {
            notificationMessage += ` ${adjustment.refunded_message}`
          }
          if (adjustment.deducted_message) {
            notificationMessage += ` ${adjustment.deducted_message}`
          }
        }
        
        showNotification(notificationMessage, 'success')
        // Refresh inventory to update the list
        loadInventoryItems()
        // Close modal
        setShowBulkEditModal(false)
        setBulkEditGroupedItem(null)
      } else {
        showNotification(
          data.message || `Error updating items: ${data.errors?.join(', ') || 'Unknown error'}`,
          'error'
        )
      }
    } catch (error: any) {
      console.error('Error updating items:', error)
      showNotification('Error updating items. Please try again.', 'error')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  return (
    <div className="dashboard-container">
      <Sidebar />
      
      <main className="main-content">
        {/* Loading overlay - only covers main content, sidebar remains visible */}
        {isLoading && (
          <div className="main-content-loading">
            <div className="full-screen-spinner">
              <div className="loading-spinner-large"></div>
              <p style={{ marginTop: 'var(--space-4)', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                Loading inventory...
              </p>
            </div>
          </div>
        )}
        <AdminTopBar 
          currentUser={user || { name: '', role: 'ADMIN' }}
          rightContent={scanQRButton}
          hideSearch={false}
          searchPlaceholder="Search items by name, category, location, serial number..."
          onSearch={(term) => setSearchTerm(term)}
          searchValue={searchTerm}
        />
        
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Inventory Management</h1>
            <p className="dashboard-subtitle">Track and manage all your property inventory items</p>
          </div>

          {/* Inventory Overview Cards - Enhanced Modern Design with Animations */}
          <div className="kpi-grid kpi-grid-inventory">
            <AnimatedKPI
              label="Total Items"
              value={inventoryItems.length}
              icon="bi-box"
              iconClass="kpi-icon-primary"
              loading={isLoading}
              dataReady={dataReady}
            />
            
            <AnimatedKPI
              label="Available Items"
              value={inventoryItems.reduce((sum, item) => {
                const available = typeof item.available === 'number' ? item.available : parseInt(item.available) || 0
                return sum + available
              }, 0)}
              icon="bi-check-circle"
              iconClass="kpi-icon-success"
              loading={isLoading}
              dataReady={dataReady}
            />
            
            <AnimatedKPI
              label="Categories"
              value={categories.length - 1}
              icon="bi-tags"
              iconClass="kpi-icon-info"
              loading={isLoading}
              dataReady={dataReady}
            />
            
            <AnimatedKPI
              label="Total Value"
              value={Math.round(inventoryItems.reduce((sum, item) => {
                  const value = item.purchaseType === 'donated' ? 0 : (item.purchasePrice * item.quantity)
                  return sum + value
              }, 0))}
              icon="bi-currency-dollar"
              iconClass="kpi-icon-warning"
              loading={isLoading}
              dataReady={dataReady}
            />
          </div>

          {/* Inventory Table */}
          {!isLoading && (
          <div className="inventory-section">
            <div className="section-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-4)'
            }}>
              <h3>All Inventory Items</h3>
              
              {/* Category Filter - Moved to the right end of header */}
              <select 
                className="category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '10px 15px',
                  paddingRight: '35px',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  color: 'var(--text-dark)',
                  cursor: 'pointer',
                  minWidth: '150px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
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
                  {isLoading ? (
                    // Loading spinner for table
                    <tr>
                      <td colSpan={8} className="text-center py-5">
                        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                        <p className="mt-3 text-muted">Loading items...</p>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        <i className="bi bi-box" style={{ fontSize: '2rem', color: '#cbd5e1' }}></i>
                        <p className="mt-2 text-muted">No items found</p>
                        <p className="text-muted">Click "Scan QR Code" or "Add item" to add your first inventory item</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, index) => {
                      // Determine if item is low stock (available < 5 or available < 20% of quantity)
                      const isLowStock = item.available < 5 || (item.quantity > 0 && (item.available / item.quantity) < 0.2)
                      const isGrouped = item.isGrouped
                      
                      return (
                      <React.Fragment key={item.id}>
                        {/* Main row - grouped for all categories, individual for others */}
                        <tr 
                          className={`${expandedItems.has(item.id) ? 'expanded-row' : ''} ${isLowStock ? 'low-stock-row' : ''} ${index % 2 === 0 ? 'even-row' : 'odd-row'} ${isGrouped ? 'grouped-electronics-row' : ''}`}
                          onClick={() => toggleItemExpansion(item.id, item)}
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: isGrouped && expandedItems.has(item.id) ? '#dcfce7' : undefined
                          }}
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
                            <span className={`badge badge-modern ${getStatusBadgeColor(item.status)} ${isLowStock ? 'badge-low-stock' : ''}`}>
                              {item.status}
                              {isLowStock && <i className="bi bi-exclamation-triangle-fill ms-1" style={{ fontSize: '10px' }}></i>}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons action-buttons-modern" onClick={(e) => e.stopPropagation()}>
                              {isGrouped ? (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button 
                                    className="action-btn-bulk-edit action-btn-modern"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEditGroup(item)
                                    }}
                                    title={`Edit All ${item.groupedItems?.length || 0} Items`}
                                  >
                                    <i className="bi bi-pencil"></i>
                                    <span>Edit All</span>
                                    <span className="item-count-badge">{item.groupedItems?.length || 0}</span>
                                  </button>
                                <button 
                                  className="action-btn-bulk-delete action-btn-modern"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteGroup(item)
                                  }}
                                  title={`Delete All ${item.groupedItems?.length || 0} Items`}
                                >
                                  <i className="bi bi-trash"></i>
                                  <span>Delete All</span>
                                  <span className="item-count-badge">{item.groupedItems?.length || 0}</span>
                                </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button 
                                    className="action-btn-edit action-btn-modern"
                                    onClick={() => handleEditItem(item)}
                                    title="Edit Item"
                                  >
                                    <i className="bi bi-pencil"></i>
                                    <span>Edit</span>
                                  </button>
                                  <button 
                                    className="action-btn-delete action-btn-modern"
                                    onClick={() => handleDeleteItem(item.id, item.name)}
                                    title="Delete Item"
                                  >
                                    <i className="bi bi-trash"></i>
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedItems.has(item.id) && (
                          <>
                            {isGrouped ? (
                              // Expanded view for grouped items - show individual items
                              <>
                                <tr className="expanded-details-header" style={{ backgroundColor: '#f8f9fa' }}>
                                  <td colSpan={8} style={{ 
                                    padding: '1rem 1.5rem', 
                                    fontWeight: '600', 
                                    color: '#495057',
                                    marginTop: '1rem',
                                    borderTop: '2px solid #e5e7eb'
                                  }}>
                                    <i className="bi bi-box-seam" style={{ marginRight: '0.5rem' }}></i>
                                    Individual Items ({item.groupedItems?.length || 0})
                                  </td>
                                </tr>
                                {item.groupedItems?.map((individualItem: any, idx: number) => {
                                  const individualLowStock = individualItem.available < 5 || (individualItem.quantity > 0 && (individualItem.available / individualItem.quantity) < 0.2)
                                  const isIndividualExpanded = expandedItems.has(`individual-${individualItem.id}`)
                                  return (
                                    <React.Fragment key={individualItem.id}>
                                      {/* Summary row for individual item - clickable to expand */}
                                      <tr 
                                        className="electronics-individual-item-summary"
                                        style={{ 
                                          backgroundColor: '#f0fdf4',
                                          cursor: 'pointer',
                                          borderTop: idx === 0 ? '2px solid #e5e7eb' : 'none'
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleItemExpansion(`individual-${individualItem.id}`)
                                        }}
                                      >
                                        <td style={{ 
                                          paddingLeft: '3rem', 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem'
                                        }}>
                                          <i className={`bi ${isIndividualExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                                        </td>
                                        <td style={{ 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem' 
                                        }}>
                                          <span className="item-id">#{String(individualItem.id).padStart(3, '0')}</span>
                                        </td>
                                        <td style={{ 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem' 
                                        }}>
                                          <div className="item-info-cell">
                                            <span>{individualItem.name}</span>
                                          </div>
                                        </td>
                                        <td style={{ 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem' 
                                        }}>
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
                                        <td style={{ 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem' 
                                        }}>{individualItem.quantity}</td>
                                        <td style={{ 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem' 
                                        }}>
                                          <span>
                                            {individualItem.available}
                                          </span>
                                        </td>
                                        <td style={{ 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem' 
                                        }}>
                                          <span className={`badge badge-modern ${getStatusBadgeColor(individualItem.status)}`}>
                                            {individualItem.status}
                                          </span>
                                        </td>
                                        <td style={{ 
                                          paddingTop: idx === 0 ? '1rem' : '0.75rem', 
                                          paddingBottom: '0.75rem' 
                                        }}>
                                          <div className="action-buttons action-buttons-modern" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                              className="action-btn-edit action-btn-modern"
                                              onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleEditItem(individualItem)
                                              }}
                                              title="Edit Item"
                                            >
                                              <i className="bi bi-pencil"></i>
                                              <span>Edit</span>
                                            </button>
                                            <button 
                                              className="action-btn-delete action-btn-modern"
                                              onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleDeleteItem(individualItem.id, individualItem.name)
                                              }}
                                              title="Delete Item"
                                            >
                                              <i className="bi bi-trash"></i>
                                              <span>Delete</span>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                      {/* Expanded details for individual item */}
                                      {isIndividualExpanded && (
                                        <tr className="expanded-details electronics-individual-item">
                                          <td colSpan={8} style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
                                            <div className="item-details-grid" style={{ marginLeft: '3rem', marginTop: '0.5rem' }}>
                                              <div className="item-info-section">
                                                <div className="info-row">
                                                  <div className="detail-item">
                                                    <label>ITEM NAME:</label>
                                                    <span>{individualItem.name}</span>
                                                  </div>
                                                  <div className="detail-item">
                                                    <label>AVAILABLE:</label>
                                                    <span>{individualItem.available}</span>
                                                  </div>
                                                  <div className="detail-item">
                                                    <label>DESCRIPTION:</label>
                                                    <span>{individualItem.description || 'No description available'}</span>
                                                  </div>
                                                </div>
                                                
                                                <div className="info-row">
                                                  <div className="detail-item">
                                                    <label>CATEGORY:</label>
                                                    <span>
                                                      {individualItem.category}
                                                      {individualItem.secondary_category && (
                                                        <span style={{
                                                          marginLeft: '0.5rem',
                                                          fontSize: '0.875rem',
                                                          color: '#6c757d',
                                                          fontStyle: 'italic'
                                                        }}>
                                                          (Secondary: {individualItem.secondary_category})
                                                        </span>
                                                      )}
                                                    </span>
                                                  </div>
                                                  <div className="detail-item">
                                                    <label>LOCATION:</label>
                                                    <span>{individualItem.location}</span>
                                                  </div>
                                                  {(() => {
                                                    const isConsumable = individualItem.consumable === true || individualItem.consumable === 1 || individualItem.consumable === '1' || individualItem.consumable === 'true'
                                                    if (!isConsumable) {
                                                      return (
                                                        <div className="detail-item">
                                                          <label>SERIAL NUMBER:</label>
                                                          <span style={{ fontFamily: 'monospace', color: '#16a34a', fontWeight: '600' }}>
                                                            {individualItem.serialNumber || individualItem.serial_number || 'N/A'}
                                                          </span>
                                                        </div>
                                                      )
                                                    }
                                                    return null
                                                  })()}
                                                  <div className="detail-item">
                                                    <label>STATUS:</label>
                                                    <span>{individualItem.status}</span>
                                                  </div>
                                                </div>
                                                
                                                <div className="info-row">
                                                  <div className="detail-item">
                                                    <label>QUANTITY:</label>
                                                    <span>{individualItem.quantity}</span>
                                                  </div>
                                                  <div className="detail-item">
                                                    <label>SOURCE TYPE:</label>
                                                    <span>{individualItem.purchaseType === 'donated' ? 'Donated' : 'School Purchased'}</span>
                                                  </div>
                                                  <div className="detail-item">
                                                    <label>PURCHASE DATE:</label>
                                                    <span>{individualItem.purchaseDate ? new Date(individualItem.purchaseDate).toLocaleDateString() : 'Not specified'}</span>
                                                  </div>
                                                </div>
                                                
                                                <div className="info-row">
                                                  <div className="detail-item">
                                                    <label>DATE ADDED:</label>
                                                    <span>{individualItem.createdAt ? new Date(individualItem.createdAt).toLocaleDateString() : 'Not specified'}</span>
                                                  </div>
                                                </div>
                                                
                                                <div className="info-row">
                                                  <div className="detail-item">
                                                    <label>PURCHASE PRICE:</label>
                                                    <span>{individualItem.purchaseType === 'donated' ? 'N/A (Donated)' : `₱${individualItem.purchasePrice ? Number(individualItem.purchasePrice).toLocaleString() : '0'}`}</span>
                                                  </div>
                                                  <div className="detail-item">
                                                    <label>SUPPLIER:</label>
                                                    <span>{individualItem.supplier || 'Not specified'}</span>
                                                  </div>
                                                  <div className="detail-item">
                                                    <label>ADDED BY:</label>
                                                    <span>{individualItem.addedBy || 'Not specified'}</span>
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              <div className="item-photo-qr-section">
                                                <div className="photo-upload-area">
                                                  <label>ITEM PHOTO:</label>
                                                  <div className="photo-display">
                                                    {individualItem.photo ? (
                                                      <img 
                                                        src={individualItem.photo.startsWith('http') ? individualItem.photo : `${getApiBaseUrl()}/${individualItem.photo}`}
                                                        alt={individualItem.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                                        onError={(e) => {
                                                          e.currentTarget.style.display = 'none'
                                                          e.currentTarget.nextElementSibling?.classList.remove('d-none')
                                                        }}
                                                      />
                                                    ) : (
                                                      <div className="photo-placeholder">
                                                        <i className="bi bi-image" style={{ fontSize: '24px', color: '#cbd5e1' }}></i>
                                                        <span>No Image</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                
                                                {/* QR Code Display - Hidden for consumable items */}
                                                {(() => {
                                                  const isConsumable = individualItem.consumable === true || individualItem.consumable === 1 || individualItem.consumable === '1' || individualItem.consumable === 'true'
                                                  if (isConsumable) {
                                                    return (
                                                      <div className="qr-code-display">
                                                        <label>QR CODE:</label>
                                                        <div className="qr-image-container" style={{
                                                          display: 'flex',
                                                          flexDirection: 'column',
                                                          alignItems: 'center',
                                                          justifyContent: 'center',
                                                          color: '#9ca3af',
                                                          fontSize: '0.875rem'
                                                        }}>
                                                          <i className="bi bi-info-circle" style={{ fontSize: '32px', marginBottom: '0.5rem' }}></i>
                                                          <span>Not available for consumable items</span>
                                                        </div>
                                                      </div>
                                                    )
                                                  }
                                                  return (
                                                    <div className="qr-code-display">
                                                      <label>QR CODE:</label>
                                                      {(() => {
                                                        // Use serial_number from database or serialNumber from mapped item
                                                        const serialNum = individualItem.serialNumber || individualItem.serial_number
                                                        const itemId = individualItem.id
                                                        const itemName = individualItem.name || 'Unknown Item'
                                                        const itemCategory = individualItem.category || 'General'
                                                        const itemLocation = individualItem.location || 'Unknown'
                                                        
                                                        // Create structured QR data with identifying information
                                                        const qrData = serialNum 
                                                          ? `ITEM-${itemId}|SN:${serialNum}|${itemName}|${itemCategory}|${itemLocation}`
                                                          : `ITEM-${itemId}|${itemName}|${itemCategory}|${itemLocation}`
                                                        
                                                        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`
                                                        
                                                        // Download function
                                                        const downloadQRCode = () => {
                                                          try {
                                                            const canvas = document.createElement('canvas')
                                                            const ctx = canvas.getContext('2d')
                                                            if (!ctx) return
                                                            
                                                            canvas.width = 300
                                                            canvas.height = 380
                                                            
                                                            const img = new Image()
                                                            img.crossOrigin = 'anonymous'
                                                            img.onload = () => {
                                                              ctx.fillStyle = '#ffffff'
                                                              ctx.fillRect(0, 0, canvas.width, canvas.height)
                                                              ctx.drawImage(img, 50, 20, 200, 200)
                                                              
                                                              ctx.fillStyle = '#000000'
                                                              ctx.font = 'bold 14px Arial'
                                                              ctx.textAlign = 'center'
                                                              ctx.fillText(itemName, 150, 250)
                                                              
                                                              if (serialNum) {
                                                                ctx.font = '12px Arial'
                                                                ctx.fillText(`SN: ${serialNum}`, 150, 275)
                                                              }
                                                              
                                                              ctx.font = '10px Arial'
                                                              ctx.fillText(`ID: ${itemId}`, 150, 295)
                                                              ctx.fillText(`${itemCategory} | ${itemLocation}`, 150, 315)
                                                              
                                                              canvas.toBlob((blob) => {
                                                                if (blob) {
                                                                  const url = URL.createObjectURL(blob)
                                                                  const link = document.createElement('a')
                                                                  link.download = `QR-${itemName.replace(/[^a-z0-9]/gi, '_')}-${serialNum || itemId}.png`
                                                                  link.href = url
                                                                  link.click()
                                                                  URL.revokeObjectURL(url)
                                                                  showNotification('QR Code downloaded successfully!', 'success')
                                                                }
                                                              }, 'image/png')
                                                            }
                                                            img.onerror = () => {
                                                              const link = document.createElement('a')
                                                              link.download = `QR-${itemName.replace(/[^a-z0-9]/gi, '_')}-${serialNum || itemId}.png`
                                                              link.href = qrImageUrl
                                                              link.click()
                                                              showNotification('QR Code downloaded successfully!', 'success')
                                                            }
                                                            img.src = qrImageUrl
                                                          } catch (error) {
                                                            console.error('Error downloading QR code:', error)
                                                            showNotification('Error downloading QR code. Please try again.', 'error')
                                                          }
                                                        }
                                                        
                                                        return (
                                                          <>
                                                            <div className="qr-image-container" style={{
                                                              display: 'flex',
                                                              flexDirection: 'column',
                                                              justifyContent: 'space-between',
                                                              padding: '0.75rem',
                                                              gap: '0.5rem'
                                                            }}>
                                                              {/* QR Code Image */}
                                                              <div style={{
                                                                flex: '1 1 0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                minHeight: 0,
                                                                overflow: 'hidden'
                                                              }}>
                                                                <img 
                                                                  src={qrImageUrl}
                                                                  alt="QR Code"
                                                                  style={{ 
                                                                    maxWidth: '100%',
                                                                    maxHeight: '100%',
                                                                    width: 'auto',
                                                                    height: 'auto',
                                                                    objectFit: 'contain',
                                                                    display: 'block'
                                                                  }}
                                                                  onError={(e) => {
                                                                    e.currentTarget.style.display = 'none'
                                                                    const placeholder = e.currentTarget.nextElementSibling
                                                                    if (placeholder) {
                                                                      placeholder.classList.remove('d-none')
                                                                    }
                                                                  }}
                                                                />
                                                                <div className="qr-placeholder d-none" style={{
                                                                  width: '100%',
                                                                  height: '100%',
                                                                  display: 'flex',
                                                                  flexDirection: 'column',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  color: '#9ca3af',
                                                                  fontSize: '0.875rem'
                                                                }}>
                                                                  <i className="bi bi-qr-code" style={{ fontSize: '32px', marginBottom: '0.5rem' }}></i>
                                                                  <span>QR Code</span>
                                                                </div>
                                                              </div>
                                                              
                                                              {/* Item Info for identification */}
                                                              {serialNum && (
                                                                <div style={{
                                                                  padding: '0.4rem 0.5rem',
                                                                  backgroundColor: '#f8f9fa',
                                                                  borderRadius: '4px',
                                                                  fontSize: '0.7rem',
                                                                  textAlign: 'center',
                                                                  border: '1px solid #dee2e6',
                                                                  flexShrink: 0
                                                                }}>
                                                                  <div style={{ fontFamily: 'monospace', color: '#16a34a', fontWeight: '600', fontSize: '0.65rem' }}>
                                                                    SN: {serialNum}
                                                                  </div>
                                                                  <div style={{ color: '#6c757d', fontSize: '0.6rem', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {itemName}
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>
                                                            
                                                            {/* Download Button - Outside the green container */}
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation()
                                                                downloadQRCode()
                                                              }}
                                                              style={{
                                                                width: '180px',
                                                                marginTop: '0.5rem',
                                                                padding: '0.5rem',
                                                                backgroundColor: '#16a34a',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '600',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '0.4rem',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                                transition: 'background-color 0.2s'
                                                              }}
                                                              onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#15803d'
                                                              }}
                                                              onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#16a34a'
                                                              }}
                                                              title="Download QR Code"
                                                            >
                                                              <i className="bi bi-download" style={{ fontSize: '0.8rem' }}></i>
                                                              <span>Download</span>
                                                            </button>
                                                          </>
                                                        )
                                                      })()}
                                                    </div>
                                                  )
                                                })()}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
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
                                      <span>{item.location}</span>
                                    </div>
                                  <div className="detail-item">
                                    <label>SERIAL NUMBER:</label>
                                    <span>{item.serialNumber || ''}</span>
                                  </div>
                                    <div className="detail-item">
                                      <label>STATUS:</label>
                                      <span>{item.status}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="info-row">
                                    <div className="detail-item">
                                      <label>QUANTITY:</label>
                                      <span>{item.quantity}</span>
                                    </div>
                                    <div className="detail-item">
                                      <label>SOURCE TYPE:</label>
                                      <span>{item.purchaseType === 'donated' ? 'Donated' : 'School Purchased'}</span>
                                    </div>
                                    <div className="detail-item">
                                      <label>PURCHASE DATE:</label>
                                      <span>{item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : 'Not specified'}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="info-row">
                                    <div className="detail-item">
                                      <label>DATE ADDED:</label>
                                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Not specified'}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="info-row">
                                    <div className="detail-item">
                                      <label>PURCHASE PRICE:</label>
                                      <span>{item.purchaseType === 'donated' ? 'N/A (Donated)' : `₱${item.purchasePrice ? Number(item.purchasePrice).toLocaleString() : '0'}`}</span>
                                    </div>
                                    <div className="detail-item">
                                      <label>SUPPLIER:</label>
                                      <span>{item.supplier || 'Not specified'}</span>
                                    </div>
                                    <div className="detail-item">
                                      <label>ADDED BY:</label>
                                      <span>{item.addedBy || 'Not specified'}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="item-photo-qr-section">
                                  <div className="photo-upload-area">
                                    <label>ITEM PHOTO:</label>
                                    <div className="photo-display">
                                      {item.photo ? (
                                        <img 
                                          src={item.photo.startsWith('http') ? item.photo : `${getApiBaseUrl()}/${item.photo}`}
                                          alt={item.name}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none'
                                            e.currentTarget.nextElementSibling?.classList.remove('d-none')
                                          }}
                                        />
                                      ) : (
                                        <div className="photo-placeholder">
                                          <i className="bi bi-image" style={{ fontSize: '24px', color: '#cbd5e1' }}></i>
                                          <span>No Image</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* QR Code Display - Hidden for consumable items */}
                                  {(() => {
                                    const isConsumable = item.consumable === true || item.consumable === 1 || item.consumable === '1' || item.consumable === 'true'
                                    if (isConsumable) {
                                      return (
                                        <div className="qr-code-display">
                                          <label>QR CODE:</label>
                                          <div className="qr-image-container" style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#9ca3af',
                                            fontSize: '0.875rem'
                                          }}>
                                            <i className="bi bi-info-circle" style={{ fontSize: '32px', marginBottom: '0.5rem' }}></i>
                                            <span>Not available for consumable items</span>
                                          </div>
                                        </div>
                                      )
                                    }
                                    return (
                                      <div className="qr-code-display">
                                        <label>QR CODE:</label>
                                        <div className="qr-image-container" style={{ position: 'relative' }}>
                                          {(() => {
                                            const serialNum = item.serialNumber || item.serial_number
                                            const itemId = item.id
                                            const itemName = item.name || 'Unknown Item'
                                            const itemCategory = item.category || 'General'
                                            const itemLocation = item.location || 'Unknown'
                                            
                                            // Create structured QR data with identifying information
                                            const qrData = serialNum 
                                              ? `ITEM-${itemId}|SN:${serialNum}|${itemName}|${itemCategory}|${itemLocation}`
                                              : `ITEM-${itemId}|${itemName}|${itemCategory}|${itemLocation}`
                                            
                                            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`
                                            
                                            // Download function
                                            const downloadQRCode = () => {
                                              try {
                                                const canvas = document.createElement('canvas')
                                                const ctx = canvas.getContext('2d')
                                                if (!ctx) return
                                                
                                                canvas.width = 300
                                                canvas.height = 380
                                                
                                                const img = new Image()
                                                img.crossOrigin = 'anonymous'
                                                img.onload = () => {
                                                  ctx.fillStyle = '#ffffff'
                                                  ctx.fillRect(0, 0, canvas.width, canvas.height)
                                                  ctx.drawImage(img, 50, 20, 200, 200)
                                                  
                                                  ctx.fillStyle = '#000000'
                                                  ctx.font = 'bold 14px Arial'
                                                  ctx.textAlign = 'center'
                                                  ctx.fillText(itemName, 150, 250)
                                                  
                                                  if (serialNum) {
                                                    ctx.font = '12px Arial'
                                                    ctx.fillText(`SN: ${serialNum}`, 150, 275)
                                                  }
                                                  
                                                  ctx.font = '10px Arial'
                                                  ctx.fillText(`ID: ${itemId}`, 150, 295)
                                                  ctx.fillText(`${itemCategory} | ${itemLocation}`, 150, 315)
                                                  
                                                  canvas.toBlob((blob) => {
                                                    if (blob) {
                                                      const url = URL.createObjectURL(blob)
                                                      const link = document.createElement('a')
                                                      link.download = `QR-${itemName.replace(/[^a-z0-9]/gi, '_')}-${serialNum || itemId}.png`
                                                      link.href = url
                                                      link.click()
                                                      URL.revokeObjectURL(url)
                                                      showNotification('QR Code downloaded successfully!', 'success')
                                                    }
                                                  }, 'image/png')
                                                }
                                                img.onerror = () => {
                                                  const link = document.createElement('a')
                                                  link.download = `QR-${itemName.replace(/[^a-z0-9]/gi, '_')}-${serialNum || itemId}.png`
                                                  link.href = qrImageUrl
                                                  link.click()
                                                  showNotification('QR Code downloaded successfully!', 'success')
                                                }
                                                img.src = qrImageUrl
                                              } catch (error) {
                                                console.error('Error downloading QR code:', error)
                                                showNotification('Error downloading QR code. Please try again.', 'error')
                                              }
                                            }
                                            
                                            return (
                                              <>
                                                <img 
                                                  src={qrImageUrl}
                                                  alt="QR Code"
                                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                  onError={(e) => {
                                                    e.currentTarget.style.display = 'none'
                                                    e.currentTarget.nextElementSibling?.classList.remove('d-none')
                                                  }}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    downloadQRCode()
                                                  }}
                                                  style={{
                                                    position: 'absolute',
                                                    bottom: '8px',
                                                    right: '8px',
                                                    padding: '0.375rem 0.75rem',
                                                    backgroundColor: '#16a34a',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                    transition: 'background-color 0.2s'
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#15803d'
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#16a34a'
                                                  }}
                                                  title="Download QR Code"
                                                >
                                                  <i className="bi bi-download" style={{ fontSize: '0.875rem' }}></i>
                                                  Download
                                                </button>
                                              </>
                                            )
                                          })()}
                                        </div>
                                        {/* Item Info for identification */}
                                        {(() => {
                                          const serialNum = item.serialNumber || item.serial_number
                                          return serialNum ? (
                                            <div style={{
                                              marginTop: '0.5rem',
                                              padding: '0.5rem',
                                              backgroundColor: '#f8f9fa',
                                              borderRadius: '4px',
                                              fontSize: '0.75rem',
                                              textAlign: 'center',
                                              border: '1px solid #dee2e6'
                                            }}>
                                              <div style={{ fontFamily: 'monospace', color: '#16a34a', fontWeight: '600' }}>
                                                SN: {serialNum}
                                              </div>
                                              <div style={{ color: '#6c757d', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                                {item.name}
                                              </div>
                                            </div>
                                          ) : null
                                        })()}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            </td>
                          </tr>
                            )}
                          </>
                        )}
                      </React.Fragment>
                    )
                    })
                  )}
                </tbody>
              </table>
              
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
          </div>
          )}

          {/* Damaged Items Table */}
          {!isLoading && damagedItems.length > 0 && (
            <div className="inventory-section" style={{ marginTop: 'var(--space-6)' }}>
              <div className="section-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)'
              }}>
                <h3 style={{ color: '#dc2626' }}>
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Damaged Items
                </h3>
                <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                  Total: {damagedItems.length} {damagedItems.length === 1 ? 'item' : 'items'}
                </div>
              </div>
              
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
                    {paginatedDamagedItems.map((item, index) => {
                      const isGrouped = item.isGrouped
                      
                      return (
                        <React.Fragment key={item.id}>
                          <tr 
                            className={`${expandedItems.has(item.id) ? 'expanded-row' : ''} ${index % 2 === 0 ? 'even-row' : 'odd-row'} ${isGrouped ? 'grouped-electronics-row' : ''}`}
                            onClick={() => toggleItemExpansion(item.id, item)}
                            style={{ 
                              cursor: 'pointer', 
                              backgroundColor: isGrouped && expandedItems.has(item.id) 
                                ? '#fef2f2' 
                                : (index % 2 === 0 ? '#fef2f2' : '#fff')
                            }}
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
                                    color: '#dc2626',
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
                            <td>{item.available}</td>
                            <td>
                              <span className={`badge badge-modern ${item.status === 'Damaged' ? 'badge-danger' : 'badge-warning'}`}>
                                {item.status}
                                <i className="bi bi-exclamation-triangle-fill ms-1" style={{ fontSize: '10px' }}></i>
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons action-buttons-modern" onClick={(e) => e.stopPropagation()}>
                                {isGrouped ? (
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                      className="action-btn-bulk-edit action-btn-modern"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditGroup(item)
                                      }}
                                      title={`Edit All ${item.groupedItems?.length || 0} Items`}
                                    >
                                      <i className="bi bi-pencil"></i>
                                      <span>Edit All</span>
                                      <span className="item-count-badge">{item.groupedItems?.length || 0}</span>
                                    </button>
                                    <button 
                                      className="action-btn-bulk-delete action-btn-modern"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteGroup(item)
                                      }}
                                      title={`Delete All ${item.groupedItems?.length || 0} Items`}
                                    >
                                      <i className="bi bi-trash"></i>
                                      <span>Delete All</span>
                                      <span className="item-count-badge">{item.groupedItems?.length || 0}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button 
                                      className="action-btn-edit action-btn-modern"
                                      onClick={() => handleEditItem(item)}
                                      title="Edit Item"
                                    >
                                      <i className="bi bi-pencil"></i>
                                      <span>Edit</span>
                                    </button>
                                    <button 
                                      className="action-btn-delete action-btn-modern"
                                      onClick={() => handleDeleteItem(item.id, item.name)}
                                      title="Delete Item"
                                    >
                                      <i className="bi bi-trash"></i>
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedItems.has(item.id) && (
                            isGrouped ? (
                              <>
                                <tr className="expanded-details-header" style={{ backgroundColor: '#f8f9fa' }}>
                                  <td colSpan={8} style={{ 
                                    padding: '1rem 1.5rem', 
                                    fontWeight: '600', 
                                    color: '#495057',
                                    marginTop: '1rem',
                                    borderTop: '2px solid #e5e7eb'
                                  }}>
                                    <i className="bi bi-box-seam" style={{ marginRight: '0.5rem' }}></i>
                                    Individual Items ({item.groupedItems?.length || 0})
                                  </td>
                                </tr>
                                {item.groupedItems?.map((individualItem: any, idx: number) => (
                                  <React.Fragment key={individualItem.id}>
                                    <tr className="expanded-details" style={{ backgroundColor: '#fef2f2' }}>
                                      <td colSpan={8} style={{ paddingTop: '1rem', paddingBottom: '1rem', paddingLeft: '3rem' }}>
                                        <div className="item-details-grid" style={{ marginTop: '0.5rem' }}>
                                          <div className="item-info-section">
                                            <div className="info-row">
                                              <div className="detail-item">
                                                <label>ITEM NAME:</label>
                                                <span>{individualItem.name}</span>
                                              </div>
                                              <div className="detail-item">
                                                <label>AVAILABLE:</label>
                                                <span>{individualItem.available}</span>
                                              </div>
                                              <div className="detail-item">
                                                <label>LOCATION:</label>
                                                <span>{individualItem.location || 'Not specified'}</span>
                                              </div>
                                              <div className="detail-item">
                                                <label>STATUS:</label>
                                                <span className={`badge ${individualItem.status === 'Damaged' ? 'badge-danger' : 'badge-warning'}`}>
                                                  {individualItem.status}
                                                </span>
                                              </div>
                                              <div className="detail-item">
                                                <label>SERIAL NUMBER:</label>
                                                <span>{individualItem.serialNumber || individualItem.serial_number || 'N/A'}</span>
                                              </div>
                                              <div className="detail-item">
                                                <label>DESCRIPTION:</label>
                                                <span>{individualItem.description || 'No description'}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div style={{ 
                                          marginTop: '1rem', 
                                          paddingTop: '1rem', 
                                          borderTop: '1px solid #e5e7eb',
                                          display: 'flex',
                                          justifyContent: 'flex-end',
                                          gap: '0.5rem'
                                        }}>
                                          <div className="action-buttons action-buttons-modern" onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                              <button 
                                                className="action-btn-edit action-btn-modern"
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  handleEditItem(individualItem)
                                                }}
                                                title="Edit Item"
                                              >
                                                <i className="bi bi-pencil"></i>
                                                <span>Edit</span>
                                              </button>
                                              <button 
                                                className="action-btn-delete action-btn-modern"
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  e.stopPropagation()
                                                  handleDeleteItem(individualItem.id, individualItem.name)
                                                }}
                                                title="Delete Item"
                                              >
                                                <i className="bi bi-trash"></i>
                                                <span>Delete</span>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                ))}
                              </>
                            ) : (
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
                                          <label>LOCATION:</label>
                                          <span>{item.location || 'Not specified'}</span>
                                        </div>
                                        <div className="detail-item">
                                          <label>STATUS:</label>
                                          <span className={`badge ${item.status === 'Damaged' ? 'badge-danger' : 'badge-warning'}`}>
                                            {item.status}
                                          </span>
                                        </div>
                                        <div className="detail-item">
                                          <label>SERIAL NUMBER:</label>
                                          <span>{item.serialNumber || item.serial_number || 'N/A'}</span>
                                        </div>
                                        <div className="detail-item">
                                          <label>DESCRIPTION:</label>
                                          <span>{item.description || 'No description'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ 
                                    marginTop: '1rem', 
                                    paddingTop: '1rem', 
                                    borderTop: '1px solid #e5e7eb',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '0.5rem'
                                  }}>
                                    <div className="action-buttons action-buttons-modern" onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                          className="action-btn-edit action-btn-modern"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleEditItem(item)
                                          }}
                                          title="Edit Item"
                                        >
                                          <i className="bi bi-pencil"></i>
                                          <span>Edit</span>
                                        </button>
                                        <button 
                                          className="action-btn-delete action-btn-modern"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleDeleteItem(item.id, item.name)
                                          }}
                                          title="Delete Item"
                                        >
                                          <i className="bi bi-trash"></i>
                                          <span>Delete</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
                
                {/* Pagination Controls for Damaged Items */}
                {damagedItems.length > itemsPerPage && (
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
                      Showing {damagedStartIndex + 1} to {Math.min(damagedEndIndex, damagedItems.length)} of {damagedItems.length} items
                    </div>
                    
                    <div className="pagination-controls" style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      alignItems: 'center'
                    }}>
                      <button
                        className="btn-standard btn-outline-primary"
                        onClick={() => setCurrentDamagedPage(prev => Math.max(1, prev - 1))}
                        disabled={currentDamagedPage === 1}
                        style={{
                          opacity: currentDamagedPage === 1 ? 0.5 : 1,
                          cursor: currentDamagedPage === 1 ? 'not-allowed' : 'pointer'
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
                        Page {currentDamagedPage} of {totalDamagedPages}
                      </div>
                      
                      <button
                        className="btn-standard btn-outline-primary"
                        onClick={() => setCurrentDamagedPage(prev => Math.min(totalDamagedPages, prev + 1))}
                        disabled={currentDamagedPage === totalDamagedPages}
                        style={{
                          opacity: currentDamagedPage === totalDamagedPages ? 0.5 : 1,
                          cursor: currentDamagedPage === totalDamagedPages ? 'not-allowed' : 'pointer'
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
        </div>
      </main>

             {/* Add Item Modal */}
                       <InventoryFormModal
           isOpen={showAddItemModal}
           onClose={closeModal}
           onSubmit={handleSubmitItemFromModal}
           scannedData={scannedData}
           isSubmitting={isSubmitting}
           newItem={newItem}
           onInputChange={(field: string, value: any) => {
             setNewItem(prev => ({
               ...prev,
               [field]: value
             }))
           }}
          isReadOnlyFromScan={Boolean(scannedData)}
         />

      {/* Item Details Modal */}
              <ItemDetailsModal
          isOpen={showItemDetailsModal}
          onClose={closeModal}
          existingItem={isEditMode ? editingItem : existingItem}
          scannedQRData={scannedData?.serialNumber}
          isEditMode={isEditMode}
          onEdit={() => {
            // Use the current item being displayed in the modal
            const currentItem = isEditMode ? editingItem : existingItem
            setEditingItem(currentItem)
            setIsEditMode(true)
          }}
          onSave={handleUpdateItem}
          isSubmitting={isSubmitting}
          onCancelEdit={() => setIsEditMode(false)}
        />

      {/* Floating Add Item Button */}
      <button
        className="add-item-btn"
        onClick={handleOpenManualAddItem}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          borderRadius: '50px',
          padding: '14px 24px',
          fontSize: '16px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
      >
        <i className="bi bi-plus-circle"></i> Add item
      </button>

      {/* QR Scanner for Search - Also handles adding new items */}
      {showQRScannerModal && (
        <AdminQrScanner
          isOpen={showQRScannerModal}
          onClose={() => {
            // Ensure inventory scanner is stopped
            stopQRScanner()
            setShowQRScannerModal(false)
          }}
          onDetected={async (decodedText) => {
            // Close scanner first
            setShowQRScannerModal(false)
            // Ensure inventory scanner is stopped
            stopQRScanner()
            
            // Check if QR code exists in database (same logic as inventory scanner)
            const existingItem = await checkQRExists(decodedText)
            
            if (existingItem) {
              // Item exists - show details modal (same as inventory scanner)
              const mappedItem = {
                ...existingItem,
                serialNumber: existingItem.serial_number || existingItem.serialNumber || decodedText,
                scannedQRData: decodedText,
                name: existingItem.name || existingItem.item_name,
                category: existingItem.category || existingItem.item_category,
                location: existingItem.location || existingItem.item_location,
                description: existingItem.description || existingItem.item_description,
                quantity: existingItem.quantity || existingItem.item_quantity,
                available: existingItem.available || existingItem.item_available,
                status: existingItem.status || existingItem.item_status,
                photo: existingItem.photo || existingItem.item_photo
              }
              setExistingItem(mappedItem)
              setShowItemDetailsModal(true)
              showNotification('Item found! Opening details...', 'success')
            } else {
              // Item doesn't exist - parse QR data and show add item form (same as inventory scanner)
              try {
                const parts = decodedText.split('-')
                if (parts.length >= 4 && parts[0] === 'ITEM') {
                  const scannedItem = {
                    id: parts[1],
                    name: parts[2],
                    category: parts[3],
                    location: parts[4] || 'Unknown',
                    description: 'Scanned from QR code',
                    serialNumber: `QR-${parts[1]}`,
                    purchaseDate: new Date().toISOString().split('T')[0],
                    purchasePrice: 0,
                    quantity: 1,
                    available: 1,
                    status: 'Available'
                  }
                  setScannedData(scannedItem)
                  
                  setNewItem({
                    name: scannedItem.name,
                    category: scannedItem.category,
                    secondary_category: '',
                    quantity: '',
                    available: '',
                    location: scannedItem.location,
                    description: '',
                    serialNumber: scannedItem.serialNumber,
                    serialNumbers: '',
                    purchaseDate: '',
                    purchasePrice: '',
                    purchaseType: 'purchased',
                    supplier: '',
                    addedBy: currentUserName,
                    status: 'Available',
                    photo: ''
                  })
                  
                  // Show add item modal
                  setShowAddItemModal(true)
                  showNotification('QR code scanned successfully! Please review and complete the item details.', 'success')
                } else {
                  // If QR format doesn't match, try to search in table
                  setSearchTerm(decodedText)
                  showNotification('QR code scanned! Searching inventory...', 'success')
                }
              } catch (error) {
                console.error('Error parsing QR data:', error)
                // Fallback to search if parsing fails
                setSearchTerm(decodedText)
                showNotification('QR code scanned! Searching inventory...', 'success')
              }
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false)
            setDeleteItemId(null)
            setDeleteItemName('')
            setDeleteGroupedItem(null)
          }
        }}
        onConfirm={deleteGroupedItem ? confirmDeleteGroup : confirmDeleteItem}
        title="Delete Item"
        message={
          deleteGroupedItem
            ? `Are you sure you want to delete ALL ${deleteGroupedItem.groupedItems.length} item(s) of "${deleteGroupedItem.name}"?`
            : `Are you sure you want to delete "${deleteItemName}"?`
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="delete"
        warningMessage={
          deleteGroupedItem
            ? (() => {
                const purchasedItems = deleteGroupedItem.groupedItems.filter((item: any) => 
                  item.purchase_type === 'purchased' && item.purchase_price > 0
                )
                const totalRefund = purchasedItems.reduce((sum: number, item: any) => 
                  sum + (parseFloat(item.purchase_price) || 0), 0
                )
                return totalRefund > 0
                  ? `This will refund ₱${totalRefund.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to the budget. This action cannot be undone.`
                  : 'This action cannot be undone.'
              })()
            : 'This action cannot be undone.'
        }
        isLoading={isDeleting}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => {
          if (!isBulkUpdating) {
            setShowBulkEditModal(false)
            setBulkEditGroupedItem(null)
          }
        }}
        onSave={handleBulkUpdate}
        groupedItem={bulkEditGroupedItem}
        isSubmitting={isBulkUpdating}
      />
    </div>
  )
}
