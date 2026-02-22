import React, { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import ConfirmationModal from '../components/ConfirmationModal'
import { showNotification } from '../utils/notifications'
import LoadingButton from '../components/LoadingButton'
import { getApiBaseUrl } from '../utils/api'

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  
  const [selectedRole, setSelectedRole] = useState('All Roles')
  const [users, setUsers] = useState<Array<any>>([])
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formMiddleName, setFormMiddleName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<'ADMIN' | 'TEACHER'>('ADMIN')
  const [formContact, setFormContact] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formBirthday, setFormBirthday] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPasswordConfirm, setFormPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  // Edit form state
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editMiddleName, setEditMiddleName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'ADMIN' | 'TEACHER'>('ADMIN')
  const [editContact, setEditContact] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editBirthday, setEditBirthday] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [showEditPasswordConfirm, setShowEditPasswordConfirm] = useState(false)
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null)
  const [isSavingUser, setIsSavingUser] = useState(false)

  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null)
  const [deleteUserName, setDeleteUserName] = useState<string>('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    setError(null)
    setSearchTerm('') // Clear search term on page load
    
    const timeoutId = setTimeout(() => {
    fetch(`${getApiBaseUrl()}/api/users`)
      .then(r => {
        return r.json()
      })
             .then(data => {
         // Ensure each user has a full_name property
         const usersWithFullName = data.map((user: any) => ({
           ...user,
           full_name: user.full_name || `${user.first_name} ${user.last_name}`
         }))
         
         setUsers(usersWithFullName)
         setLoading(false)
       })
      .catch(err => {
        console.error('Error fetching users:', err)
        setError(err.message)
        setUsers([])
        setLoading(false)
      })
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [location.pathname])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedRole])

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'ADMINISTRATOR':
        return 'badge-warning'
      case 'TEACHER':
        return 'badge-info'
      default:
        return 'badge-secondary'
    }
  }

  // Filter users by role and search term
  const filteredUsers = users
    .filter(u => {
      const roleMatch = selectedRole === 'All Roles' 
      || (selectedRole === 'Administrator' && (u.role === 'ADMIN' || u.role === 'ADMINISTRATOR'))
      || (selectedRole === 'Teacher' && u.role === 'TEACHER')
      
      if (!roleMatch) return false
      
      if (!searchTerm.trim()) return true
      
      const searchLower = searchTerm.toLowerCase()
      const fullName = (u.full_name || `${u.first_name} ${u.last_name}`).toLowerCase()
      const email = (u.email || '').toLowerCase()
      const userId = `#${String(u.id).padStart(3, '0')}`.toLowerCase()
      const role = (u.role || '').toLowerCase()
      
      return fullName.includes(searchLower) 
        || email.includes(searchLower)
        || userId.includes(searchLower)
        || role.includes(searchLower)
    })
    .sort((a, b) => {
      const nameA = (a.full_name || `${a.first_name} ${a.last_name}`).toLowerCase()
      const nameB = (b.full_name || `${b.first_name} ${b.last_name}`).toLowerCase()
      return nameA.localeCompare(nameB)
    })

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  const toggleRowExpansion = (userId: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId)
    } else {
      newExpanded.add(userId)
    }
    setExpandedRows(newExpanded)
  }

  const handleAddUser = () => {
    if (isSavingUser) return
    if (!formFirstName.trim() || !formLastName.trim() || !formEmail.trim() || !formPassword.trim()) {
      showNotification('Please fill in all required fields', 'error')
      return
    }

    if (formPassword !== formPasswordConfirm) {
      showNotification('Passwords do not match', 'error')
      return
    }

    const formData = new FormData()
    formData.append('first_name', formFirstName)
    formData.append('last_name', formLastName)
    if (formMiddleName) formData.append('middle_name', formMiddleName)
    formData.append('email', formEmail)
    formData.append('password', formPassword)
    formData.append('password_confirmation', formPasswordConfirm)
    formData.append('role', formRole)
    if (formContact) formData.append('contact_number', formContact)
    if (formAddress) formData.append('address', formAddress)
    if (formBirthday) formData.append('birthday', formBirthday)
    if (photoInputRef.current?.files?.[0]) {
      formData.append('photo', photoInputRef.current.files[0])
    }

    setIsSavingUser(true)

    fetch(`${getApiBaseUrl()}/api/users`, {
      method: 'POST',
      body: formData,
    })
      .then(async (r) => {
        if (!r.ok) {
          let errorMessage = 'Failed to create user'
          try {
            const errorData = await r.json()
            if (errorData.errors) {
              const errorMessages = Object.values(errorData.errors).flat()
              errorMessage = errorMessages.join(', ')
            } else if (errorData.message) {
              errorMessage = errorData.message
            }
          } catch (jsonError) {
            const errorText = await r.text()
            errorMessage = errorText || errorMessage
          }
          throw new Error(errorMessage)
        }
        return r.json()
      })
      .then((created) => {
        setUsers(prev => [created, ...prev])
        showNotification('User added successfully!', 'success')
        
        // Reset form
        setFormFirstName('')
        setFormLastName('')
        setFormMiddleName('')
        setFormEmail('')
        setFormPassword('')
        setFormPasswordConfirm('')
        setFormRole('ADMIN')
        setFormContact('')
        setFormAddress('')
        setFormBirthday('')
        setShowPassword(false)
        setShowPasswordConfirm(false)
        if (photoInputRef.current) photoInputRef.current.value = ''
        
        // Close modal
        const modal = document.getElementById('addUserModal')
        if (modal) {
          const modalInstance = (window as any).bootstrap?.Modal?.getInstance(modal)
          if (modalInstance) {
            modalInstance.hide()
          } else {
            modal.classList.remove('show', 'd-block')
            modal.style.display = 'none'
            document.body.classList.remove('modal-open')
            const backdrop = document.querySelector('.modal-backdrop')
            if (backdrop) backdrop.remove()
          }
        }
      })
      .catch((err) => {
        console.error('Failed to create user', err)
        showNotification('Failed to create user. Please check your inputs.', 'error')
      })
      .finally(() => {
        setIsSavingUser(false)
      })
  }

  const handleEditUser = (user: any) => {
    setEditingUser(user)
    setEditFirstName(user.first_name)
    setEditLastName(user.last_name)
    setEditMiddleName(user.middle_name || '')
    setEditEmail(user.email)
    setEditRole(user.role)
    setEditContact(user.contact_number || '')
    setEditAddress(user.address || '')
    setEditBirthday(user.birthday ? user.birthday.split('T')[0] : '')
    setEditPassword('')
    setEditPasswordConfirm('')
    setShowEditPassword(false)
    setShowEditPasswordConfirm(false)
  }

  const handleUpdateUser = () => {
    if (isSavingUser) return
    
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      showNotification('Please fill in all required fields', 'error')
      return
    }

    if (editPassword && editPassword !== editPasswordConfirm) {
      showNotification('Passwords do not match', 'error')
      return
    }

    const url = `${getApiBaseUrl()}/api/users/${editingUser.id}`
    const hasFile = editPhotoInputRef.current?.files?.[0]
    
    setIsSavingUser(true)

    if (hasFile) {
      const formData = new FormData()
      formData.append('first_name', editFirstName)
      formData.append('last_name', editLastName)
      if (editMiddleName) formData.append('middle_name', editMiddleName)
      formData.append('email', editEmail)
      if (editPassword) {
        formData.append('password', editPassword)
        formData.append('password_confirmation', editPasswordConfirm)
      }
      formData.append('role', editRole)
      if (editContact) formData.append('contact_number', editContact)
      if (editAddress) formData.append('address', editAddress)
      if (editBirthday) formData.append('birthday', editBirthday)
             formData.append('photo', hasFile)
       formData.append('_method', 'PUT')

             fetch(url, {
         method: 'POST',
         body: formData,
       })
        .then(async (r) => {
          if (!r.ok) {
            const errorText = await r.text()
            console.error('Server error response:', errorText)
            throw new Error(errorText)
          }
          return r.json()
        })
        .then((updated) => {
          setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
          setEditingUser(null)
          
          const modal = document.getElementById('editUserModal')
          if (modal) {
            const modalInstance = (window as any).bootstrap?.Modal?.getInstance(modal)
            if (modalInstance) {
              modalInstance.hide()
            } else {
              modal.classList.remove('show', 'd-block')
              modal.style.display = 'none'
              document.body.classList.remove('modal-open')
              const backdrop = document.querySelector('.modal-backdrop')
              if (backdrop) backdrop.remove()
            }
          }
          
          showNotification('User updated successfully!', 'success')
          
          // Reset edit form
          setEditFirstName('')
          setEditLastName('')
          setEditMiddleName('')
          setEditEmail('')
          setEditPassword('')
          setEditPasswordConfirm('')
          setEditRole('ADMIN')
          setEditContact('')
          setEditAddress('')
          setEditBirthday('')
          setShowEditPassword(false)
          setShowEditPasswordConfirm(false)
          if (editPhotoInputRef.current) editPhotoInputRef.current.value = ''
        })
                .catch((err) => {
          console.error('Failed to update user', err)
          showNotification(`Failed to update user: ${err.message || 'Unknown error occurred'}`, 'error')
          
          const modal = document.getElementById('editUserModal')
          if (modal) {
            const modalInstance = (window as any).bootstrap?.Modal?.getInstance(modal)
            if (modalInstance) {
              modalInstance.hide()
            } else {
              modal.classList.remove('show', 'd-block')
              modal.style.display = 'none'
              document.body.classList.remove('modal-open')
              const backdrop = document.querySelector('.modal-backdrop')
              if (backdrop) backdrop.remove()
            }
          }
          
          setEditFirstName('')
          setEditLastName('')
          setEditMiddleName('')
          setEditEmail('')
          setEditPassword('')
          setEditPasswordConfirm('')
          setEditRole('ADMIN')
          setEditContact('')
          setEditAddress('')
          setEditBirthday('')
          setShowEditPassword(false)
          setShowEditPasswordConfirm(false)
          if (editPhotoInputRef.current) editPhotoInputRef.current.value = ''
        })
        .finally(() => {
          setIsSavingUser(false)
        })
      } else {
      const updateData: any = {
        first_name: editFirstName,
        last_name: editLastName,
        email: editEmail,
        role: editRole
      }
      
      if (editMiddleName) updateData.middle_name = editMiddleName
      if (editPassword) {
        updateData.password = editPassword
        updateData.password_confirmation = editPasswordConfirm
      }
      if (editContact) updateData.contact_number = editContact
      if (editAddress) updateData.address = editAddress
             if (editBirthday) updateData.birthday = editBirthday
       updateData._method = 'PUT'

             fetch(url, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Accept': 'application/json',
         },
         body: JSON.stringify(updateData),
       })
        .then(async (r) => {
          if (!r.ok) {
            const errorText = await r.text()
            console.error('Server error response:', errorText)
            throw new Error(errorText)
          }
          return r.json()
        })
        .then((updated) => {
          setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
          setEditingUser(null)
          
          const modal = document.getElementById('editUserModal')
          if (modal) {
            const modalInstance = (window as any).bootstrap?.Modal?.getInstance(modal)
            if (modalInstance) {
              modalInstance.hide()
            } else {
              modal.classList.remove('show', 'd-block')
              modal.style.display = 'none'
              document.body.classList.remove('modal-open')
              const backdrop = document.querySelector('.modal-backdrop')
              if (backdrop) backdrop.remove()
            }
          }
          
          showNotification('User updated successfully!', 'success')
          
          setEditFirstName('')
          setEditLastName('')
          setEditMiddleName('')
          setEditEmail('')
          setEditPassword('')
          setEditPasswordConfirm('')
          setEditRole('ADMIN')
          setEditContact('')
          setEditAddress('')
          setEditBirthday('')
          setShowEditPassword(false)
          setShowEditPasswordConfirm(false)
          if (editPhotoInputRef.current) editPhotoInputRef.current.value = ''
        })
        .catch((err) => {
          console.error('Failed to update user', err)
          showNotification(`Failed to update user: ${err.message || 'Unknown error occurred'}`, 'error')
          
          const modal = document.getElementById('editUserModal')
          if (modal) {
            const modalInstance = (window as any).bootstrap?.Modal?.getInstance(modal)
            if (modalInstance) {
              modalInstance.hide()
            } else {
              modal.classList.remove('show', 'd-block')
              modal.style.display = 'none'
              document.body.classList.remove('modal-open')
              const backdrop = document.querySelector('.modal-backdrop')
              if (backdrop) backdrop.remove()
            }
          }
          
          setEditFirstName('')
          setEditLastName('')
          setEditMiddleName('')
          setEditEmail('')
          setEditPassword('')
          setEditPasswordConfirm('')
          setEditRole('ADMIN')
          setEditContact('')
          setEditAddress('')
          setEditBirthday('')
          setShowEditPassword(false)
          setShowEditPasswordConfirm(false)
          if (editPhotoInputRef.current) editPhotoInputRef.current.value = ''
        })
        .finally(() => {
          setIsSavingUser(false)
        })
    }
  }

  const handleDeleteUser = (userId: number, userName: string) => {
    setDeleteUserId(userId)
    setDeleteUserName(userName)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/${deleteUserId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText)
      }
      
      await response.json()
      setUsers(prev => prev.filter(u => u.id !== deleteUserId))
      showNotification('User deleted successfully!', 'success')
      setShowDeleteConfirm(false)
      setDeleteUserId(null)
      setDeleteUserName('')
    } catch (err: any) {
      console.error('Failed to delete user', err)
      showNotification('Failed to delete user.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!currentUser) return null

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
                Loading users...
              </p>
            </div>
          </div>
        )}
        
        {/* Topbar inside main-content to prevent sidebar overlap - with search */}
        <AdminTopBar 
          key={`user-management-topbar-${location.pathname}`}
          currentUser={currentUser}
          searchPlaceholder="Search users..."
          onSearch={setSearchTerm}
          searchValue={searchTerm}
        />
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            {/* Main Header */}
            <div className="mb-4">
            <h1 className="dashboard-title">User Management</h1>
            <p className="dashboard-subtitle">Manage school staff, administrators, and teachers</p>
          </div>

            {/* Error State */}
            {error && !loading && (
            <div className="alert alert-danger" role="alert">
              <strong>Error:</strong> {error}
            </div>
          )}

            {/* Users Section - Matching Inventory Layout */}
          {!loading && !error && (
              <div className="inventory-section">
                <div className="section-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-4)'
                }}>
                <h3>All Users</h3>
                  
                  {/* Role Filter - Moved to the right end of header */}
                <select 
                    className="category-filter"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
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
                  <option>All Roles</option>
                  <option>Administrator</option>
                  <option>Teacher</option>
                </select>
              </div>
              
                <div className="inventory-table inventory-table-modern">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}></th>
                      <th>User ID</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-5">
                          <i className="bi bi-people" style={{ fontSize: '2rem', color: '#cbd5e1' }}></i>
                          <p className="mt-2 text-muted">
                            {searchTerm || selectedRole !== 'All Roles' 
                              ? 'No users found matching your search' 
                              : 'No users found'}
                          </p>
                          {!searchTerm && selectedRole === 'All Roles' && (
                          <p className="text-muted">Click "Add User" to create your first user</p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((user: any, index: number) => (
                        <React.Fragment key={user.id}>
                          <tr 
                            className={`${expandedRows.has(user.id) ? 'expanded-row' : ''} ${index % 2 === 0 ? 'even-row' : 'odd-row'}`}
                            onClick={() => toggleRowExpansion(user.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <i className={`bi ${expandedRows.has(user.id) ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                            </td>
                            <td>
                              <span className="item-id">#{String(user.id).padStart(3, '0')}</span>
                            </td>
                            <td>
                              <div className="item-info-cell">
                                <span>{user.full_name || `${user.first_name} ${user.last_name}`}</span>
                              </div>
                            </td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`badge badge-modern ${getRoleBadgeColor(user.role)}`}>
                                {user.role}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons action-buttons-modern" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  className="action-btn-edit action-btn-modern"
                                  onClick={() => handleEditUser(user)}
                                  data-bs-toggle="modal"
                                  data-bs-target="#editUserModal"
                                  title="Edit User"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button 
                                  className="action-btn-delete action-btn-modern"
                                  onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name}`)}
                                  title="Delete User"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedRows.has(user.id) && (
                            <tr className="expanded-details">
                              <td colSpan={6}>
                                <div className="item-details-grid">
                                  <div className="item-info-section">
                                    <div className="info-row">
                                      <div className="detail-item">
                                        <label>FIRST NAME:</label>
                                        <span>{user.first_name}</span>
                                      </div>
                                      <div className="detail-item">
                                        <label>MIDDLE NAME:</label>
                                        <span>{user.middle_name || '-'}</span>
                                      </div>
                                      <div className="detail-item">
                                        <label>LAST NAME:</label>
                                        <span>{user.last_name}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="info-row">
                                      <div className="detail-item">
                                        <label>EMAIL:</label>
                                        <span>{user.email}</span>
                                      </div>
                                      <div className="detail-item">
                                        <label>CONTACT NUMBER:</label>
                                        <span>{user.contact_number || '-'}</span>
                                      </div>
                                      <div className="detail-item">
                                        <label>ROLE:</label>
                                        <span>{user.role}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="info-row">
                                      <div className="detail-item">
                                        <label>ADDRESS:</label>
                                        <span>{user.address || '-'}</span>
                                      </div>
                                      <div className="detail-item">
                                        <label>BIRTHDAY:</label>
                                        <span>{user.birthday ? new Date(user.birthday).toLocaleDateString() : '-'}</span>
                                      </div>
                                      <div className="detail-item">
                                        {/* Empty space to maintain grid alignment */}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="item-photo-qr-section">
                                    <div className="photo-upload-area">
                                      <label>PROFILE PHOTO:</label>
                                      <div className="photo-display">
                                        {user.photo_path ? (
                                          <img 
                                            src={`${getApiBaseUrl()}/${user.photo_path}`}
                                            alt={user.full_name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none'
                                              e.currentTarget.nextElementSibling?.classList.remove('d-none')
                                            }}
                                          />
                                        ) : (
                                          <div className="photo-placeholder">
                                            <i className="bi bi-person-circle" style={{ fontSize: '48px', color: '#cbd5e1' }}></i>
                                            <span>No Photo</span>
                                          </div>
                                        )}
                                        <div className="photo-placeholder d-none">
                                          <i className="bi bi-person-circle" style={{ fontSize: '48px', color: '#cbd5e1' }}></i>
                                          <span>No Photo</span>
                                        </div>
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
                
                {/* Pagination Controls - Matching Inventory Style */}
                {filteredUsers.length > itemsPerPage && (
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
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
                    </div>
                    <div className="d-flex gap-2 align-items-center">
                      <button
                        className="btn-standard"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.9rem',
                          opacity: currentPage === 1 ? 0.5 : 1,
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <i className="bi bi-chevron-left me-1"></i>
                        Previous
                      </button>
                      <span style={{ 
                        padding: '8px 12px', 
                        color: 'var(--gray-700)',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                      }}>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className="btn-standard"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.9rem',
                          opacity: currentPage === totalPages ? 0.5 : 1,
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Next
                        <i className="bi bi-chevron-right ms-1"></i>
                      </button>
              </div>
            </div>
          )}
              </div>
            </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Add User Button - Matching Add Item Button Style */}
      <button
        className="add-item-btn"
        data-bs-toggle="modal"
        data-bs-target="#addUserModal"
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
        <i className="bi bi-plus-circle"></i> Add User
      </button>

      {/* Add User Modal */}
      <div className="modal fade" id="addUserModal" tabIndex={-1} aria-labelledby="addUserModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="addUserModalLabel">Add User</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">First Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Juan"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Last Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Dela Cruz"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Middle Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Santos"
                    value={formMiddleName}
                    onChange={(e) => setFormMiddleName(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email *</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="name@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Role *</label>
                  <select 
                    className="form-select"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as 'ADMIN' | 'TEACHER')}
                    required
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="TEACHER">Teacher</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Password *</label>
                  <div className="input-group">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="form-control" 
                      placeholder="••••••••"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                    />
                    <button 
                      className="btn btn-outline-secondary" 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Confirm Password *</label>
                  <div className="input-group">
                    <input 
                      type={showPasswordConfirm ? "text" : "password"}
                      className="form-control" 
                      placeholder="••••••••"
                      value={formPasswordConfirm}
                      onChange={(e) => setFormPasswordConfirm(e.target.value)}
                      required
                    />
                    <button 
                      className="btn btn-outline-secondary" 
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    >
                      <i className={`bi ${showPasswordConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Contact Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="09xxxxxxxxx"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Birthday</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={formBirthday}
                    onChange={(e) => setFormBirthday(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Address</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Street, City, Province"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Profile Photo</label>
                  <input 
                    ref={photoInputRef}
                    type="file" 
                    accept="image/*"
                    className="form-control"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <LoadingButton 
                type="button" 
                className="btn btn-primary"
                onClick={handleAddUser}
                isLoading={isSavingUser}
                label={isSavingUser ? 'Saving...' : 'Save'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      <div className="modal fade" id="editUserModal" tabIndex={-1} aria-labelledby="editUserModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="editUserModalLabel">Edit User</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">First Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Juan"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Last Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Dela Cruz"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Middle Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Santos"
                    value={editMiddleName}
                    onChange={(e) => setEditMiddleName(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email *</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="name@example.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Role *</label>
                  <select 
                    className="form-select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'ADMIN' | 'TEACHER')}
                    required
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="TEACHER">Teacher</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Password (leave blank to keep current)</label>
                  <div className="input-group">
                    <input 
                      type={showEditPassword ? "text" : "password"}
                      className="form-control" 
                      placeholder="••••••••"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                    />
                    <button 
                      className="btn btn-outline-secondary" 
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                    >
                      <i className={`bi ${showEditPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Confirm Password</label>
                  <div className="input-group">
                    <input 
                      type={showEditPasswordConfirm ? "text" : "password"}
                      className="form-control" 
                      placeholder="••••••••"
                      value={editPasswordConfirm}
                      onChange={(e) => setEditPasswordConfirm(e.target.value)}
                    />
                    <button 
                      className="btn btn-outline-secondary" 
                      type="button"
                      onClick={() => setShowEditPasswordConfirm(!showEditPasswordConfirm)}
                    >
                      <i className={`bi ${showEditPasswordConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Contact Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="09xxxxxxxxx"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Birthday</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={editBirthday}
                    onChange={(e) => setEditBirthday(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Address</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Street, City, Province"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Profile Photo (leave empty to keep current)</label>
                  <input 
                    ref={editPhotoInputRef}
                    type="file" 
                    accept="image/*"
                    className="form-control"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <LoadingButton 
                type="button" 
                className="btn btn-primary"
                onClick={handleUpdateUser}
                isLoading={isSavingUser}
                label={isSavingUser ? 'Updating...' : 'Update'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirm(false)
            setDeleteUserId(null)
            setDeleteUserName('')
          }
        }}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteUserName}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        type="delete"
        warningMessage="This action cannot be undone. All user data will be permanently removed."
        isLoading={isDeleting}
      />
    </div>
  )
}
