import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../utils/api'
import { showNotification } from '../utils/notifications'

interface BudgetData {
  total_budget: number
  total_spent: number
  remaining_balance: number
  percentage_used: number
}

interface BudgetWidgetProps {
  onBudgetUpdate?: () => void
}

export default function BudgetWidget({ onBudgetUpdate }: BudgetWidgetProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [budget, setBudget] = useState<BudgetData>({
    total_budget: 0,
    total_spent: 0,
    remaining_balance: 0,
    percentage_used: 0
  })
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetBudgetAmount, setResetBudgetAmount] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    fetchBudget()
  }, [])

  const fetchBudget = async () => {
    try {
      setLoading(true)
      const response = await apiFetch('/api/budget')
      if (response.ok) {
        const data = await response.json()
        setBudget(data)
      } else {
        // If budget doesn't exist yet, show zeros
        setBudget({
          total_budget: 0,
          total_spent: 0,
          remaining_balance: 0,
          percentage_used: 0
        })
      }
    } catch (error) {
      console.error('Error fetching budget:', error)
      // Set default values on error
      setBudget({
        total_budget: 0,
        total_spent: 0,
        remaining_balance: 0,
        percentage_used: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditBudget = async () => {
    if (!editAmount || parseFloat(editAmount) < 0) {
      showNotification('Please enter a valid budget amount', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await apiFetch('/api/budget', {
        method: 'PUT',
        body: JSON.stringify({ total_budget: parseFloat(editAmount) })
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
        setShowEditModal(false)
        setEditAmount('')
        showNotification(data.message || 'Budget updated successfully!', 'success')
        if (onBudgetUpdate) {
          onBudgetUpdate()
        }
        // Refresh budget data
        await fetchBudget()
      } else {
        // Handle validation errors
        let errorMessage = data.error || 'Failed to update budget'
        if (data.message) {
          errorMessage = data.message
        } else if (data.errors) {
          // Laravel validation errors
          const firstError = Object.values(data.errors)[0]
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
        }
        console.error('Budget update error:', data)
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error updating budget:', error)
      showNotification(error.message || 'Error updating budget. Please try again.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecalculate = async () => {
    setIsRecalculating(true)
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
        if (onBudgetUpdate) {
          onBudgetUpdate()
        }
        // Refresh budget data
        await fetchBudget()
      } else {
        let errorMessage = data.error || 'Failed to recalculate budget'
        if (data.message) {
          errorMessage = data.message
        } else if (data.errors) {
          const firstError = Object.values(data.errors)[0]
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
        }
        console.error('Budget recalculation error:', data)
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error recalculating budget:', error)
      showNotification(error.message || 'Error recalculating budget. Please try again.', 'error')
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleReset = async () => {
    if (resetBudgetAmount && parseFloat(resetBudgetAmount) < 0) {
      showNotification('Please enter a valid budget amount', 'error')
      return
    }

    setIsResetting(true)
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
        setShowResetModal(false)
        setResetBudgetAmount('')
        showNotification(data.message || 'Budget reset successfully!', 'success')
        if (onBudgetUpdate) {
          onBudgetUpdate()
        }
        // Refresh budget data
        await fetchBudget()
      } else {
        let errorMessage = data.error || 'Failed to reset budget'
        if (data.message) {
          errorMessage = data.message
        } else if (data.errors) {
          const firstError = Object.values(data.errors)[0]
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
        }
        console.error('Budget reset error:', data)
        showNotification(errorMessage, 'error')
      }
    } catch (error: any) {
      console.error('Error resetting budget:', error)
      showNotification(error.message || 'Error resetting budget. Please try again.', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  const isLowBudget = budget.remaining_balance < (budget.total_budget * 0.2) && budget.total_budget > 0
  const isCriticalBudget = budget.remaining_balance < (budget.total_budget * 0.1) && budget.total_budget > 0

  return (
    <>
      <div className={`standard-card budget-widget ${isCriticalBudget ? 'budget-critical' : isLowBudget ? 'budget-low' : ''}`}>
        <div className="standard-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="standard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="bi bi-wallet2" style={{ fontSize: '1.25rem', color: '#16a34a' }}></i>
            School Budget
          </h3>
        </div>
        <div className="standard-card-body">
          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner"></div>
              <p className="mt-2">Loading budget...</p>
            </div>
          ) : (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                {/* Total Budget Card */}
                <div className="budget-stat-card budget-stat-card--success">
                  <div className="budget-stat-label">
                    TOTAL BUDGET
                  </div>
                  <div className="budget-stat-value budget-stat-value--default">
                    ₱{budget.total_budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Total Spent Card */}
                <div className="budget-stat-card budget-stat-card--danger">
                  <div className="budget-stat-label">
                    TOTAL SPENT
                  </div>
                  <div className="budget-stat-value budget-stat-value--danger">
                    ₱{budget.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Remaining Balance Card */}
                <div
                  className={[
                    'budget-stat-card',
                    isCriticalBudget
                      ? 'budget-stat-card--danger'
                      : isLowBudget
                        ? 'budget-stat-card--warning'
                        : 'budget-stat-card--success'
                  ].join(' ')}
                >
                  <div className="budget-stat-label">
                    REMAINING BALANCE
                  </div>
                  <div
                    className={[
                      'budget-stat-value',
                      isCriticalBudget
                        ? 'budget-stat-value--danger'
                        : isLowBudget
                          ? 'budget-stat-value--warning'
                          : 'budget-stat-value--success'
                    ].join(' ')}
                  >
                    ₱{budget.remaining_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
                
                {/* Progress Bar */}
                {budget.total_budget > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'var(--gray-600)'
                    }}>
                      <span>Budget Usage</span>
                      <span>{budget.percentage_used.toFixed(1)}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '12px',
                      backgroundColor: 'var(--gray-200)',
                      borderRadius: '6px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(budget.percentage_used, 100)}%`,
                        height: '100%',
                        backgroundColor: isCriticalBudget ? '#ef4444' : isLowBudget ? '#f59e0b' : '#16a34a',
                        transition: 'width 0.3s ease, background-color 0.3s ease',
                        borderRadius: '6px'
                      }}></div>
                    </div>
                  </div>
                )}

                {/* Warning Messages */}
                {isCriticalBudget && budget.total_budget > 0 && (
                  <div className="budget-alert budget-alert--critical">
                    <i className="bi bi-exclamation-triangle-fill budget-alert-icon"></i>
                    <span>
                      <strong>Critical:</strong> Budget is running low! Only {budget.percentage_used.toFixed(1)}% remaining.
                    </span>
                  </div>
                )}
                {isLowBudget && !isCriticalBudget && budget.total_budget > 0 && (
                  <div className="budget-alert budget-alert--warning">
                    <i className="bi bi-exclamation-circle-fill budget-alert-icon"></i>
                    <span>
                      <strong>Warning:</strong> Budget is below 20%. Consider reviewing expenses.
                    </span>
                  </div>
                )}
            </>
          )}
        </div>
      </div>

      {/* Edit Budget Modal */}
      {showEditModal && (
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
          onClick={() => setShowEditModal(false)}
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
                  setShowEditModal(false)
                  setEditAmount('')
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
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
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
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#15803d'
                    e.currentTarget.style.backgroundColor = '#ffffff'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.2)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#16a34a'
                    e.currentTarget.style.backgroundColor = '#f0fdf4'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.1)'
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
                  setShowEditModal(false)
                  setEditAmount('')
                }}
                disabled={isSubmitting}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                    e.currentTarget.style.borderColor = '#9ca3af'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditBudget}
                disabled={isSubmitting}
                style={{
                  padding: '0.625rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: isSubmitting ? '#9ca3af' : '#16a34a',
                  color: 'white',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = '#15803d'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.currentTarget.style.backgroundColor = '#16a34a'
                  }
                }}
              >
                {isSubmitting ? (
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
      {showResetModal && (
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
          onClick={() => setShowResetModal(false)}
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
                disabled={isResetting}
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
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#dc2626'
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#ef4444'
                  e.currentTarget.style.backgroundColor = '#fef2f2'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)'
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
                  setShowResetModal(false)
                  setResetBudgetAmount('')
                }}
                disabled={isResetting}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  opacity: isResetting ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isResetting) {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                    e.currentTarget.style.borderColor = '#9ca3af'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isResetting) {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                style={{
                  padding: '0.625rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: isResetting ? '#9ca3af' : '#ef4444',
                  color: 'white',
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (!isResetting) {
                    e.currentTarget.style.backgroundColor = '#dc2626'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isResetting) {
                    e.currentTarget.style.backgroundColor = '#ef4444'
                  }
                }}
              >
                {isResetting ? (
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
    </>
  )
}

