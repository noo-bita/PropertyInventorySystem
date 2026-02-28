import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getApiBaseUrl } from '../utils/api'
import { showNotification } from '../utils/notifications'
import AutocompleteInput from './AutocompleteInput'
import { saveToHistory } from '../utils/inputHistory'

interface InventoryFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (itemData: any) => void
  scannedData: any
  isSubmitting: boolean
  newItem: any
  onInputChange: (field: string, value: any) => void
  isReadOnlyFromScan: boolean
  isFormLoading?: boolean
}

interface Supplier {
  id: number
  supplier_name: string
  company_name: string | null
  type?: 'supplier' | 'donor'
}

export default function InventoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  scannedData,
  isSubmitting,
  newItem,
  onInputChange,
  isReadOnlyFromScan,
  isFormLoading = false
}: InventoryFormModalProps) {
  // Early return to prevent any hooks from running when modal is closed
  if (!isOpen) {
    return null
  }

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [donors, setDonors] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false)
  const [showNewDonorInput, setShowNewDonorInput] = useState(false)
  const loadSuppliersRef = useRef<AbortController | null>(null)
  
  // Reset input modes when modal opens and set default itemSource
  useEffect(() => {
    if (isOpen) {
      setShowNewSupplierInput(false)
      setShowNewDonorInput(false)
      // Set default itemSource to 'purchased' if not already set
      if (!newItem.itemSource) {
        handleInputChange('itemSource', 'purchased')
      }
    }
  }, [isOpen])
  
  // Check if current supplier/donor value is not in the list - show text input
  useEffect(() => {
    if (isOpen && newItem.supplier) {
      const isPurchased = newItem.itemSource === 'purchased' || !newItem.itemSource
      if (isPurchased && suppliers.length > 0) {
        const supplierExists = suppliers.some(s => s.supplier_name.toLowerCase() === newItem.supplier.toLowerCase())
        if (!supplierExists && !showNewSupplierInput) {
          setShowNewSupplierInput(true)
        } else if (supplierExists && showNewSupplierInput) {
          setShowNewSupplierInput(false)
        }
      } else if (!isPurchased && donors.length > 0) {
        const donorExists = donors.some(d => d.supplier_name.toLowerCase() === newItem.supplier.toLowerCase())
        if (!donorExists && !showNewDonorInput) {
          setShowNewDonorInput(true)
        } else if (donorExists && showNewDonorInput) {
          setShowNewDonorInput(false)
        }
      }
    }
  }, [isOpen, newItem.supplier, newItem.itemSource, suppliers, donors, showNewSupplierInput, showNewDonorInput])
  
  // Handle input change (no auto-save to history - only save on successful submit)
  const handleInputChange = (field: string, value: any) => {
    onInputChange(field, value)
  }

  // Define loadSuppliers BEFORE it's used in useEffect hooks
  const loadSuppliers = useCallback(async () => {
    // Cancel any previous request
    if (loadSuppliersRef.current) {
      loadSuppliersRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    loadSuppliersRef.current = abortController

    try {
      setLoadingSuppliers(true)
      
      const token = localStorage.getItem('api_token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      // Fetch from both endpoints separately
      const [suppliersResponse, donorsResponse] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/suppliers/active`, {
          method: 'GET',
          headers: headers,
          signal: abortController.signal
        }),
        fetch(`${getApiBaseUrl()}/api/donors/active`, {
          method: 'GET',
          headers: headers,
          signal: abortController.signal
        })
      ])
      
      // Check if request was aborted
      if (abortController.signal.aborted) {
        return
      }
      
      // Process suppliers
      if (suppliersResponse.ok) {
        const suppliersData = await suppliersResponse.json()
        const supplierList = Array.isArray(suppliersData) ? suppliersData : []
        setSuppliers(supplierList)
        console.log('✅ Suppliers loaded:', supplierList.length, supplierList.map((s: Supplier) => s.supplier_name))
      } else {
        setSuppliers([])
      }
      
      // Process donors
      if (donorsResponse.ok) {
        const donorsData = await donorsResponse.json()
        const donorList = Array.isArray(donorsData) ? donorsData : []
        setDonors(donorList)
        console.log('🎁 Donors loaded:', donorList.length, donorList.map((d: Supplier) => d.supplier_name))
      } else {
        setDonors([])
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      setSuppliers([]) // Reset to empty array on error
      setDonors([])
    } finally {
      // Only update loading state if request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoadingSuppliers(false)
        loadSuppliersRef.current = null
      }
    }
  }, [])

  // Fetch active suppliers when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSuppliers()
    }
    
    // Cleanup: cancel any pending requests when modal closes
    return () => {
      if (loadSuppliersRef.current) {
        loadSuppliersRef.current.abort()
        loadSuppliersRef.current = null
      }
    }
  }, [isOpen, loadSuppliers])

  // Refresh suppliers when window regains focus (user returns from Suppliers page)
  useEffect(() => {
    let focusTimeoutId: NodeJS.Timeout | null = null
    let visibilityTimeoutId: NodeJS.Timeout | null = null

    const handleFocus = () => {
      // Clear any pending timeout
      if (focusTimeoutId) {
        clearTimeout(focusTimeoutId)
      }
      // Debounce: only refresh after a short delay
      focusTimeoutId = setTimeout(() => {
        loadSuppliers()
      }, 100)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear any pending timeout
        if (visibilityTimeoutId) {
          clearTimeout(visibilityTimeoutId)
        }
        // Debounce visibility change refresh
        visibilityTimeoutId = setTimeout(() => {
          loadSuppliers()
        }, 100)
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (focusTimeoutId) clearTimeout(focusTimeoutId)
      if (visibilityTimeoutId) clearTimeout(visibilityTimeoutId)
    }
  }, [loadSuppliers])

  // Also check for supplier added flag in sessionStorage
  useEffect(() => {
    const supplierAdded = sessionStorage.getItem('supplierAdded')
    const returnToInventory = sessionStorage.getItem('returnToInventory')
    if (supplierAdded === 'true' || returnToInventory === 'true') {
      // Small delay to ensure backend has processed the new supplier/donor
      setTimeout(() => {
        loadSuppliers()
      }, 300)
      sessionStorage.removeItem('supplierAdded')
      sessionStorage.removeItem('returnToInventory')
    }
  }, [loadSuppliers])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newItem.name || !newItem.category || !newItem.location || !newItem.quantity || !newItem.available) {
      showNotification('Please fill in all required fields (Name, Category, Location, Quantity, Available)', 'error')
      return
    }

    // Auto-detect itemSource from supplier selection if not explicitly set
    let detectedItemSource = newItem.itemSource
    if (!detectedItemSource && newItem.supplier) {
      // Check if supplier is in suppliers list (purchased) or donors list (donated)
      const isSupplier = suppliers.some(s => s.supplier_name.toLowerCase() === newItem.supplier.toLowerCase())
      const isDonor = donors.some(d => d.supplier_name.toLowerCase() === newItem.supplier.toLowerCase())
      
      if (isSupplier) {
        detectedItemSource = 'purchased'
      } else if (isDonor) {
        detectedItemSource = 'donated'
      } else {
        // New supplier/donor being added - default to purchased if not set
        detectedItemSource = 'purchased'
      }
    } else if (!detectedItemSource) {
      // Default to purchased if nothing is selected
      detectedItemSource = 'purchased'
    }

    // Validate Item Source
    if (!detectedItemSource) {
      showNotification('Please select an item source (Purchased or Donated)', 'error')
      return
    }

    // Validate Purchased items
    if (detectedItemSource === 'purchased') {
      if (!newItem.supplier) {
        showNotification('Please select a supplier for purchased items', 'error')
        return
      }
      if (!newItem.purchasePrice || parseFloat(newItem.purchasePrice) <= 0) {
        showNotification('Purchase price is required for purchased items', 'error')
        return
      }
    }

    // Validate Donated items
    if (detectedItemSource === 'donated') {
      if (!newItem.supplier) {
        showNotification('Please select a donor for donated items', 'error')
        return
      }
      // Clear purchase price and date for donated items
      if (newItem.purchasePrice) {
        onInputChange('purchasePrice', '')
      }
      if (newItem.purchaseDate) {
        onInputChange('purchaseDate', '')
      }
    }
    
    // Update itemSource in newItem if it was auto-detected
    if (detectedItemSource !== newItem.itemSource) {
      handleInputChange('itemSource', detectedItemSource)
    }
    
    // Save to history before submitting (only for text fields that have values)
    if (newItem.location && newItem.location.trim()) {
      saveToHistory('location', newItem.location)
    }
    if (newItem.description && newItem.description.trim()) {
      saveToHistory('description', newItem.description)
    }
    if (newItem.secondary_category && newItem.secondary_category.trim()) {
      saveToHistory('secondary_category', newItem.secondary_category)
    }
    
    onSubmit(newItem)
  }
  
  const handleClose = () => {
    onClose()
  }

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinning {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
      <div 
       className="inventory-form-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div 
        className="inventory-form-modal-content"
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Screen */}
        {isFormLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: '8px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #16a34a',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: '500',
                color: '#495057',
                textAlign: 'center'
              }}>
                <div>Closing QR Scanner...</div>
                <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.5rem' }}>
                  Please wait while we prepare the form
                </div>
              </div>
            </div>
          </div>
        )}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h5 style={{ margin: 0, fontWeight: 'bold' }}>
            {scannedData ? 'Add Scanned Item' : 'Add Inventory Item'}
          </h5>
                     <button 
             type="button" 
             onClick={handleClose}
             style={{
               background: 'none',
               border: 'none',
               fontSize: '1.5rem',
               cursor: 'pointer',
               padding: '0',
               width: '30px',
               height: '30px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center'
             }}
           >
             ×
           </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1rem' }}>
            {scannedData && (
              <div style={{
                backgroundColor: '#d4edda',
                color: '#155724',
                padding: '0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>✓</span>
                <span>QR code scanned successfully! Please review and complete the item details.</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Item Name *
                </label>
                <input 
                  type="text" 
                  value={newItem.name || ''}
                  onChange={(e) => onInputChange('name', e.target.value)}
                  disabled={isReadOnlyFromScan}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#ffffff',
                    color: '#212529'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Category *
                </label>
                <select 
                  value={newItem.category || ''}
                  onChange={(e) => {
                    handleInputChange('category', e.target.value)
                    // Reset secondary category if it matches the new primary category
                    if (newItem.secondary_category === e.target.value) {
                      handleInputChange('secondary_category', '')
                    }
                  }}
                  disabled={isReadOnlyFromScan}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#ffffff',
                    color: '#212529'
                  }}
                >
                  <option value="">Select category</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Tools">Tools</option>
                  <option value="Books">Books</option>
                  <option value="Sports Equipment">Sports Equipment</option>
                  <option value="Laboratory Equipment">Laboratory Equipment</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Secondary Category (Optional)
                </label>
                <AutocompleteInput
                  value={newItem.secondary_category || ''}
                  onChange={(value) => {
                    // Prevent selecting the same category as primary
                    if (value === newItem.category) {
                      showNotification('Secondary category must be different from primary category', 'error')
                      return
                    }
                    handleInputChange('secondary_category', value)
                  }}
                  fieldName="secondary_category"
                  placeholder="Type secondary category (e.g., Other, Office Supplies)"
                  disabled={isReadOnlyFromScan || !newItem.category}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: !newItem.category ? '#f8f9fa' : '#ffffff',
                    color: '#212529'
                  }}
                />
                <small style={{ 
                  display: 'block', 
                  marginTop: '0.25rem', 
                  fontSize: '0.75rem', 
                  color: '#6c757d',
                  fontStyle: 'italic'
                }}>
                  Used as an alternative category for easier searching
                </small>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Quantity *
                </label>
                <input 
                  type="number" 
                  min="1"
                  value={newItem.quantity || ''}
                  onChange={(e) => onInputChange('quantity', e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#ffffff',
                    color: '#212529'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Available
                </label>
                <input 
                  type="number" 
                  min="0"
                  max={newItem.quantity || 1}
                  value={newItem.available || ''}
                  onChange={(e) => onInputChange('available', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#ffffff',
                    color: '#212529'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Location *
                </label>
                <AutocompleteInput
                  value={newItem.location || ''}
                  onChange={(value) => handleInputChange('location', value)}
                  fieldName="location"
                  placeholder="Enter location"
                  disabled={isReadOnlyFromScan}
                  required
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#ffffff',
                    color: '#212529'
                  }}
                />
              </div>

              {/* Serial Numbers Input - Only show for Electronics category and non-consumable items */}
              {newItem.category === 'Electronics' && !newItem.consumable && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Serial Numbers (Optional - One per line or comma-separated)
                    <small style={{ 
                      display: 'block', 
                      marginTop: '0.25rem', 
                      fontSize: '0.75rem', 
                      color: '#6c757d',
                      fontWeight: 'normal'
                    }}>
                      {newItem.quantity && parseInt(newItem.quantity) > 1 
                        ? `Enter ${newItem.quantity} serial numbers (one per line or comma-separated). Leave empty to auto-generate.`
                        : 'Enter a serial number. Leave empty to auto-generate.'}
                    </small>
                  </label>
                  <textarea 
                    value={newItem.serialNumbers || ''}
                    onChange={(e) => onInputChange('serialNumbers', e.target.value)}
                    placeholder={newItem.quantity && parseInt(newItem.quantity) > 1 
                      ? `Enter ${newItem.quantity} serial numbers, one per line:\nSN001\nSN002\nSN003\n...`
                      : 'Enter serial number or leave empty to auto-generate'}
                    rows={newItem.quantity && parseInt(newItem.quantity) > 1 ? Math.min(parseInt(newItem.quantity), 10) : 3}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      backgroundColor: '#ffffff',
                      color: '#212529',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}

              {/* Item Source Section */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Item Source <span className="text-danger">*</span>
                </label>
                <select
                  value={newItem.itemSource || 'purchased'}
                  onChange={(e) => {
                    handleInputChange('itemSource', e.target.value)
                    // Clear supplier/donor when switching source type
                    handleInputChange('supplier', '')
                    // Reset input modes
                    setShowNewSupplierInput(false)
                    setShowNewDonorInput(false)
                    // Clear purchase price and date if switching to donated
                    if (e.target.value === 'donated') {
                      handleInputChange('purchasePrice', '')
                      handleInputChange('purchaseDate', '')
                    }
                  }}
                  disabled={isSubmitting}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#ffffff',
                    color: '#212529',
                    marginBottom: '1rem'
                  }}
                >
                  <option value="purchased">Purchased (Supplier)</option>
                  <option value="donated">Donated (Donor)</option>
                </select>

                {/* Supplier Dropdown - Show when Purchased */}
                {(newItem.itemSource === 'purchased' || !newItem.itemSource) && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Supplier <span className="text-danger">*</span>
                      {loadingSuppliers && (
                        <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6c757d' }}>
                          (Loading...)
                        </span>
                      )}
                    </label>
                    {!showNewSupplierInput ? (
                      <select
                        value={newItem.supplier && suppliers.some(s => s.supplier_name.toLowerCase() === newItem.supplier.toLowerCase()) ? newItem.supplier : ''}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '__add_new__') {
                            setShowNewSupplierInput(true)
                            handleInputChange('supplier', '')
                          } else {
                            handleInputChange('supplier', value)
                            // Auto-detect and set itemSource to 'purchased' when supplier is selected
                            if (value && value.trim()) {
                              handleInputChange('itemSource', 'purchased')
                            }
                          }
                        }}
                        disabled={isSubmitting || loadingSuppliers}
                        required
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '1rem',
                          backgroundColor: loadingSuppliers ? '#f8f9fa' : '#ffffff',
                          color: '#212529'
                        }}
                      >
                        <option value="">Select supplier</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.supplier_name}>
                            {supplier.company_name 
                              ? `${supplier.supplier_name} (${supplier.company_name})` 
                              : supplier.supplier_name}
                          </option>
                        ))}
                        <option value="__add_new__" style={{ fontStyle: 'italic', color: '#16a34a' }}>
                          + Add New Supplier
                        </option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={newItem.supplier || ''}
                          onChange={(e) => {
                            handleInputChange('supplier', e.target.value)
                            // Auto-set itemSource to 'purchased' when typing new supplier name
                            if (e.target.value && e.target.value.trim() && !newItem.itemSource) {
                              handleInputChange('itemSource', 'purchased')
                            }
                          }}
                          placeholder="Enter new supplier name"
                          disabled={isSubmitting}
                          required
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            backgroundColor: '#ffffff',
                            color: '#212529'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewSupplierInput(false)
                            if (!newItem.supplier || !newItem.supplier.trim()) {
                              handleInputChange('supplier', '')
                            }
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            backgroundColor: '#f8f9fa',
                            color: '#212529',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    <small style={{ color: '#6c757d', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      {newItem.supplier && !suppliers.some(s => s.supplier_name.toLowerCase() === newItem.supplier.toLowerCase()) ? (
                        <span style={{ color: '#16a34a' }}>
                          ✓ New supplier "{newItem.supplier}" will be created automatically
                        </span>
                      ) : suppliers.length > 0 ? (
                        `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''} available. Select "Add New Supplier" to create one.`
                      ) : (
                        'Select "Add New Supplier" to create a new supplier'
                      )}
                    </small>
                  </div>
                )}

                {/* Donor Dropdown - Show when Donated */}
                {newItem.itemSource === 'donated' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Donor <span className="text-danger">*</span>
                      {loadingSuppliers && (
                        <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6c757d' }}>
                          (Loading...)
                        </span>
                      )}
                    </label>
                    {!showNewDonorInput ? (
                      <select
                        value={newItem.supplier && donors.some(d => d.supplier_name.toLowerCase() === newItem.supplier.toLowerCase()) ? newItem.supplier : ''}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value === '__add_new__') {
                            setShowNewDonorInput(true)
                            handleInputChange('supplier', '')
                          } else {
                            handleInputChange('supplier', value)
                            // Auto-detect and set itemSource to 'donated' when donor is selected
                            if (value && value.trim()) {
                              handleInputChange('itemSource', 'donated')
                            }
                          }
                        }}
                        disabled={isSubmitting || loadingSuppliers}
                        required
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '1rem',
                          backgroundColor: loadingSuppliers ? '#f8f9fa' : '#ffffff',
                          color: '#212529'
                        }}
                      >
                        <option value="">Select donor</option>
                        {donors.map((donor) => (
                          <option key={donor.id} value={donor.supplier_name}>
                            {donor.company_name 
                              ? `${donor.supplier_name} (${donor.company_name})` 
                              : donor.supplier_name}
                          </option>
                        ))}
                        <option value="__add_new__" style={{ fontStyle: 'italic', color: '#16a34a' }}>
                          + Add New Donor
                        </option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={newItem.supplier || ''}
                          onChange={(e) => {
                            handleInputChange('supplier', e.target.value)
                            // Auto-set itemSource to 'donated' when typing new donor name
                            if (e.target.value && e.target.value.trim()) {
                              handleInputChange('itemSource', 'donated')
                            }
                          }}
                          placeholder="Enter new donor name"
                          disabled={isSubmitting}
                          required
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            backgroundColor: '#ffffff',
                            color: '#212529'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewDonorInput(false)
                            if (!newItem.supplier || !newItem.supplier.trim()) {
                              handleInputChange('supplier', '')
                            }
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            backgroundColor: '#f8f9fa',
                            color: '#212529',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    <small style={{ color: '#6c757d', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      {newItem.supplier && !donors.some(d => d.supplier_name.toLowerCase() === newItem.supplier.toLowerCase()) ? (
                        <span style={{ color: '#16a34a' }}>
                          ✓ New donor "{newItem.supplier}" will be created automatically
                        </span>
                      ) : donors.length > 0 ? (
                        `${donors.length} donor${donors.length !== 1 ? 's' : ''} available. Select "Add New Donor" to create one.`
                      ) : (
                        'Select "Add New Donor" to create a new donor'
                      )}
                    </small>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Purchase Price
                  {(newItem.itemSource === 'purchased' || !newItem.itemSource) && (
                    <span className="text-danger"> *</span>
                  )}
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={newItem.purchasePrice || ''}
                  onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
                  disabled={newItem.itemSource === 'donated' || isSubmitting}
                  required={newItem.itemSource === 'purchased' || !newItem.itemSource}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: newItem.itemSource === 'donated' ? '#e9ecef' : '#ffffff',
                    color: '#212529',
                    cursor: newItem.itemSource === 'donated' ? 'not-allowed' : 'text'
                  }}
                />
                {newItem.itemSource === 'donated' && (
                  <small style={{ 
                    display: 'block', 
                    marginTop: '0.25rem', 
                    fontSize: '0.75rem', 
                    color: '#6c757d',
                    fontStyle: 'italic'
                  }}>
                    Purchase price is not applicable for donated items
                  </small>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Purchase Date
                </label>
                <input 
                  type="date" 
                  value={newItem.purchaseDate || ''}
                  onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                  disabled={newItem.itemSource === 'donated' || isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: newItem.itemSource === 'donated' ? '#e9ecef' : '#ffffff',
                    color: '#212529',
                    cursor: newItem.itemSource === 'donated' ? 'not-allowed' : 'text'
                  }}
                />
                {newItem.itemSource === 'donated' && (
                  <small style={{ 
                    display: 'block', 
                    marginTop: '0.25rem', 
                    fontSize: '0.75rem', 
                    color: '#6c757d',
                    fontStyle: 'italic'
                  }}>
                    Purchase date is not applicable for donated items
                  </small>
                )}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Item Type
                </label>
                <select
                  value={newItem.consumable === true ? 'consumable' : newItem.consumable === false ? 'reusable' : 'reusable'}
                  onChange={(e) => handleInputChange('consumable', e.target.value === 'consumable')}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#ffffff',
                    color: '#212529'
                  }}
                >
                  <option value="reusable">Reusable</option>
                  <option value="consumable">Consumable</option>
                </select>
                <small style={{ 
                  display: 'block', 
                  marginTop: '0.25rem', 
                  fontSize: '0.75rem', 
                  color: '#6c757d',
                  fontStyle: 'italic'
                }}>
                  Consumable items will be removed from inventory when approved for a request. Reusable items can be returned.
                </small>
              </div>

            <div style={{ gridColumn: '1 / -1' }}>
              {/* Item Photo Section - Title above two columns */}
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Item Photo
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr', // 2 columns: description and photo
                gap: '1rem',
                alignItems: 'start'
              }}>
                {/* Description/Comment Area - Left Side (Wider) */}
                <div className="item-description-area" style={{
                  border: '2px solid #ced4da',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  padding: '1rem',
                  height: '160px',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <label style={{ marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    Description
                  </label>
                  <textarea
                    value={newItem.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter additional description or comments..."
                    onBlur={(e) => {
                      // Save to history when user finishes typing
                      if (e.target.value && e.target.value.trim()) {
                        saveToHistory('description', e.target.value)
                      }
                    }}
                    style={{
                      flex: 1,
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      resize: 'none',
                      backgroundColor: '#ffffff',
                      color: '#212529'
                    }}
                  />
                </div>

                {/* Photo Upload Area - Middle */}
                <div className="item-photo-upload-area" style={{
                  border: '2px dashed #ced4da',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  height: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  if (document.documentElement.classList.contains('dark-theme')) {
                    e.currentTarget.style.borderColor = '#22c55e'
                    e.currentTarget.style.backgroundColor = '#14532d'
                  } else {
                    e.currentTarget.style.borderColor = '#16a34a'
                    e.currentTarget.style.backgroundColor = '#dcfce7'
                  }
                }}
                onMouseLeave={(e) => {
                  if (document.documentElement.classList.contains('dark-theme')) {
                    e.currentTarget.style.borderColor = '#334155'
                    e.currentTarget.style.backgroundColor = '#0f172a'
                  } else {
                    e.currentTarget.style.borderColor = '#ced4da'
                    e.currentTarget.style.backgroundColor = '#f8f9fa'
                  }
                }}
                onClick={() => document.getElementById('item-photo-upload')?.click()}
                >
                  {newItem.photo ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <img
                        src={newItem.photo}
                        alt="Item preview"
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '4px',
                          objectFit: 'cover'
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onInputChange('photo', '')
                        }}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div>
                      <i className="bi bi-camera" style={{ fontSize: '1.5rem', color: '#6c757d', marginBottom: '0.5rem' }}></i>
                      <p style={{ margin: '0.25rem 0', color: '#6c757d', fontSize: '0.8rem' }}>Click to upload</p>
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#adb5bd' }}>JPG, PNG up to 5MB</p>
                    </div>
                  )}
                </div>

              </div>

                {/* Keep serial number in state but hide the field */}
                <input type="hidden" value={newItem.serialNumber || ''} readOnly />
                <input
                  id="item-photo-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        showNotification('File size must be less than 5MB', 'error')
                        return
                      }
                      const reader = new FileReader()
                      reader.onload = (e) => {
                        onInputChange('photo', e.target?.result)
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{
            padding: '1rem',
            borderTop: '1px solid #dee2e6',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem'
          }}>
                     <button 
               type="button" 
               onClick={handleClose}
               style={{
                 padding: '0.5rem 1rem',
                 border: '1px solid #6c757d',
                 backgroundColor: '#6c757d',
                 color: 'white',
                 borderRadius: '4px',
                 cursor: 'pointer',
                 fontSize: '1rem'
               }}
             >
               Cancel
             </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #16a34a',
                backgroundColor: '#16a34a',
                color: 'white',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: isSubmitting ? 0.6 : 1
              }}
            >
              {isSubmitting ? 'Adding Item...' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
