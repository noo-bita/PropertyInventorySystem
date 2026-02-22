import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { showNotification } from '../utils/notifications'
import AutocompleteInput from './AutocompleteInput'
import { getApiBaseUrl } from '../utils/api'

interface Supplier {
  id: number
  supplier_name: string
  company_name: string | null
  type?: 'supplier' | 'donor'
}

interface BulkEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (updateData: any) => Promise<void>
  groupedItem: any
  isSubmitting: boolean
}

export default function BulkEditModal({
  isOpen,
  onClose,
  onSave,
  groupedItem,
  isSubmitting
}: BulkEditModalProps) {
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    secondary_category: '',
    location: '',
    description: '',
    purchase_date: '',
    purchase_price: '',
    purchase_type: 'purchased',
    supplier: '',
    status: 'Available',
    consumable: false
  })

  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [donors, setDonors] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [showNewSupplierInput, setShowNewSupplierInput] = useState(false)
  const [showNewDonorInput, setShowNewDonorInput] = useState(false)
  const loadSuppliersRef = useRef<AbortController | null>(null)

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

  // Initialize form with first item's values when modal opens
  useEffect(() => {
    if (isOpen && groupedItem?.groupedItems && groupedItem.groupedItems.length > 0) {
      const firstItem = groupedItem.groupedItems[0]
      setEditForm({
        name: firstItem.name || '',
        category: firstItem.category || '',
        secondary_category: firstItem.secondary_category || '',
        location: firstItem.location || '',
        description: firstItem.description || '',
        purchase_date: firstItem.purchase_date ? firstItem.purchase_date.split('T')[0] : '',
        purchase_price: firstItem.purchase_price || '',
        purchase_type: firstItem.purchase_type || 'purchased',
        supplier: firstItem.supplier || '',
        status: firstItem.status || 'Available',
        consumable: firstItem.consumable === true || firstItem.consumable === 1 || firstItem.consumable === '1' || firstItem.consumable === 'true'
      })
      // Reset input modes
      setShowNewSupplierInput(false)
      setShowNewDonorInput(false)
    }
  }, [isOpen, groupedItem])

  // Check if current supplier/donor value is not in the list - show text input
  useEffect(() => {
    if (isOpen && editForm.supplier) {
      const isPurchased = editForm.purchase_type === 'purchased' || !editForm.purchase_type
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
  }, [isOpen, editForm.supplier, editForm.purchase_type, suppliers, donors, showNewSupplierInput, showNewDonorInput])

  const handleInputChange = (field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate secondary category
    if (editForm.secondary_category && editForm.secondary_category === editForm.category) {
      showNotification('Secondary category must be different from primary category', 'error')
      return
    }

    // Build update data - only include fields that have values
    const updateData: any = {}
    if (editForm.name) updateData.name = editForm.name
    if (editForm.category) updateData.category = editForm.category
    if (editForm.secondary_category !== undefined) updateData.secondary_category = editForm.secondary_category || null
    if (editForm.location) updateData.location = editForm.location
    if (editForm.description !== undefined) updateData.description = editForm.description
    if (editForm.purchase_date) updateData.purchase_date = editForm.purchase_date
    if (editForm.purchase_price) updateData.purchase_price = parseFloat(editForm.purchase_price) || 0
    if (editForm.purchase_type) updateData.purchase_type = editForm.purchase_type
    if (editForm.supplier !== undefined) updateData.supplier = editForm.supplier
    if (editForm.status) updateData.status = editForm.status
    if (editForm.consumable !== undefined) updateData.consumable = editForm.consumable === true || editForm.consumable === 'consumable'

    await onSave(updateData)
  }

  if (!isOpen) return null

  const firstItem = groupedItem?.groupedItems?.[0]

  return (
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
        zIndex: 10000
      }}
      onClick={onClose}
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
            Edit All Items ({groupedItem?.groupedItems?.length || 0} items)
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

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '1rem' }}>
            <div style={{
              backgroundColor: '#fff3cd',
              color: '#856404',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}>
              <span>⚠</span>
              <span>
                <strong>Note:</strong> This will update all {groupedItem?.groupedItems?.length || 0} items in this group. 
                Serial numbers and QR codes are not included in bulk edits and must be edited individually.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Item Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder={firstItem?.name ? `Original: ${firstItem.name}` : ''}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: 'white'
                  }}
                  className="edit-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Category
                </label>
                <select
                  value={editForm.category}
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
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Secondary Category (Optional)
                </label>
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
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Location
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder={firstItem?.location ? `Original: ${firstItem.location}` : ''}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: 'white'
                  }}
                  className="edit-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
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
                  <option value="Available">Available</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>

              {/* Item Source Section - Full Width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Item Source
                </label>
                <select
                  value={editForm.purchase_type || 'purchased'}
                  onChange={(e) => {
                    handleInputChange('purchase_type', e.target.value)
                    // Clear supplier/donor when switching source type
                    handleInputChange('supplier', '')
                    // Reset input modes
                    setShowNewSupplierInput(false)
                    setShowNewDonorInput(false)
                    // Clear purchase price and date if switching to donated
                    if (e.target.value === 'donated') {
                      handleInputChange('purchase_price', '')
                      handleInputChange('purchase_date', '')
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
                {(editForm.purchase_type === 'purchased' || !editForm.purchase_type) && (
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
                            // Auto-detect and set purchase_type to 'purchased' when supplier is selected
                            if (value && value.trim()) {
                              handleInputChange('purchase_type', 'purchased')
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
                            // Auto-set purchase_type to 'purchased' when typing new supplier name
                            if (e.target.value && e.target.value.trim() && !editForm.purchase_type) {
                              handleInputChange('purchase_type', 'purchased')
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
                {editForm.purchase_type === 'donated' && (
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
                            // Auto-detect and set purchase_type to 'donated' when donor is selected
                            if (value && value.trim()) {
                              handleInputChange('purchase_type', 'donated')
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
                            // Auto-set purchase_type to 'donated' when typing new donor name
                            if (e.target.value && e.target.value.trim()) {
                              handleInputChange('purchase_type', 'donated')
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
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={editForm.purchase_date}
                  onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                  disabled={editForm.purchase_type === 'donated'}
                  placeholder={firstItem?.purchase_date ? `Original: ${firstItem.purchase_date}` : 'Not specified'}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: editForm.purchase_type === 'donated' ? '#f8f9fa' : 'white'
                  }}
                  className="edit-input"
                />
                {editForm.purchase_type === 'donated' && (
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

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Purchase Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.purchase_price}
                  onChange={(e) => handleInputChange('purchase_price', e.target.value)}
                  disabled={editForm.purchase_type === 'donated'}
                  placeholder={firstItem?.purchase_type === 'donated' ? 'N/A (Donated)' : (firstItem?.purchase_price ? `Original: ${firstItem.purchase_price}` : '0')}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: editForm.purchase_type === 'donated' ? '#f8f9fa' : 'white'
                  }}
                  className="edit-input"
                />
                {editForm.purchase_type === 'donated' && (
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

              {/* Item Type (Consumable/Reusable) */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Item Type
                </label>
                <select
                  value={editForm.consumable === true ? 'consumable' : 'reusable'}
                  onChange={(e) => handleInputChange('consumable', e.target.value === 'consumable')}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: 'white',
                    color: '#212529'
                  }}
                  className="edit-input"
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

            </div>

            {/* Description Section - Full Width */}
            <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                placeholder={firstItem?.description ? `Original: ${firstItem.description || 'No description available'}` : 'No description available'}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  backgroundColor: 'white'
                }}
                className="edit-input"
              />
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
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #6c757d',
                backgroundColor: '#6c757d',
                color: 'white',
                borderRadius: '4px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: isSubmitting ? 0.6 : 1
              }}
            >
              Close
            </button>
            <button
              type="submit"
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
          </div>
        </form>
      </div>
    </div>
  )
}
