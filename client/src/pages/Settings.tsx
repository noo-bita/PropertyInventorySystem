import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import TeacherTopBar from '../components/TeacherTopBar'
import AdminTopBar from '../components/AdminTopBar'
import { apiFetch, getApiBaseUrl } from '../utils/api'
import { showNotification } from '../utils/notifications'
import '../css/global.css'
import '../css/settings.css'

export default function Settings() {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  
  // Profile Settings State
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
    contact_number: '',
    address: '',
    birthday: '',
    photo: null as File | null,
    photoPreview: '' as string | null
  })

  // Security Settings State
  const [securityData, setSecurityData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  // Notification Settings State
  const [notifications, setNotifications] = useState({
    newUser: true,
    inventory: true,
    requests: true
  })

  // Appearance Settings State
  const [appearance, setAppearance] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'Asia/Manila',
    dateFormat: 'MM/DD/YYYY'
  })

  // Budget Settings State
  const [budget, setBudget] = useState({
    total_budget: 0,
    total_spent: 0,
    remaining_balance: 0,
    percentage_used: 0
  })
  const [budgetLoading, setBudgetLoading] = useState(true)
  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false)
  const [editBudgetAmount, setEditBudgetAmount] = useState('')
  const [isEditingBudget, setIsEditingBudget] = useState(false)
  const [isRecalculatingBudget, setIsRecalculatingBudget] = useState(false)
  const [showResetBudgetModal, setShowResetBudgetModal] = useState(false)
  const [resetBudgetAmount, setResetBudgetAmount] = useState('')
  const [isResettingBudget, setIsResettingBudget] = useState(false)

  const tabs = [
    { id: 'profile', name: 'Profile Settings', icon: 'bi-person' },
    { id: 'security', name: 'Security', icon: 'bi-shield-lock' },
    { id: 'notifications', name: 'Notifications', icon: 'bi-bell' },
    { id: 'appearance', name: 'Appearance', icon: 'bi-palette' },
    ...(currentUser?.role === 'ADMIN' ? [{ id: 'budget', name: 'Budget', icon: 'bi-wallet2' }] : [])
  ]

  // Load user data on mount
  useEffect(() => {
    setLoading(true)
    loadUserData()
    loadSettingsFromStorage()
    if (currentUser?.role === 'ADMIN') {
      loadBudget()
    }
    
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [location.pathname, currentUser?.id])

  // Apply theme when appearance changes
  useEffect(() => {
    if (appearance.theme === 'dark') {
      document.body.classList.add('dark-theme')
      document.documentElement.classList.add('dark-theme')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.body.classList.remove('dark-theme')
      document.documentElement.classList.remove('dark-theme')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [appearance.theme])

  const loadUserData = async () => {
    if (!currentUser?.id) {
      setLoading(false)
      return
    }

    try {
      const response = await apiFetch(`/api/users/${currentUser.id}`)
      if (response.ok) {
        const userData = await response.json()
        setProfileData({
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          middle_name: userData.middle_name || '',
          email: userData.email || '',
          contact_number: userData.contact_number || '',
          address: userData.address || '',
          birthday: userData.birthday ? userData.birthday.split('T')[0] : '',
          photo: null,
          photoPreview: userData.profile_photo_url || userData.photo_path ? 
            (userData.profile_photo_url || `${getApiBaseUrl()}/${userData.photo_path}`) : null
        })
      }
    } catch (error) {
      console.error('Error loading user data:', error)
      showNotification('Failed to load user data', 'error')
    }
  }

  const loadSettingsFromStorage = () => {
    // Load notification preferences
    const savedNotifications = localStorage.getItem('notification_preferences')
    if (savedNotifications) {
      try {
        const savedData = JSON.parse(savedNotifications)
        // Only load notification types (filter out email, push, sms)
        setNotifications({
          newUser: savedData.newUser !== undefined ? savedData.newUser : true,
          inventory: savedData.inventory !== undefined ? savedData.inventory : true,
          requests: savedData.requests !== undefined ? savedData.requests : true
        })
      } catch (e) {
        console.error('Error loading notification preferences:', e)
      }
    }

    // Load appearance preferences
    const savedAppearance = localStorage.getItem('appearance_preferences')
    if (savedAppearance) {
      try {
        const appearanceData = JSON.parse(savedAppearance)
        setAppearance(appearanceData)
        // Apply theme immediately
        if (appearanceData.theme === 'dark') {
          document.body.classList.add('dark-theme')
          document.documentElement.classList.add('dark-theme')
          document.documentElement.setAttribute('data-theme', 'dark')
        } else {
          document.body.classList.remove('dark-theme')
          document.documentElement.classList.remove('dark-theme')
          document.documentElement.setAttribute('data-theme', 'light')
        }
      } catch (e) {
        console.error('Error loading appearance preferences:', e)
      }
    }
  }

  const handleProfileChange = (field: string, value: any) => {
    setProfileData(prev => ({ ...prev, [field]: value }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfileData(prev => ({
        ...prev,
        photo: file,
        photoPreview: URL.createObjectURL(file)
      }))
    }
  }

  const handleRemovePhoto = () => {
    setProfileData(prev => ({
      ...prev,
      photo: null,
      photoPreview: null
    }))
    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
  }

  const handleSecurityChange = (field: string, value: string) => {
    setSecurityData(prev => ({ ...prev, [field]: value }))
  }

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [field]: value }))
  }

  const handleAppearanceChange = (field: string, value: string) => {
    setAppearance(prev => {
      const updated = { ...prev, [field]: value }
      // If theme is being changed, apply it immediately
      if (field === 'theme') {
        if (value === 'dark') {
          document.body.classList.add('dark-theme')
          document.documentElement.classList.add('dark-theme')
          document.documentElement.setAttribute('data-theme', 'dark')
        } else {
          document.body.classList.remove('dark-theme')
          document.documentElement.classList.remove('dark-theme')
          document.documentElement.setAttribute('data-theme', 'light')
        }
        // Also save to localStorage immediately for persistence
        try {
          localStorage.setItem('appearance_preferences', JSON.stringify(updated))
        } catch (e) {
          console.error('Error saving theme preference:', e)
        }
      }
      return updated
    })
  }

  const saveProfileSettings = async () => {
    if (!currentUser?.id) {
      showNotification('User not found', 'error')
      return
    }

    if (!profileData.first_name.trim() || !profileData.last_name.trim() || !profileData.email.trim()) {
      showNotification('Please fill in all required fields', 'error')
      return
    }

    setSaving(true)

    try {
      const url = `${getApiBaseUrl()}/api/users/${currentUser.id}`
      const hasFile = profileData.photo
      const token = localStorage.getItem('api_token')

      if (hasFile) {
        const formData = new FormData()
        formData.append('first_name', profileData.first_name)
        formData.append('last_name', profileData.last_name)
        formData.append('middle_name', profileData.middle_name || '')
        formData.append('email', profileData.email)
        formData.append('role', currentUser.role || 'ADMIN')
        formData.append('contact_number', profileData.contact_number || '')
        formData.append('address', profileData.address || '')
        formData.append('birthday', profileData.birthday || '')
        if (profileData.photo) {
          formData.append('photo', profileData.photo)
        }
        formData.append('_method', 'PUT')

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: formData
        })

        if (response.ok) {
          const updatedUser = await response.json()
          showNotification('Profile updated successfully!', 'success')
          // Update photo preview if available
          if (updatedUser.profile_photo_url) {
            setProfileData(prev => ({ ...prev, photoPreview: updatedUser.profile_photo_url }))
          }
          // Reload user data to get updated info
          await loadUserData()
        } else {
          const errorText = await response.text()
          let errorMessage = 'Failed to update profile'
          try {
            const errorJson = JSON.parse(errorText)
            if (errorJson.errors) {
              const errorMessages = Object.values(errorJson.errors).flat()
              errorMessage = errorMessages.join(', ')
            } else if (errorJson.message) {
              errorMessage = errorJson.message
            }
          } catch {
            errorMessage = errorText || 'Failed to update profile'
          }
          showNotification(errorMessage, 'error')
        }
      } else {
        const updateData: any = {
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          email: profileData.email,
          role: currentUser.role || 'ADMIN',
          _method: 'PUT'
        }
        
        if (profileData.middle_name) updateData.middle_name = profileData.middle_name
        if (profileData.contact_number) updateData.contact_number = profileData.contact_number
        if (profileData.address) updateData.address = profileData.address
        if (profileData.birthday) updateData.birthday = profileData.birthday

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify(updateData)
        })

        if (response.ok) {
          await response.json()
          showNotification('Profile updated successfully!', 'success')
          // Reload user data to get updated info
          await loadUserData()
        } else {
          const errorText = await response.text()
          let errorMessage = 'Failed to update profile'
          try {
            const errorJson = JSON.parse(errorText)
            if (errorJson.errors) {
              const errorMessages = Object.values(errorJson.errors).flat()
              errorMessage = errorMessages.join(', ')
            } else if (errorJson.message) {
              errorMessage = errorJson.message
            }
          } catch {
            errorMessage = errorText || 'Failed to update profile'
          }
          showNotification(errorMessage, 'error')
        }
      }
    } catch (error: any) {
      console.error('Error updating profile:', error)
      showNotification(error?.message || 'Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveSecuritySettings = async () => {
    if (!currentUser?.id) {
      showNotification('User not found', 'error')
      return
    }

    if (!securityData.current_password || !securityData.new_password || !securityData.confirm_password) {
      showNotification('Please fill in all password fields', 'error')
      return
    }

    if (securityData.new_password !== securityData.confirm_password) {
      showNotification('New passwords do not match', 'error')
      return
    }

    if (securityData.new_password.length < 8) {
      showNotification('Password must be at least 8 characters long', 'error')
      return
    }

    // Verify current password first
    try {
      const loginResponse = await fetch(`${getApiBaseUrl()}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileData.email || currentUser.email,
          password: securityData.current_password
        })
      })

      if (!loginResponse.ok) {
        showNotification('Current password is incorrect', 'error')
        return
      }

      // Update password
      setSaving(true)
      const response = await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          middle_name: profileData.middle_name || '',
          email: profileData.email,
          role: currentUser.role || 'ADMIN',
          password: securityData.new_password,
          password_confirmation: securityData.confirm_password
        })
      })

      if (response.ok) {
        showNotification('Password updated successfully!', 'success')
        setSecurityData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
      } else {
        const error = await response.json()
        showNotification(error.message || 'Failed to update password', 'error')
      }
    } catch (error) {
      console.error('Error updating password:', error)
      showNotification('Failed to update password', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveNotificationSettings = () => {
    try {
      localStorage.setItem('notification_preferences', JSON.stringify(notifications))
      showNotification('Notification preferences saved!', 'success')
    } catch (error) {
      console.error('Error saving notification preferences:', error)
      showNotification('Failed to save notification preferences', 'error')
    }
  }

  const saveAppearanceSettings = () => {
    try {
      localStorage.setItem('appearance_preferences', JSON.stringify(appearance))
      showNotification('Appearance preferences saved!', 'success')
      
      // Apply theme immediately
      if (appearance.theme === 'dark') {
        document.body.classList.add('dark-theme')
        document.documentElement.classList.add('dark-theme')
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.body.classList.remove('dark-theme')
        document.documentElement.classList.remove('dark-theme')
        document.documentElement.setAttribute('data-theme', 'light')
      }
    } catch (error) {
      console.error('Error saving appearance preferences:', error)
      showNotification('Failed to save appearance preferences', 'error')
    }
  }

  // Budget Functions
  const loadBudget = async () => {
    try {
      setBudgetLoading(true)
      const response = await apiFetch('/api/budget')
      if (response.ok) {
        const data = await response.json()
        setBudget(data)
      } else {
        setBudget({
          total_budget: 0,
          total_spent: 0,
          remaining_balance: 0,
          percentage_used: 0
        })
      }
    } catch (error) {
      console.error('Error fetching budget:', error)
      setBudget({
        total_budget: 0,
        total_spent: 0,
        remaining_balance: 0,
        percentage_used: 0
      })
    } finally {
      setBudgetLoading(false)
    }
  }

  const handleEditBudget = async () => {
    if (!editBudgetAmount || parseFloat(editBudgetAmount) < 0) {
      showNotification('Please enter a valid budget amount', 'error')
      return
    }

    setIsEditingBudget(true)
    try {
      const response = await apiFetch('/api/budget', {
        method: 'POST',
        body: JSON.stringify({
          total_budget: parseFloat(editBudgetAmount)
        })
      })

      const data = await response.json()

      if (response.ok) {
        if (data.budget) {
          setBudget({
            total_budget: data.budget.total_budget,
            total_spent: data.budget.total_spent,
            remaining_balance: data.budget.remaining_balance,
            percentage_used: data.budget.percentage_used || 0
          })
        }
        setShowEditBudgetModal(false)
        setEditBudgetAmount('')
        showNotification(data.message || 'Budget updated successfully!', 'success')
        await loadBudget()
      } else {
        let errorMessage = data.error || 'Failed to update budget'
        if (data.message) {
          errorMessage = data.message
        } else if (data.errors) {
          const firstError = Object.values(data.errors)[0]
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
        }
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error updating budget:', error)
      showNotification(error.message || 'Error updating budget. Please try again.', 'error')
    } finally {
      setIsEditingBudget(false)
    }
  }

  const handleRecalculateBudget = async () => {
    setIsRecalculatingBudget(true)
    try {
      const response = await apiFetch('/api/budget/recalculate', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        if (data.budget) {
          setBudget({
            total_budget: data.budget.total_budget,
            total_spent: data.budget.total_spent,
            remaining_balance: data.budget.remaining_balance,
            percentage_used: data.budget.percentage_used || 0
          })
        }
        showNotification(data.message || 'Budget recalculated successfully!', 'success')
        await loadBudget()
      } else {
        let errorMessage = data.error || 'Failed to recalculate budget'
        if (data.message) {
          errorMessage = data.message
        } else if (data.errors) {
          const firstError = Object.values(data.errors)[0]
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
        }
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error recalculating budget:', error)
      showNotification(error.message || 'Error recalculating budget. Please try again.', 'error')
    } finally {
      setIsRecalculatingBudget(false)
    }
  }

  const handleResetBudget = async () => {
    if (resetBudgetAmount && parseFloat(resetBudgetAmount) < 0) {
      showNotification('Please enter a valid budget amount', 'error')
      return
    }

    setIsResettingBudget(true)
    try {
      const requestBody: any = {}
      if (resetBudgetAmount && resetBudgetAmount.trim() !== '') {
        requestBody.total_budget = parseFloat(resetBudgetAmount)
      }

      const response = await apiFetch('/api/budget/reset', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (response.ok) {
        if (data.budget) {
          setBudget({
            total_budget: data.budget.total_budget,
            total_spent: data.budget.total_spent,
            remaining_balance: data.budget.remaining_balance,
            percentage_used: data.budget.percentage_used || 0
          })
        }
        setShowResetBudgetModal(false)
        setResetBudgetAmount('')
        showNotification(data.message || 'Budget reset successfully!', 'success')
        await loadBudget()
      } else {
        let errorMessage = data.error || 'Failed to reset budget'
        if (data.message) {
          errorMessage = data.message
        } else if (data.errors) {
          const firstError = Object.values(data.errors)[0]
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
        }
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error resetting budget:', error)
      showNotification(error.message || 'Error resetting budget. Please try again.', 'error')
    } finally {
      setIsResettingBudget(false)
    }
  }

  const handleSave = () => {
    switch (activeTab) {
      case 'profile':
        saveProfileSettings()
        break
      case 'security':
        saveSecuritySettings()
        break
      case 'notifications':
        saveNotificationSettings()
        break
      case 'appearance':
        saveAppearanceSettings()
        break
      default:
        break
    }
  }

  const renderProfileSettings = () => (
    <div className="settings-content">
      <div className="standard-card" style={{ marginBottom: '24px' }}>
        <div className="standard-card-header">
          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dark)' }}>
            Personal Information
          </h4>
        </div>
        <div className="standard-card-body">
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                First Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={profileData.first_name}
                onChange={(e) => handleProfileChange('first_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Last Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={profileData.last_name}
                onChange={(e) => handleProfileChange('last_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Middle Name
              </label>
              <input
                type="text"
                className="form-control"
                value={profileData.middle_name}
                onChange={(e) => handleProfileChange('middle_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Email <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="email"
                className="form-control"
                value={profileData.email}
                onChange={(e) => handleProfileChange('email', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Phone Number
              </label>
              <input
                type="tel"
                className="form-control"
                value={profileData.contact_number}
                onChange={(e) => handleProfileChange('contact_number', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Birthday
              </label>
              <input
                type="date"
                className="form-control"
                value={profileData.birthday}
                onChange={(e) => handleProfileChange('birthday', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Address
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={profileData.address}
                onChange={(e) => handleProfileChange('address', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="standard-card">
        <div className="standard-card-header">
          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dark)' }}>
            Profile Photo
          </h4>
        </div>
        <div className="standard-card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: 'var(--gray-100)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid var(--gray-200)'
            }}>
              {profileData.photoPreview ? (
                <img
                  src={profileData.photoPreview}
                  alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <i className="bi bi-person-circle" style={{ fontSize: '80px', color: '#cbd5e1' }}></i>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="btn-standard btn-primary"
                style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto' }}
              >
                <i className="bi bi-upload"></i> Upload Photo
              </label>
              {profileData.photoPreview && (
                <button
                  className="btn-standard"
                  style={{ backgroundColor: 'var(--gray-200)', color: 'var(--text-dark)' }}
                  onClick={handleRemovePhoto}
                >
                  <i className="bi bi-trash"></i> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="settings-content">
      <div className="standard-card">
        <div className="standard-card-header">
          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dark)' }}>
            Change Password
          </h4>
        </div>
        <div className="standard-card-body">
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', maxWidth: '500px' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Current Password <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter current password"
                value={securityData.current_password}
                onChange={(e) => handleSecurityChange('current_password', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                New Password <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter new password (min. 8 characters)"
                value={securityData.new_password}
                onChange={(e) => handleSecurityChange('new_password', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: 'var(--text-dark)' }}>
                Confirm New Password <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Confirm new password"
                value={securityData.confirm_password}
                onChange={(e) => handleSecurityChange('confirm_password', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="settings-content">
      <div className="standard-card">
        <div className="standard-card-header">
          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dark)' }}>
            Notification Types
          </h4>
        </div>
        <div className="standard-card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {currentUser?.role === 'ADMIN' && (
              <div className="notification-card" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: '8px',
                border: '1px solid var(--gray-200)'
              }}>
                <div>
                  <h6 style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'var(--text-dark)' }}>
                    New User Registration
                  </h6>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--gray-600)' }}>
                    When a new user registers
                  </p>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="newUserNotif"
                    checked={notifications.newUser}
                    onChange={(e) => handleNotificationChange('newUser', e.target.checked)}
                    style={{ width: '48px', height: '24px', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            <div className="notification-card" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: 'var(--gray-50)',
              borderRadius: '8px',
              border: '1px solid var(--gray-200)'
            }}>
              <div>
                <h6 style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'var(--text-dark)' }}>
                  Inventory Updates
                </h6>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--gray-600)' }}>
                  When inventory items are modified
                </p>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="inventoryNotif"
                  checked={notifications.inventory}
                  onChange={(e) => handleNotificationChange('inventory', e.target.checked)}
                  style={{ width: '48px', height: '24px', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div className="notification-card" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              backgroundColor: 'var(--gray-50)',
              borderRadius: '8px',
              border: '1px solid var(--gray-200)'
            }}>
              <div>
                <h6 style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'var(--text-dark)' }}>
                  Request Updates
                </h6>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--gray-600)' }}>
                  When requests are approved/rejected
                </p>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="requestNotif"
                  checked={notifications.requests}
                  onChange={(e) => handleNotificationChange('requests', e.target.checked)}
                  style={{ width: '48px', height: '24px', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAppearanceSettings = () => (
    <div className="settings-content">
      <div className="standard-card" style={{ marginBottom: '24px' }}>
        <div className="standard-card-header">
          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dark)' }}>
            Theme Settings
          </h4>
        </div>
        <div className="standard-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', maxWidth: '600px' }}>
            <div className="theme-selection-card" style={{
              padding: '20px',
              border: `2px solid ${appearance.theme === 'light' ? 'var(--primary)' : 'var(--gray-300)'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              backgroundColor: appearance.theme === 'light' ? 'var(--primary-light)' : 'var(--card-bg)',
              transition: 'all 0.2s'
            }}
            onClick={() => handleAppearanceChange('theme', 'light')}
            >
              <div style={{
                height: '80px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                marginBottom: '12px',
                border: '1px solid var(--gray-200)'
              }}>
                <div style={{
                  height: '20px',
                  backgroundColor: '#f1f5f9',
                  borderBottom: '1px solid var(--gray-200)'
                }}></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <h6 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-dark)' }}>
                  Light Theme
                </h6>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--gray-600)' }}>
                  Default light appearance
                </p>
              </div>
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <input
                  type="radio"
                  name="theme"
                  checked={appearance.theme === 'light'}
                  onChange={() => handleAppearanceChange('theme', 'light')}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </div>

            <div className="theme-selection-card" style={{
              padding: '20px',
              border: `2px solid ${appearance.theme === 'dark' ? 'var(--primary)' : 'var(--gray-300)'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              backgroundColor: appearance.theme === 'dark' ? 'var(--primary-light)' : 'var(--card-bg)',
              transition: 'all 0.2s'
            }}
            onClick={() => handleAppearanceChange('theme', 'dark')}
            >
              <div style={{
                height: '80px',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                marginBottom: '12px',
                border: '1px solid var(--gray-700)'
              }}>
                <div style={{
                  height: '20px',
                  backgroundColor: '#0f172a',
                  borderBottom: '1px solid var(--gray-700)'
                }}></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <h6 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-dark)' }}>
                  Dark Theme
                </h6>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--gray-600)' }}>
                  Dark mode for low light
                </p>
              </div>
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <input
                  type="radio"
                  name="theme"
                  checked={appearance.theme === 'dark'}
                  onChange={() => handleAppearanceChange('theme', 'dark')}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderBudgetSettings = () => (
    <div className="settings-content">
      <div className="standard-card" style={{ marginBottom: '24px' }}>
        <div className="standard-card-header">
          <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dark)' }}>
            <i className="bi bi-wallet2" style={{ marginRight: '0.5rem', color: '#16a34a' }}></i>
            Budget Management
          </h4>
        </div>
        <div className="standard-card-body">
          {budgetLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loading-spinner"></div>
              <p style={{ marginTop: '1rem', color: 'var(--gray-600)' }}>Loading budget data...</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)'
                }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>Total Budget</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#16a34a' }}>
                    ₱{budget.total_budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)'
                }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>Total Spent</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#ef4444' }}>
                    ₱{budget.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)'
                }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>Remaining Balance</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#3b82f6' }}>
                    ₱{budget.remaining_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  border: '1px solid var(--gray-200)'
                }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '0.5rem' }}>Percentage Used</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: budget.percentage_used > 80 ? '#ef4444' : budget.percentage_used > 60 ? '#f59e0b' : '#16a34a' }}>
                    {budget.percentage_used.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-standard"
                  onClick={handleRecalculateBudget}
                  disabled={isRecalculatingBudget}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    opacity: isRecalculatingBudget ? 0.6 : 1,
                    cursor: isRecalculatingBudget ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isRecalculatingBudget ? (
                    <>
                      <span className="spinner-border spinner-border-sm" style={{ marginRight: '0.5rem' }}></span>
                      Recalculating...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise"></i> Recalculate
                    </>
                  )}
                </button>
                <button
                  className="btn-standard"
                  onClick={() => {
                    setEditBudgetAmount(budget.total_budget.toString())
                    setShowEditBudgetModal(true)
                  }}
                  style={{
                    backgroundColor: '#16a34a',
                    color: 'white',
                    border: 'none'
                  }}
                >
                  <i className="bi bi-pencil"></i> Edit Budget
                </button>
                <button
                  className="btn-standard"
                  onClick={() => {
                    setResetBudgetAmount('')
                    setShowResetBudgetModal(true)
                  }}
                  disabled={isResettingBudget}
                  style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    opacity: isResettingBudget ? 0.6 : 1,
                    cursor: isResettingBudget ? 'not-allowed' : 'pointer'
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise"></i> Reset Budget
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileSettings()
      case 'security':
        return renderSecuritySettings()
      case 'notifications':
        return renderNotificationSettings()
      case 'appearance':
        return renderAppearanceSettings()
      case 'budget':
        return renderBudgetSettings()
      default:
        return renderProfileSettings()
    }
  }

  return (
    <div className="dashboard-container">
      <Sidebar />
      
      <main className="main-content">
        {currentUser?.role === 'ADMIN' ? (
          <AdminTopBar 
            searchPlaceholder="Search settings..." 
            currentUser={currentUser}
            hideSearch={true}
          />
        ) : (
          <TeacherTopBar 
            searchPlaceholder="Search settings..." 
            currentUser={currentUser || undefined}
            hideSearch={true}
          />
        )}
        
        {/* Loading overlay - only covers main content, sidebar remains visible */}
        {loading && (
          <div className="main-content-loading">
            <div className="full-screen-spinner">
              <div className="loading-spinner-large"></div>
              <p style={{ marginTop: 'var(--space-4)', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                Loading settings...
              </p>
            </div>
          </div>
        )}
        
        {!loading && (
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h1 className="dashboard-title">Settings</h1>
              <p className="dashboard-subtitle">Manage your account preferences and system settings</p>
            </div>

            <div className="settings-container">
              {/* Settings Tabs */}
              <div className="settings-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <i className={tab.icon}></i>
                    <span>{tab.name}</span>
                  </button>
                ))}
              </div>

              {/* Settings Content */}
              <div className="settings-main">
                {renderTabContent()}
                
                {/* Save Button */}
                <div className="settings-actions" style={{
                  marginTop: '32px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--gray-200)',
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    className="btn-standard btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm" style={{ marginRight: '8px' }}></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check"></i> Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Budget Modal */}
        {showEditBudgetModal && (
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
            onClick={() => setShowEditBudgetModal(false)}
          >
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '450px',
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="bi bi-wallet2" style={{ color: '#16a34a' }}></i>
                  Edit School Budget
                </h3>
                <button
                  onClick={() => {
                    setShowEditBudgetModal(false)
                    setEditBudgetAmount('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    color: '#6b7280',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', color: '#374151', fontSize: '0.875rem' }}>
                  Total Budget Amount
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#16a34a',
                    fontWeight: '700',
                    fontSize: '1.125rem',
                    zIndex: 1
                  }}>
                    ₱
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editBudgetAmount}
                    onChange={(e) => setEditBudgetAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleEditBudget()
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem 0.875rem 2.75rem',
                      border: '2px solid #16a34a',
                      borderRadius: '8px',
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      backgroundColor: '#f0fdf4',
                      color: '#1e293b',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.1)'
                    }}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  Enter the total budget amount for the school
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowEditBudgetModal(false)
                    setEditBudgetAmount('')
                  }}
                  disabled={isEditingBudget}
                  style={{
                    padding: '0.625rem 1.25rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#374151',
                    cursor: isEditingBudget ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    opacity: isEditingBudget ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditBudget}
                  disabled={isEditingBudget}
                  style={{
                    padding: '0.625rem 1.5rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: isEditingBudget ? '#9ca3af' : '#16a34a',
                    color: 'white',
                    cursor: isEditingBudget ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isEditingBudget ? (
                    <>
                      <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle"></i>
                      Save Budget
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Budget Modal */}
        {showResetBudgetModal && (
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
            onClick={() => setShowResetBudgetModal(false)}
          >
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ 
                  margin: 0, 
                  marginBottom: '0.5rem', 
                  fontSize: '1.5rem', 
                  fontWeight: '600',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <i className="bi bi-arrow-counterclockwise" style={{ color: '#ef4444' }}></i>
                  Reset Budget
                </h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                  This will clear the total spent amount. You can optionally set a new budget amount.
                </p>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontSize: '0.875rem', 
                  fontWeight: '500',
                  color: '#374151'
                }}>
                  New Budget Amount (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={resetBudgetAmount}
                  onChange={(e) => setResetBudgetAmount(e.target.value)}
                  disabled={isResettingBudget}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #ef4444',
                    borderRadius: '8px',
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    backgroundColor: '#fef2f2',
                    color: '#1e293b',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)'
                  }}
                  placeholder="Leave empty to keep current budget"
                  autoFocus
                />
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  Leave empty to keep the current budget amount. Total spent will be reset to ₱0.00.
                </p>
              </div>

              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#fef2f2', 
                borderRadius: '8px', 
                marginBottom: '1.5rem',
                border: '1px solid #fecaca'
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#991b1b', fontWeight: '500' }}>
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Warning: This action will reset total spent to ₱0.00. This cannot be undone.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowResetBudgetModal(false)
                    setResetBudgetAmount('')
                  }}
                  disabled={isResettingBudget}
                  style={{
                    padding: '0.625rem 1.25rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#374151',
                    cursor: isResettingBudget ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    opacity: isResettingBudget ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetBudget}
                  disabled={isResettingBudget}
                  style={{
                    padding: '0.625rem 1.5rem',
                    border: 'none',
                    borderRadius: '8px',
                    background: isResettingBudget ? '#9ca3af' : '#ef4444',
                    color: 'white',
                    cursor: isResettingBudget ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isResettingBudget ? (
                    <>
                      <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle"></i>
                      Reset Budget
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
