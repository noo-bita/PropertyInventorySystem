import React from 'react'

interface LoadingButtonProps {
  type?: 'button' | 'submit' | 'reset'
  className?: string
  onClick?: () => void
  isLoading?: boolean
  label?: string
  disabled?: boolean
  children?: React.ReactNode
}

export default function LoadingButton({
  type = 'button',
  className = '',
  onClick,
  isLoading = false,
  label,
  disabled = false,
  children
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          {label || 'Loading...'}
        </>
      ) : (
        children || label || 'Button'
      )}
    </button>
  )
}


