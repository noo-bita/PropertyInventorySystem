import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { showNotification } from '../utils/notifications'
import { getApiBaseUrl, apiFetch } from '../utils/api'
import ConfirmationModal from './ConfirmationModal'
import AutocompleteInput from './AutocompleteInput'

interface Supplier {
  id: number
  supplier_name: string
  company_name: string | null
  type?: 'supplier' | 'donor'
}

// Damage History Component
const DamageHistorySection = ({ itemId }: { itemId?: number }) => {
  const [damageHistory, setDamageHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!itemId) {
      setLoading(false)
      return
    }

    const loadDamageHistory = async () => {
      try {
        const response = await apiFetch(`/api/requests`)
        if (response.ok) {
          const allRequests = await response.json()
          // Filter for damage-related requests for this item
          const damageRequests = allRequests.filter((req: any) => 
            req.item_id === itemId && (
              req.inspection_status === 'damaged' || 
              (req.inspection_status === 'accepted' && req.notes?.includes('[DAMAGED]')) ||
              (req.status === 'returned' && (req.inspection_status === 'damaged' || req.notes?.includes('[DAMAGED]')))
            )
          )
          setDamageHistory(damageRequests)
        }
      } catch (error) {
        console.error('Error loading damage history:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDamageHistory()
  }, [itemId])

  if (loading) {
    return <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>Loading damage history...</div>
  }

  if (damageHistory.length === 0) {
    return <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>No damage history recorded for this item.</div>
  }

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {damageHistory.map((req: any) => (
        <div 
          key={req.id} 
          style={{
            padding: '0.75rem',
            marginBottom: '0.75rem',
            backgroundColor: '#f9fafb',
            borderLeft: '3px solid #dc2626',
            borderRadius: '4px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <strong style={{ color: '#374151' }}>{new Date(req.inspected_at || req.returned_at || req.created_at).toLocaleDateString()}</strong>
            <span className={`badge ${req.inspection_status === 'damaged' ? 'bg-danger' : 'bg-success'}`} style={{ fontSize: '0.75rem' }}>
              {req.inspection_status === 'damaged' ? 'REJECTED' : 'APPROVED'}
            </span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
            <strong>Teacher:</strong> {req.teacher_name}
          </div>
          {req.notes && (
            <div style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.5rem', fontStyle: 'italic' }}>
              {req.notes.replace('[DAMAGED]', '').trim().substring(0, 150)}
              {req.notes.length > 150 ? '...' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface ItemDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  existingItem: any
  scannedQRData?: string // Add this to pass the scanned QR data
  isEditMode?: boolean
  onEdit?: () => void
  onSave?: (itemData: any) => void
  isSubmitting?: boolean
  onCancelEdit?: () => void
}

export default function ItemDetailsModal({
  isOpen,
  onClose,
  existingItem,
  isEditMode = false,
  onEdit,
  onSave,
  isSubmitting = false
}: ItemDetailsModalProps) {
  
  // Confirmation modal state for mark as repaired
  const [showRepairConfirm, setShowRepairConfirm] = useState(false)
  const [isMarkingRepaired, setIsMarkingRepaired] = useState(false)
  
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [donors, setDonors] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false)
  const [showNewDonorInput, setShowNewDonorInput] = useState(false)
  const loadSuppliersRef = useRef<AbortController | null>(null)
  
  const [editForm, setEditForm] = useState({
    name: existingItem?.name || '',
    category: existingItem?.category || '',
    secondary_category: existingItem?.secondary_category || '',
    quantity: existingItem?.quantity || '',
    available: existingItem?.available || '',
    location: existingItem?.location || '',
    description: existingItem?.description || '',
    serialNumber: existingItem?.serial_number || '',
    purchaseDate: existingItem?.purchase_date ? existingItem.purchase_date.split('T')[0] : '',
    purchasePrice: existingItem?.purchase_price || '',
    purchaseType: existingItem?.purchase_type || 'purchased',
    supplier: existingItem?.supplier || '',
    addedBy: existingItem?.added_by || '',
    status: existingItem?.status || 'Available',
    photo: existingItem?.photo || ''
  })

  // Update form when existingItem changes or when entering edit mode
  useEffect(() => {
    if (existingItem) {
      setEditForm({
        name: existingItem.name || '',
        category: existingItem.category || '',
        secondary_category: existingItem.secondary_category || '',
        quantity: existingItem.quantity || '',
        available: existingItem.available || '',
        location: existingItem.location || '',
        description: existingItem.description || '',
        serialNumber: existingItem.serial_number || '',
        purchaseDate: existingItem.purchase_date ? existingItem.purchase_date.split('T')[0] : '',
        purchasePrice: existingItem.purchase_price || '',
        purchaseType: existingItem.purchase_type || 'purchased',
        supplier: existingItem.supplier || '',
        addedBy: existingItem.added_by || '',
        status: existingItem.status || 'Available',
        photo: existingItem.photo || ''
      })
    }
  }, [existingItem])

  // Initialize form when entering edit mode
  useEffect(() => {
    if (isEditMode && existingItem) {
      const formData = {
        name: existingItem.name || '',
        category: existingItem.category || '',
        secondary_category: existingItem.secondary_category || '',
        quantity: existingItem.quantity || '',
        available: existingItem.available || '',
        location: existingItem.location || '',
        description: existingItem.description || '',
        serialNumber: existingItem.serial_number || '',
        purchaseDate: existingItem.purchase_date ? existingItem.purchase_date.split('T')[0] : '',
        purchasePrice: existingItem.purchase_price || '',
        purchaseType: existingItem.purchase_type || 'purchased',
        supplier: existingItem.supplier || '',
        addedBy: existingItem.added_by || '',
        status: existingItem.status || 'Available',
        photo: existingItem.photo || ''
      }
      setEditForm(formData)
    }
  }, [isEditMode, existingItem])

  // Load suppliers and donors
  const loadSuppliers = useCallback(async () => {
    if (loadSuppliersRef.current) {
      loadSuppliersRef.current.abort()
    }

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
      
      if (abortController.signal.aborted) {
        return
      }
      
      if (suppliersResponse.ok) {
        const suppliersData = await suppliersResponse.json()
        const supplierList = Array.isArray(suppliersData) ? suppliersData : []
        setSuppliers(supplierList)
      } else {
        setSuppliers([])
      }
      
      if (donorsResponse.ok) {
        const donorsData = await donorsResponse.json()
        const donorList = Array.isArray(donorsData) ? donorsData : []
        setDonors(donorList)
      } else {
        setDonors([])
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      setSuppliers([])
      setDonors([])
    } finally {
      if (!abortController.signal.aborted) {
        setLoadingSuppliers(false)
        loadSuppliersRef.current = null
      }
    }
  }, [])

  // Fetch suppliers when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSuppliers()
    }
    
    return () => {
      if (loadSuppliersRef.current) {
        loadSuppliersRef.current.abort()
        loadSuppliersRef.current = null
      }
    }
  }, [isOpen, loadSuppliers])

  // Reset input modes when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowNewSupplierInput(false)
      setShowNewDonorInput(false)
    }
  }, [isOpen])

  // Check if current supplier/donor value is not in the list - show text input
  useEffect(() => {
    if (isOpen && isEditMode && editForm.supplier) {
      const isPurchased = editForm.purchaseType === 'purchased' || !editForm.purchaseType
      if (isPurchased && suppliers.length > 0) {
        const supplierExists = suppliers.some(s => s.supplier_name.toLowerCase() === editForm.supplier.toLowerCase())
        if (!supplierExists && !showNewSupplierInput) {
          setShowNewSupplierInput(true)
        } else if (supplierExists && showNewSupplierInput) {
          setShowNewSupplierInput(false)
        }
      } else if (!isPurchased && donors.length > 0) {
        const donorExists = donors.some(d => d.supplier_name.toLowerCase() === editForm.supplier.toLowerCase())
        if (!donorExists && !showNewDonorInput) {
          setShowNewDonorInput(true)
        } else if (donorExists && showNewDonorInput) {
          setShowNewDonorInput(false)
        }
      }
    }
  }, [isOpen, isEditMode, editForm.supplier, editForm.purchaseType, suppliers, donors, showNewSupplierInput, showNewDonorInput])

  const handleInputChange = (field: string, value: any) => {
    setEditForm((prev: any) => ({
      ...prev,
      [field]: value
    }))
  }

  const confirmMarkRepaired = async () => {
    if (!existingItem) return
    
    setIsMarkingRepaired(true)
    try {
      const response = await apiFetch(`/api/inventory/${existingItem.id}/mark-repaired`, {
        method: 'POST'
      })
      
      if (response.ok) {
        showNotification('Item marked as repaired and available!', 'success')
        handleInputChange('status', 'Available')
        setShowRepairConfirm(false)
        if (onSave) {
          onSave({ ...editForm, status: 'Available' })
        }
      } else {
        const error = await response.json()
        showNotification(error.message || 'Failed to mark item as repaired', 'error')
      }
    } catch (error) {
      showNotification('Error marking item as repaired', 'error')
    } finally {
      setIsMarkingRepaired(false)
    }
  }

  const handleSave = () => {
    if (onSave) {
      // Ensure all required fields have values, using original values if not changed
      const completeFormData = {
        name: editForm.name || existingItem.name || '',
        category: editForm.category || existingItem.category || '',
        secondary_category: editForm.secondary_category || existingItem.secondary_category || null,
        quantity: editForm.quantity || existingItem.quantity || '',
        available: editForm.available || existingItem.available || '',
        location: editForm.location || existingItem.location || '',
        description: editForm.description || existingItem.description || '',
        serialNumber: editForm.serialNumber || existingItem.serialNumber || '',
        purchaseDate: editForm.purchaseDate || existingItem.purchaseDate || '',
        purchasePrice: editForm.purchasePrice || existingItem.purchasePrice || '',
        purchaseType: editForm.purchaseType || existingItem.purchaseType || 'purchased',
        supplier: editForm.supplier || existingItem.supplier || '',
        addedBy: editForm.addedBy || existingItem.addedBy || '',
        status: editForm.status || existingItem.status || 'Available',
        photo: editForm.photo || existingItem.photo || ''
      }
      
      onSave(completeFormData)
    }
  }
  
  if (!isOpen || !existingItem) return null

     return (
     <>
       <style>
         {`
           .edit-input::placeholder {
             color: #6c757d !important;
             opacity: 1 !important;
           }
           .edit-input::-webkit-input-placeholder {
             color: #6c757d !important;
             opacity: 1 !important;
           }
           .edit-input::-moz-placeholder {
             color: #6c757d !important;
             opacity: 1 !important;
           }
           .edit-input:-ms-input-placeholder {
             color: #6c757d !important;
             opacity: 1 !important;
           }
           .edit-input {
             color: #495057 !important;
           }
           .item-details-modal input, 
           .item-details-modal select, 
           .item-details-modal textarea {
             color: #495057 !important;
           }
           .item-details-modal input:disabled, 
           .item-details-modal select:disabled, 
           .item-details-modal textarea:disabled {
             color: #6c757d !important;
           }
           /* Fix select dropdown text display - ensure full text is visible */
           .item-details-modal select {
             appearance: none !important;
             -webkit-appearance: none !important;
             -moz-appearance: none !important;
             background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E") !important;
             background-repeat: no-repeat !important;
             background-position: right 0.75rem center !important;
             background-size: 12px !important;
             text-overflow: clip !important;
             overflow: visible !important;
             white-space: nowrap !important;
             width: 100% !important;
             box-sizing: border-box !important;
           }
           .item-details-modal select option {
             white-space: normal !important;
             word-wrap: break-word !important;
             padding: 0.5rem !important;
           }
         `}
       </style>
       <div 
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
         className="item-details-modal"
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
                 <div style={{
           padding: '1rem',
           borderBottom: '1px solid #dee2e6',
           display: 'flex',
           justifyContent: 'space-between',
           alignItems: 'center'
         }}>
           <h5 style={{ margin: 0, fontWeight: 'bold' }}>
             {isEditMode ? 'Edit Item' : 'Item Details'}
           </h5>
           <button 
             type="button" 
             onClick={onClose}
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

        <div style={{ padding: '1rem' }}>
          {!isEditMode && (
            <div style={{
              backgroundColor: '#d1ecf1',
              color: '#0c5460',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>ℹ</span>
              <span>This item already exists in the system.</span>
            </div>
          )}

                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Item Name
              </label>
                                                           <input 
                  type="text" 
                  value={isEditMode ? editForm.name : (existingItem.name || '')}
                  onChange={(e) => isEditMode && handleInputChange('name', e.target.value)}
                  disabled={!isEditMode}
                  placeholder={isEditMode ? `Original: ${existingItem.name || 'Not specified'}` : ''}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: isEditMode ? 'white' : '#f8f9fa'
                  }}
                  className={isEditMode ? 'edit-input' : ''}
                />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Category
              </label>
              {isEditMode ? (
                <select
                  value={editForm.category || existingItem.category || ''}
                  onChange={(e) => {
                      handleInputChange('category', e.target.value)
                      // Reset secondary category if it matches the new primary category
                      if (editForm.secondary_category === e.target.value) {
                        handleInputChange('secondary_category', '')
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: 'white',
                    color: '#495057'
                  }}
                  className="edit-input"
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
              ) : (
                <input 
                  type="text" 
                  value={existingItem.category || ''}
                  disabled={true}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#f8f9fa'
                  }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Secondary Category (Optional)
              </label>
              {isEditMode ? (
                <>
                  <AutocompleteInput
                    value={editForm.secondary_category || ''}
                    onChange={(value) => {
                    // Prevent selecting the same category as primary
                      if (value === editForm.category) {
                      showNotification('Secondary category must be different from primary category', 'error')
                      return
                    }
                      handleInputChange('secondary_category', value)
                }}
                    fieldName="secondary_category"
                    placeholder="Type secondary category (e.g., Other, Office Supplies)"
                    disabled={!editForm.category}
                    className="edit-input"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                      backgroundColor: !editForm.category ? '#f8f9fa' : '#ffffff',
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
                </>
              ) : (
                <input 
                  type="text" 
                  value={existingItem.secondary_category || ''}
                  disabled={true}
                  placeholder="None"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#f8f9fa'
                  }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Quantity
              </label>
                                                           <input 
                  type="number" 
                  value={isEditMode ? editForm.quantity : (existingItem.quantity || 0)}
                  onChange={(e) => isEditMode && handleInputChange('quantity', e.target.value)}
                  disabled={!isEditMode}
                  placeholder={isEditMode ? `Original: ${existingItem.quantity || '0'}` : ''}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: isEditMode ? 'white' : '#f8f9fa'
                  }}
                  className={isEditMode ? 'edit-input' : ''}
                />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Available
              </label>
                                                           <input 
                  type="number" 
                  value={isEditMode ? editForm.available : (existingItem.available || 0)}
                  onChange={(e) => isEditMode && handleInputChange('available', e.target.value)}
                  disabled={!isEditMode}
                  placeholder={isEditMode ? `Original: ${existingItem.available || '0'}` : ''}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: isEditMode ? 'white' : '#f8f9fa'
                  }}
                  className={isEditMode ? 'edit-input' : ''}
                />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Location
              </label>
                                                           <input 
                  type="text" 
                  value={isEditMode ? editForm.location : (existingItem.location || '')}
                  onChange={(e) => isEditMode && handleInputChange('location', e.target.value)}
                  disabled={!isEditMode}
                  placeholder={isEditMode ? `Original: ${existingItem.location || 'Not specified'}` : ''}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: isEditMode ? 'white' : '#f8f9fa'
                  }}
                  className={isEditMode ? 'edit-input' : ''}
                />
            </div>

            {(() => {
              const isConsumable = existingItem.consumable === true || existingItem.consumable === 1 || existingItem.consumable === '1' || existingItem.consumable === 'true'
              if (!isConsumable) {
                return (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Serial Number
                    </label>
                    <input 
                      type="text" 
                      value={isEditMode ? editForm.serialNumber : (existingItem.serial_number || existingItem.serialNumber || '')}
                      onChange={(e) => isEditMode && handleInputChange('serialNumber', e.target.value)}
                      disabled={!isEditMode}
                      placeholder={isEditMode ? (existingItem.serial_number || existingItem.serialNumber ? `Original: ${existingItem.serial_number || existingItem.serialNumber}` : 'Auto-generated if not provided') : 'Not specified'}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '1rem',
                        backgroundColor: isEditMode ? 'white' : '#f8f9fa'
                      }}
                      className={isEditMode ? 'edit-input' : ''}
                    />
                  </div>
                )
              }
              return null
            })()}


             {/* Item Source Section - Full Width */}
             <div style={{ gridColumn: '1 / -1' }}>
               <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                 Item Source
               </label>
               {isEditMode ? (
                 <>
                   <select
                     value={editForm.purchaseType || existingItem.purchase_type || 'purchased'}
                     onChange={(e) => {
                       handleInputChange('purchaseType', e.target.value)
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
                     style={{
                       width: '100%',
                       padding: '0.5rem',
                       border: '1px solid #ced4da',
                       borderRadius: '4px',
                       fontSize: '1rem',
                       backgroundColor: 'white',
                       color: '#212529',
                       marginBottom: '1rem'
                     }}
                     className="edit-input"
                   >
                     <option value="purchased">Purchased (Supplier)</option>
                     <option value="donated">Donated (Donor)</option>
                   </select>

                   {/* Supplier Dropdown - Show when Purchased */}
                   {(editForm.purchaseType === 'purchased' || !editForm.purchaseType) && (
                     <div>
                       <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                         Supplier
                         {loadingSuppliers && (
                           <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6c757d' }}>
                             (Loading...)
                           </span>
                         )}
                       </label>
                       {!showNewSupplierInput ? (
                         <select
                           value={editForm.supplier && suppliers.some(s => s.supplier_name.toLowerCase() === editForm.supplier.toLowerCase()) ? editForm.supplier : ''}
                           onChange={(e) => {
                             const value = e.target.value
                             if (value === '__add_new__') {
                               setShowNewSupplierInput(true)
                               handleInputChange('supplier', '')
                             } else {
                               handleInputChange('supplier', value)
                               // Auto-detect and set purchaseType to 'purchased' when supplier is selected
                               if (value && value.trim()) {
                                 handleInputChange('purchaseType', 'purchased')
                               }
                             }
                           }}
                           disabled={isSubmitting || loadingSuppliers}
                           style={{
                             width: '100%',
                             padding: '0.5rem',
                             border: '1px solid #ced4da',
                             borderRadius: '4px',
                             fontSize: '1rem',
                             backgroundColor: loadingSuppliers ? '#f8f9fa' : 'white',
                   color: '#212529'
                 }}
                           className="edit-input"
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
                             value={editForm.supplier || ''}
                             onChange={(e) => {
                               handleInputChange('supplier', e.target.value)
                               // Auto-set purchaseType to 'purchased' when typing new supplier name
                               if (e.target.value && e.target.value.trim() && !editForm.purchaseType) {
                                 handleInputChange('purchaseType', 'purchased')
                               }
                             }}
                             placeholder="Enter new supplier name"
                             disabled={isSubmitting}
                             autoFocus
                             style={{
                               flex: 1,
                               padding: '0.5rem',
                               border: '1px solid #ced4da',
                               borderRadius: '4px',
                               fontSize: '1rem',
                               backgroundColor: 'white',
                               color: '#212529'
                             }}
                             className="edit-input"
                           />
                           <button
                             type="button"
                             onClick={() => {
                               setShowNewSupplierInput(false)
                               if (!editForm.supplier || !editForm.supplier.trim()) {
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
                         {editForm.supplier && !suppliers.some(s => s.supplier_name.toLowerCase() === editForm.supplier.toLowerCase()) ? (
                           <span style={{ color: '#16a34a' }}>
                             ✓ New supplier "{editForm.supplier}" will be created automatically
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
                   {editForm.purchaseType === 'donated' && (
                     <div>
                       <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                         Donor
                         {loadingSuppliers && (
                           <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#6c757d' }}>
                             (Loading...)
                           </span>
                         )}
                       </label>
                       {!showNewDonorInput ? (
                         <select
                           value={editForm.supplier && donors.some(d => d.supplier_name.toLowerCase() === editForm.supplier.toLowerCase()) ? editForm.supplier : ''}
                           onChange={(e) => {
                             const value = e.target.value
                             if (value === '__add_new__') {
                               setShowNewDonorInput(true)
                               handleInputChange('supplier', '')
                             } else {
                               handleInputChange('supplier', value)
                               // Auto-detect and set purchaseType to 'donated' when donor is selected
                               if (value && value.trim()) {
                                 handleInputChange('purchaseType', 'donated')
                               }
                             }
                           }}
                           disabled={isSubmitting || loadingSuppliers}
                           style={{
                             width: '100%',
                             padding: '0.5rem',
                             border: '1px solid #ced4da',
                             borderRadius: '4px',
                             fontSize: '1rem',
                             backgroundColor: loadingSuppliers ? '#f8f9fa' : 'white',
                             color: '#212529'
                           }}
                           className="edit-input"
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
                             value={editForm.supplier || ''}
                             onChange={(e) => {
                               handleInputChange('supplier', e.target.value)
                               // Auto-set purchaseType to 'donated' when typing new donor name
                               if (e.target.value && e.target.value.trim()) {
                                 handleInputChange('purchaseType', 'donated')
                               }
                             }}
                             placeholder="Enter new donor name"
                             disabled={isSubmitting}
                             autoFocus
                             style={{
                               flex: 1,
                               padding: '0.5rem',
                               border: '1px solid #ced4da',
                               borderRadius: '4px',
                               fontSize: '1rem',
                               backgroundColor: 'white',
                               color: '#212529'
                             }}
                             className="edit-input"
                           />
                           <button
                             type="button"
                             onClick={() => {
                               setShowNewDonorInput(false)
                               if (!editForm.supplier || !editForm.supplier.trim()) {
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
                         {editForm.supplier && !donors.some(d => d.supplier_name.toLowerCase() === editForm.supplier.toLowerCase()) ? (
                           <span style={{ color: '#16a34a' }}>
                             ✓ New donor "{editForm.supplier}" will be created automatically
                           </span>
                         ) : donors.length > 0 ? (
                           `${donors.length} donor${donors.length !== 1 ? 's' : ''} available. Select "Add New Donor" to create one.`
                         ) : (
                           'Select "Add New Donor" to create a new donor'
                         )}
                       </small>
                     </div>
                   )}
                 </>
               ) : (
                 <input 
                   type="text" 
                   value={existingItem.purchase_type === 'donated' ? 'Donated' : 'School Purchased'}
                   disabled={true}
                   style={{
                     width: '100%',
                     padding: '0.5rem',
                     border: '1px solid #ced4da',
                     borderRadius: '4px',
                     fontSize: '1rem',
                     backgroundColor: '#f8f9fa'
                   }}
                 />
               )}
             </div>

             <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', width: '100%' }}>
               <div>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                   Purchase Price
                 </label>
                 <input 
                   type="number" 
                   step="0.01"
                   min="0"
                   value={isEditMode ? editForm.purchasePrice : (existingItem.purchasePrice || '')}
                   onChange={(e) => isEditMode && handleInputChange('purchasePrice', e.target.value)}
                   disabled={!isEditMode || (isEditMode && editForm.purchaseType === 'donated')}
                   placeholder={isEditMode ? `Original: ${existingItem.purchaseType === 'donated' ? 'N/A (Donated)' : (existingItem.purchasePrice || '0')}` : ''}
                   style={{
                     width: '100%',
                     padding: '0.5rem',
                     border: '1px solid #ced4da',
                     borderRadius: '4px',
                     fontSize: '1rem',
                     backgroundColor: (!isEditMode || (isEditMode && editForm.purchaseType === 'donated')) ? '#f8f9fa' : 'white',
                     boxSizing: 'border-box'
                   }}
                   className={isEditMode ? 'edit-input' : ''}
                 />
               </div>

               <div>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                   Purchase Date
                 </label>
                 <input 
                   type="date" 
                   value={isEditMode ? editForm.purchaseDate : (existingItem.purchaseDate || '')}
                   onChange={(e) => isEditMode && handleInputChange('purchaseDate', e.target.value)}
                   disabled={!isEditMode || (isEditMode && editForm.purchaseType === 'donated')}
                   placeholder={isEditMode ? `Original: ${existingItem.purchaseDate || 'Not specified'}` : ''}
                   style={{
                     width: '100%',
                     padding: '0.5rem',
                     border: '1px solid #ced4da',
                     borderRadius: '4px',
                     fontSize: '1rem',
                     backgroundColor: (!isEditMode || (isEditMode && editForm.purchaseType === 'donated')) ? '#f8f9fa' : 'white',
                     boxSizing: 'border-box'
                   }}
                   className={isEditMode ? 'edit-input' : ''}
                 />
                 {isEditMode && editForm.purchaseType === 'donated' && (
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

               <div style={{ minWidth: 0 }}>
                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                   Status
                 </label>
                 {isEditMode ? (
                   <select 
                     value={editForm.status || existingItem.status || 'Available'}
                     onChange={(e) => handleInputChange('status', e.target.value)}
                     style={{
                       width: '100%',
                       padding: '0.5rem 2rem 0.5rem 0.5rem',
                       border: '1px solid #ced4da',
                       borderRadius: '4px',
                       fontSize: '1rem',
                       backgroundColor: 'white',
                       color: '#495057',
                       boxSizing: 'border-box',
                       minWidth: 0
                     }}
                     className="edit-input"
                   >
                     <option value="Available">Available</option>
                     <option value="Under Maintenance">Under Maintenance</option>
                     <option value="Damaged">Damaged</option>
                   </select>
                 ) : (
                   <input 
                     type="text" 
                     value={existingItem.status || 'Available'}
                     disabled={true}
                     style={{
                       width: '100%',
                       padding: '0.5rem',
                       border: '1px solid #ced4da',
                       borderRadius: '4px',
                       fontSize: '1rem',
                       backgroundColor: '#f8f9fa',
                       boxSizing: 'border-box'
                     }}
                   />
                 )}
               </div>
             </div>


            {/* Item Photo & QR Code Section - Title above all columns */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Item Photo {(() => {
                  const isConsumable = existingItem.consumable === true || existingItem.consumable === 1 || existingItem.consumable === '1' || existingItem.consumable === 'true'
                  return !isConsumable && '& QR Code'
                })()}
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: (() => {
                  const isConsumable = existingItem.consumable === true || existingItem.consumable === 1 || existingItem.consumable === '1' || existingItem.consumable === 'true'
                  return isConsumable ? '1fr' : '1fr 1fr' // 1 column for consumable, 2 for reusable
                })(),
                gap: '1rem', 
                alignItems: 'start' 
              }}>
                {/* Left Column: Description and Photo Stacked */}
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* Description/Comment Area */}
                  <div style={{ 
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
                    {isEditMode ? (
                                                                                   <textarea
                        value={editForm.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        style={{
                          flex: 1,
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          padding: '0.5rem',
                          backgroundColor: 'white',
                          fontSize: '0.9rem',
                          resize: 'none',
                          fontFamily: 'inherit'
                        }}
                        placeholder={`Original: ${existingItem.description || 'No description available'}`}
                        className="edit-input"
                      />
                    ) : (
                      <div style={{
                        flex: 1,
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        padding: '0.5rem',
                        backgroundColor: '#f8f9fa',
                        color: '#6c757d',
                        fontSize: '0.9rem',
                        overflow: 'auto'
                      }}>
                        {existingItem.description || 'No description available'}
                      </div>
                    )}
                  </div>

                  {/* Photo Display/Upload Area */}
                  <div style={{ 
                    border: '2px solid #ced4da',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    padding: '1rem',
                    textAlign: 'center',
                    height: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                  {isEditMode ? (
                    <div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onload = (e) => {
                              const result = e.target?.result as string
                              handleInputChange('photo', result)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                        style={{ marginBottom: '0.5rem' }}
                      />
                      <p style={{ margin: '0.25rem 0', color: '#6c757d', fontSize: '0.8rem' }}>Upload new photo</p>
                    </div>
                  ) : (
                    (existingItem.photo || editForm.photo) ? (
                      <>
                        <img 
                          src={(() => {
                            const photo = existingItem.photo || editForm.photo
                            
                            // If it's a base64 string, use it directly
                            if (photo.startsWith('data:image/')) {
                              return photo
                            }
                            // If it's a file path, construct the full URL
                            if (photo && !photo.startsWith('http')) {
                              return `${getApiBaseUrl()}/${photo}`
                            }
                            // If it's already a full URL, use it
                            return photo
                          })()}
                          alt="Item photo" 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            borderRadius: '4px',
                            objectFit: 'cover'
                          }} 
                          onError={(e) => {
                            console.error('Image failed to load:', e)
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('d-none')
                          }}
                        />
                        <div className="d-none" style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6c757d'
                        }}>
                          <i className="bi bi-image" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></i>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>Image failed to load</p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <i className="bi bi-image" style={{ fontSize: '1.5rem', color: '#6c757d', marginBottom: '0.5rem' }}></i>
                        <p style={{ margin: '0.25rem 0', color: '#6c757d', fontSize: '0.8rem' }}>No photo available</p>
                      </div>
                    )
                  )}
                  </div>
                </div>

                {/* QR Code Display - Right Side - Hidden for consumable items */}
                {(() => {
                  const isConsumable = existingItem.consumable === true || existingItem.consumable === 1 || existingItem.consumable === '1' || existingItem.consumable === 'true'
                  if (isConsumable) {
                    return null // Don't show QR code section for consumable items
                  }
                  return (
                    <div style={{ 
                      width: '100%',
                      height: '336px', // Match stacked Description (160px) + gap (16px) + Photo (160px) = 336px
                      border: '2px solid #16a34a',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: '#ffffff',
                      padding: '0.75rem',
                      gap: '0.5rem',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}>
                      {(() => {
                        // Generate QR code with comprehensive item identification data
                        const serialNum = existingItem.serialNumber || existingItem.serial_number
                        const itemId = existingItem.id
                        const itemName = existingItem.name || 'Unknown Item'
                        const itemCategory = existingItem.category || 'General'
                        const itemLocation = existingItem.location || 'Unknown'
                        
                        // Create structured QR data that includes all identifying information
                        // Format: ITEM-ID|SERIAL|NAME|CATEGORY|LOCATION
                        const qrData = serialNum 
                          ? `ITEM-${itemId}|SN:${serialNum}|${itemName}|${itemCategory}|${itemLocation}`
                          : `ITEM-${itemId}|${itemName}|${itemCategory}|${itemLocation}`
                        
                        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`
                        
                        // Download function
                        const downloadQRCode = () => {
                          try {
                            // Create a canvas to add text below QR code
                            const canvas = document.createElement('canvas')
                            const ctx = canvas.getContext('2d')
                            if (!ctx) return
                            
                            canvas.width = 300
                            canvas.height = 380 // Extra space for text
                            
                            // Load QR code image
                            const img = new Image()
                            img.crossOrigin = 'anonymous'
                            img.onload = () => {
                              // Draw white background
                              ctx.fillStyle = '#ffffff'
                              ctx.fillRect(0, 0, canvas.width, canvas.height)
                              
                              // Draw QR code
                              ctx.drawImage(img, 50, 20, 200, 200)
                              
                              // Draw item information below QR code
                              ctx.fillStyle = '#000000'
                              ctx.font = 'bold 14px Arial'
                              ctx.textAlign = 'center'
                              
                              // Item Name
                              ctx.fillText(itemName, 150, 250)
                              
                              // Serial Number (if available)
                              if (serialNum) {
                                ctx.font = '12px Arial'
                                ctx.fillText(`SN: ${serialNum}`, 150, 275)
                              }
                              
                              // Item ID
                              ctx.font = '10px Arial'
                              ctx.fillText(`ID: ${itemId}`, 150, 295)
                              
                              // Category and Location
                              ctx.fillText(`${itemCategory} | ${itemLocation}`, 150, 315)
                              
                              // Convert to blob and download
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
                              // Fallback: download QR code directly without text
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
                        
                        // Calculate available space: 336px - 24px (padding top+bottom) - 8px (gap) - 8px (gap) = 296px
                        // Distribute: QR code ~200px, Info box ~60px, Button ~36px
                        return (
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.5rem', 
                            height: '100%',
                            boxSizing: 'border-box',
                            minHeight: 0,
                            overflow: 'hidden'
                          }}>
                            {/* QR Code Image */}
                            <div style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.25rem',
                              backgroundColor: '#ffffff',
                              borderRadius: '4px',
                              flex: '1 1 0',
                              minHeight: 0,
                              maxHeight: '200px',
                              overflow: 'hidden'
                            }}>
                              <img 
                                src={qrImageUrl}
                                alt="QR Code"
                                id={`qr-code-${itemId}`}
                                style={{ 
                                  maxWidth: '100%',
                                  maxHeight: '100%',
                                  width: 'auto',
                                  height: 'auto',
                                  objectFit: 'contain',
                                  borderRadius: '4px',
                                  display: 'block'
                                }}
                                onError={(e) => {
                                  console.error('QR image failed to load:', e)
                                }}
                              />
                            </div>
                            
                            {/* Item Info below QR Code for identification */}
                            <div style={{
                              padding: '0.4rem 0.5rem',
                              backgroundColor: '#f8f9fa',
                              borderRadius: '4px',
                              textAlign: 'center',
                              border: '1px solid #dee2e6',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              flexShrink: 0,
                              height: '60px',
                              overflow: 'hidden',
                              justifyContent: 'center'
                            }}>
                              <div style={{ 
                                fontWeight: '600', 
                                color: '#212529',
                                fontSize: '0.7rem',
                                lineHeight: '1.1',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                margin: 0
                              }}>
                                {itemName}
                              </div>
                              {serialNum && (
                                <div style={{ 
                                  fontFamily: 'monospace', 
                                  color: '#16a34a', 
                                  fontWeight: '600',
                                  fontSize: '0.65rem',
                                  letterSpacing: '0.5px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  margin: 0
                                }}>
                                  SN: {serialNum}
                                </div>
                              )}
                            </div>
                            
                            {/* Download Button */}
                            <button
                              type="button"
                              onClick={downloadQRCode}
                              style={{
                                width: '100%',
                                padding: '0.45rem',
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
                                gap: '0.35rem',
                                transition: 'background-color 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                flexShrink: 0,
                                height: '36px',
                                margin: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#15803d'
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#16a34a'
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                            >
                              <i className="bi bi-download" style={{ fontSize: '0.85rem' }}></i>
                              <span>Download</span>
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Damage Resolution Section - Show when item status is Damaged or Under Maintenance */}
            {(existingItem?.status === 'Damaged' || existingItem?.status === 'Under Maintenance') && (
              <div style={{
                gridColumn: '1 / -1',
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#fef2f2',
                border: '2px solid #dc2626',
                borderRadius: '8px'
              }}>
                <h4 style={{ 
                  marginTop: 0, 
                  marginBottom: '1rem', 
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <i className="bi bi-tools" style={{ fontSize: '1.2rem' }}></i>
                  Damage Resolution
                </h4>
                <p style={{ marginBottom: '1rem', color: '#7f1d1d', fontSize: '0.9rem' }}>
                  This item is marked as {existingItem?.status === 'Damaged' ? 'damaged' : 'under maintenance'}. Once repairs are completed, you can mark it as available by selecting "Available" from the Status dropdown above or using the button below.
                </p>
                {isEditMode ? (
                  <button
                    type="button"
                    onClick={() => setShowRepairConfirm(true)}
                    style={{
                      padding: '0.625rem 1.25rem',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <i className="bi bi-check-circle"></i>
                    Mark as Repaired & Available
                  </button>
                ) : (
                  <p style={{ color: '#991b1b', fontSize: '0.875rem', fontStyle: 'italic' }}>
                    <i className="bi bi-info-circle me-1"></i>
                    Click "Edit Item" to mark as repaired
                  </p>
                )}
              </div>
            )}

            {/* Damage History Section - Collapsible */}
            <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
              <details style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '0.75rem'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.95rem',
                  padding: '0.5rem',
                  userSelect: 'none',
                  listStyle: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <i className="bi bi-chevron-right" style={{ transition: 'transform 0.2s' }}></i>
                  <i className="bi bi-clock-history me-1"></i>
                  Damage History (Admin Only)
                </summary>
                <div style={{ marginTop: '1rem', padding: '0.5rem' }}>
                  <DamageHistorySection itemId={existingItem?.id} />
                </div>
              </details>
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
           {isEditMode && onSave && (
             <button
               type="button"
               onClick={handleSave}
               disabled={isSubmitting}
               style={{
                 background: '#28a745',
                 color: 'white',
                 border: 'none',
                 padding: '0.5rem 1rem',
                 borderRadius: '4px',
                 cursor: isSubmitting ? 'not-allowed' : 'pointer',
                 fontSize: '1rem',
                 opacity: isSubmitting ? 0.6 : 1
               }}
             >
               {isSubmitting ? 'Saving...' : 'Save'}
             </button>
           )}
           <button 
             type="button" 
             onClick={onClose}
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
             Close
           </button>
           {!isEditMode && onEdit && (
             <button 
               type="button"
               onClick={() => {
                 onEdit()
               }}
               style={{
                 padding: '0.5rem 1rem',
                 border: '1px solid #16a34a',
                 backgroundColor: '#16a34a',
                 color: 'white',
                 borderRadius: '4px',
                 cursor: 'pointer',
                 fontSize: '1rem'
               }}
             >
               Edit Item
             </button>
           )}
                  </div>
       </div>
     </div>

     {/* Mark as Repaired Confirmation Modal */}
     <ConfirmationModal
       isOpen={showRepairConfirm}
       onClose={() => {
         if (!isMarkingRepaired) {
           setShowRepairConfirm(false)
         }
       }}
       onConfirm={confirmMarkRepaired}
       title="Mark as Repaired"
       message={`Are you sure you want to mark "${existingItem?.name}" as repaired and available?`}
       confirmText="Mark as Repaired"
       cancelText="Cancel"
       type="info"
       warningMessage="This will make the item requestable by teachers again."
       isLoading={isMarkingRepaired}
     />
     </>
   )
 }
