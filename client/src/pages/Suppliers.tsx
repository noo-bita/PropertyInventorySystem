import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import ConfirmationModal from '../components/ConfirmationModal'
import { showNotification } from '../utils/notifications'

interface Supplier {
  id: number
  supplier_name: string
  company_name: string | null
  contact_person: string | null
  contact_number: string | null
  email: string | null
  address: string | null
  business_registration_number: string | null
  notes: string | null
  status: 'active' | 'inactive'
  type?: 'supplier' | 'donor'
  date_added: string
  created_at: string
  updated_at: string
}

export default function Suppliers() {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const itemsPerPage = 15
  
  // Modal states
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false)
  const [showAddDonorModal, setShowAddDonorModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  
  // Form states
  const [formData, setFormData] = useState({
    supplier_name: '',
    company_name: '',
    contact_person: '',
    contact_number: '',
    email: '',
    address: '',
    notes: '',
    status: 'active' as 'active' | 'inactive',
    type: 'supplier' as 'supplier' | 'donor'
  })
  
  // Store original data for comparison when editing
  const [originalFormData, setOriginalFormData] = useState<typeof formData | null>(null)

  // Load suppliers on page load and when filters change
  useEffect(() => {
    loadSuppliers()
  }, [location.pathname, currentPage, searchTerm, statusFilter])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: itemsPerPage.toString(),
        sort_by: 'created_at',
        sort_order: 'desc',
      })
      
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      // Fetch from both suppliers and donors
      const [suppliersResponse, donorsResponse] = await Promise.all([
        apiFetch(`/api/suppliers?${params.toString()}`),
        apiFetch(`/api/donors?${params.toString()}`)
      ])
      
      let allEntries: Supplier[] = []
      let totalCount = 0
      let lastPage = 1
      
      if (suppliersResponse.ok) {
        const suppliersData = await suppliersResponse.json()
        const supplierList = suppliersData.data || []
        // Add type field to suppliers
        const suppliersWithType = supplierList.map((s: any) => ({ ...s, type: 'supplier' }))
        allEntries = [...allEntries, ...suppliersWithType]
        totalCount += suppliersData.total || 0
        lastPage = Math.max(lastPage, suppliersData.last_page || 1)
      }
      
      if (donorsResponse.ok) {
        const donorsData = await donorsResponse.json()
        const donorList = donorsData.data || []
        // Add type field to donors
        const donorsWithType = donorList.map((d: any) => ({ ...d, type: 'donor' }))
        allEntries = [...allEntries, ...donorsWithType]
        totalCount += donorsData.total || 0
        lastPage = Math.max(lastPage, donorsData.last_page || 1)
      }
      
      // Sort combined results by created_at descending
      allEntries.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA
      })
      
      // Apply pagination to combined results
      const startIndex = (currentPage - 1) * itemsPerPage
      const endIndex = startIndex + itemsPerPage
      const paginatedEntries = allEntries.slice(startIndex, endIndex)
      
      setSuppliers(paginatedEntries)
      setTotalPages(Math.ceil(allEntries.length / itemsPerPage))
      setTotal(allEntries.length)
      
      if (!suppliersResponse.ok && !donorsResponse.ok) {
        setError('Failed to load suppliers and donors')
        showNotification('Failed to load suppliers and donors', 'error')
      }
    } catch (error) {
      console.error('Error loading suppliers and donors:', error)
      setError('Failed to load suppliers and donors')
      showNotification('Failed to load suppliers and donors', 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      supplier_name: '',
      company_name: '',
      contact_person: '',
      contact_number: '',
      email: '',
      address: '',
      notes: '',
      status: 'active',
      type: 'supplier'
    })
    setOriginalFormData(null)
  }
  
  // Check if form data has changed from original
  const hasFormChanged = (): boolean => {
    if (!editingSupplier || !originalFormData) return false
    
    // Compare all fields
    return (
      formData.supplier_name !== originalFormData.supplier_name ||
      formData.company_name !== originalFormData.company_name ||
      formData.contact_person !== originalFormData.contact_person ||
      formData.contact_number !== originalFormData.contact_number ||
      formData.email !== originalFormData.email ||
      formData.address !== originalFormData.address ||
      formData.notes !== originalFormData.notes ||
      formData.status !== originalFormData.status ||
      formData.type !== originalFormData.type
    )
  }

  const handleAddSupplier = () => {
    resetForm()
    setFormData({ ...formData, type: 'supplier' })
    setEditingSupplier(null)
    setShowAddSupplierModal(true)
  }

  const handleAddDonor = () => {
    resetForm()
    setFormData({ ...formData, type: 'donor' })
    setEditingSupplier(null)
    setShowAddDonorModal(true)
  }

  const handleEditSupplier = (supplier: Supplier) => {
    const initialFormData = {
      supplier_name: supplier.supplier_name,
      company_name: supplier.company_name || '',
      contact_person: supplier.contact_person || '',
      contact_number: supplier.contact_number || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      status: supplier.status,
      type: supplier.type || 'supplier'
    }
    setFormData(initialFormData)
    setOriginalFormData(initialFormData)
    setEditingSupplier(supplier)
    setShowEditModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.supplier_name.trim()) {
      const typeLabel = formData.type === 'donor' ? 'Donor' : 'Supplier'
      showNotification(`${typeLabel} name is required`, 'error')
      return
    }

    setIsSubmitting(true)

    try {
      // Determine which endpoint to use based on type
      const isDonor = formData.type === 'donor'
      const baseUrl = isDonor ? '/api/donors' : '/api/suppliers'
      
      const url = editingSupplier 
        ? `${baseUrl}/${editingSupplier.id}`
        : baseUrl
      
      const method = editingSupplier ? 'PUT' : 'POST'
      
      // Prepare payload - remove type field for donors (not needed in backend)
      const payload: any = { ...formData }
      if (isDonor) {
        // Remove type field for donors (not needed in backend)
        delete payload.type
      }
      
      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const typeLabel = formData.type === 'donor' ? 'Donor' : 'Supplier'
        showNotification(
          editingSupplier ? `${typeLabel} updated successfully` : `${typeLabel} added successfully`,
          'success'
        )
        
        // If this is a new entry (not edit), set flag for Inventory modal refresh
        if (!editingSupplier) {
          sessionStorage.setItem('supplierAdded', 'true')
        }
        
        setShowAddSupplierModal(false)
        setShowAddDonorModal(false)
        setShowEditModal(false)
        resetForm()
        setEditingSupplier(null)
        loadSuppliers()
        
        // Check if user came from Inventory page and should return
        const returnToInventory = sessionStorage.getItem('returnToInventory')
        if (returnToInventory === 'true' && !editingSupplier) {
          sessionStorage.removeItem('returnToInventory')
          // Small delay to show success message, then navigate back
          setTimeout(() => {
            window.history.back()
          }, 500)
        }
      } else {
        const errorData = await response.json()
        let errorMessage = errorData.message || 'Failed to save entry'
        
        // Show more detailed error if available
        if (errorData.error) {
          errorMessage += `: ${errorData.error}`
        }
        if (errorData.errors) {
          const firstError = Object.values(errorData.errors)[0]
          if (Array.isArray(firstError) && firstError.length > 0) {
            errorMessage = firstError[0]
          }
        }
        
        console.error('Save error details:', errorData)
        showNotification(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Error saving entry:', error)
      const typeLabel = formData.type === 'donor' ? 'donor' : 'supplier'
      showNotification(`Failed to save ${typeLabel}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = (supplier: Supplier) => {
    setDeleteSupplier(supplier)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!deleteSupplier) return
    
    setIsDeleting(true)
    try {
      // Determine which endpoint to use based on type
      const isDonor = deleteSupplier.type === 'donor'
      const baseUrl = isDonor ? '/api/donors' : '/api/suppliers'
      
      const response = await apiFetch(`${baseUrl}/${deleteSupplier.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const typeLabel = deleteSupplier.type === 'donor' ? 'Donor' : 'Supplier'
        showNotification(`${typeLabel} deleted successfully`, 'success')
        loadSuppliers()
        setShowDeleteConfirm(false)
        setDeleteSupplier(null)
      } else {
        const typeLabel = deleteSupplier.type === 'donor' ? 'donor' : 'supplier'
        showNotification(`Failed to delete ${typeLabel}`, 'error')
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
      const typeLabel = deleteSupplier.type === 'donor' ? 'donor' : 'supplier'
      showNotification(`Failed to delete ${typeLabel}`, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const toggleRowExpansion = (supplierId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(supplierId)) {
        newSet.delete(supplierId)
      } else {
        newSet.add(supplierId)
      }
      return newSet
    })
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
                Loading suppliers and donors...
              </p>
            </div>
          </div>
        )}
        
        <AdminTopBar
          currentUser={currentUser}
          searchPlaceholder="Search suppliers..."
          onSearch={setSearchTerm}
          searchValue={searchTerm}
        />
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            <div className="standard-card">
              {/* Section Header with Filter */}
              <div className="section-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-4)',
                borderBottom: '1px solid var(--gray-200)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-dark)' }}>
                    Suppliers & Donors
                  </h3>
                  <div className="text-muted" style={{ fontSize: '0.875rem', marginTop: '4px' }}>
                    Total: {total} {total === 1 ? 'entry' : 'entries'}
                  </div>
                </div>
                
                {/* Status Filter - Moved to the right end of header */}
                {!loading && (
                  <select 
                    className="category-filter"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
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
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                )}
              </div>

              <div className="standard-card-body" style={{ padding: 0 }}>

                {/* Error State */}
                {error && !loading && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}

                {/* Table */}
                {!loading && !error && (
                  <>
                    <div className="inventory-table inventory-table-modern">
                      <table className="table-modern">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}></th>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Company</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suppliers.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center py-4">
                                <i className="bi bi-truck" style={{ fontSize: '2rem', color: '#cbd5e1' }}></i>
                                <p className="mt-2 text-muted">No suppliers or donors found</p>
                                <p className="text-muted">No entries available</p>
                              </td>
                            </tr>
                          ) : (
                            suppliers.map((supplier) => (
                              <React.Fragment key={supplier.id}>
                                <tr 
                                  className={`${expandedRows.has(supplier.id) ? 'expanded-row' : ''}`}
                                  onClick={() => toggleRowExpansion(supplier.id)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td>
                                    <i className={`bi ${expandedRows.has(supplier.id) ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                                  </td>
                                  <td>
                                    <span className="item-id">#{String(supplier.id).padStart(3, '0')}</span>
                                  </td>
                                  <td>
                                    <div className="item-info-cell">
                                      <strong>{supplier.supplier_name}</strong>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`badge ${
                                      (supplier.type || 'supplier') === 'donor' ? 'bg-info' : 'bg-primary'
                                    }`} style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: '500',
                                      textTransform: 'capitalize'
                                    }}>
                                      {supplier.type === 'donor' ? 'Donor' : 'Supplier'}
                                    </span>
                                  </td>
                                  <td>{supplier.company_name || '-'}</td>
                                  <td>
                                    <span className={`badge badge-modern ${
                                      supplier.status === 'active' ? 'badge-success' : 'badge-secondary'
                                    }`}>
                                      {supplier.status}
                                    </span>
                                  </td>
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <div className="action-buttons action-buttons-modern">
                                      <button 
                                        className="action-btn-edit action-btn-modern"
                                        onClick={() => handleEditSupplier(supplier)}
                                        title="Edit Supplier"
                                      >
                                        <i className="bi bi-pencil"></i>
                                      </button>
                                      <button 
                                        className="action-btn-delete action-btn-modern"
                                        onClick={() => handleDelete(supplier)}
                                        title="Delete Supplier"
                                      >
                                        <i className="bi bi-trash"></i>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {expandedRows.has(supplier.id) && (
                                  <tr className="expanded-details">
                                    <td colSpan={7}>
                                      <div className="item-details-grid">
                                        <div className="item-info-section">
                                          <div className="info-row">
                                            <div className="detail-item">
                                              <label>CONTACT PERSON:</label>
                                              <span>{supplier.contact_person || 'N/A'}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>CONTACT NUMBER:</label>
                                              <span>{supplier.contact_number || 'N/A'}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>EMAIL:</label>
                                              <span>{supplier.email || 'N/A'}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>ADDRESS:</label>
                                              <span>{supplier.address || 'N/A'}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>BUSINESS REG. NO.:</label>
                                              <span>{supplier.business_registration_number || 'N/A'}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>NOTES:</label>
                                              <span>{supplier.notes || 'No notes'}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>DATE ADDED:</label>
                                              <span>{formatDate(supplier.date_added)}</span>
                                            </div>
                                            <div className="detail-item">
                                              <label>LAST UPDATED:</label>
                                              <span>{formatDate(supplier.updated_at)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
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
                          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} entries
                        </div>
                        
                        <div className="pagination-controls" style={{
                          display: 'flex',
                          gap: 'var(--space-2)',
                          alignItems: 'center'
                        }}>
                          <button
                            className="btn-standard btn-outline-primary"
                            onClick={() => setCurrentPage(currentPage - 1)}
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
                            color: 'var(--gray-600)'
                          }}>
                            Page {currentPage} of {totalPages}
                          </div>
                          
                          <button
                            className="btn-standard btn-outline-primary"
                            onClick={() => setCurrentPage(currentPage + 1)}
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
          </div>
        </div>
      </main>


      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            if (!isSubmitting) {
              setShowAddSupplierModal(false)
              resetForm()
            }
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Supplier</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    if (!isSubmitting) {
                      setShowAddSupplierModal(false)
                      resetForm()
                    }
                  }}
                  disabled={isSubmitting}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">
                        Supplier Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.supplier_name}
                        onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Company Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Contact Person</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Contact Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.contact_number}
                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Address</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                        disabled={isSubmitting}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!isSubmitting) {
                        setShowAddSupplierModal(false)
                        resetForm()
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Supplier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Donor Modal */}
      {showAddDonorModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            if (!isSubmitting) {
              setShowAddDonorModal(false)
              resetForm()
            }
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Donor</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    if (!isSubmitting) {
                      setShowAddDonorModal(false)
                      resetForm()
                    }
                  }}
                  disabled={isSubmitting}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">
                        Donor Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.supplier_name}
                        onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Company / Organization</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        disabled={isSubmitting}
                        placeholder="Organization name if applicable"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Contact Person</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        disabled={isSubmitting}
                        placeholder="Contact person name"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Contact Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.contact_number}
                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                        disabled={isSubmitting}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={isSubmitting}
                        placeholder="Email address"
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Address</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                        disabled={isSubmitting}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!isSubmitting) {
                        setShowAddDonorModal(false)
                        resetForm()
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Donor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {showEditModal && editingSupplier && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => {
            if (!isSubmitting) {
              setShowEditModal(false)
              resetForm()
              setEditingSupplier(null)
            }
          }}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Supplier or Donor</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    if (!isSubmitting) {
                      setShowEditModal(false)
                      resetForm()
                      setEditingSupplier(null)
                    }
                  }}
                  disabled={isSubmitting}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-12 mb-3">
                      <label className="form-label">
                        Source Type <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as 'supplier' | 'donor' })}
                        required
                        disabled={isSubmitting}
                      >
                        <option value="supplier">Supplier</option>
                        <option value="donor">Donor</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">
                        {formData.type === 'donor' ? 'Donor Name' : 'Supplier Name'} <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.supplier_name}
                        onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    {formData.type === 'supplier' && (
                      <>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Company Name</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Contact Person</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.contact_person}
                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Contact Number</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.contact_number}
                            onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            className="form-control"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={isSubmitting}
                          />
                        </div>
                      </>
                    )}
                    {formData.type === 'donor' && (
                      <>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Company / Organization</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.company_name}
                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                            disabled={isSubmitting}
                            placeholder="Organization name if applicable"
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Contact Person</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.contact_person}
                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                            disabled={isSubmitting}
                            placeholder="Contact person name"
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Contact Number</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.contact_number}
                            onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                            disabled={isSubmitting}
                            placeholder="Phone number"
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            className="form-control"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={isSubmitting}
                            placeholder="Email address"
                          />
                        </div>
                      </>
                    )}
                    <div className="col-12 mb-3">
                      <label className="form-label">Address</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-12 mb-3">
                      <label className="form-label">Notes</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                        disabled={isSubmitting}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!isSubmitting) {
                        setShowEditModal(false)
                        resetForm()
                        setEditingSupplier(null)
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || !hasFormChanged()}
                  >
                    {isSubmitting ? 'Updating...' : `Update ${formData.type === 'donor' ? 'Donor' : 'Supplier'}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false)
            setDeleteSupplier(null)
          }
        }}
        onConfirm={confirmDelete}
        title={`Delete ${deleteSupplier?.type === 'donor' ? 'Donor' : 'Supplier'}`}
        message={`Are you sure you want to permanently delete "${deleteSupplier?.supplier_name}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        type="delete"
        warningMessage="This action cannot be undone. The supplier/donor will be permanently removed from the system."
        isLoading={isDeleting}
      />
    </div>
  )
}

