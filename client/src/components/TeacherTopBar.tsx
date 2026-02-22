import React, { useState } from 'react'
import NotificationDropdown from './NotificationDropdown'

interface TeacherTopBarProps {
  searchPlaceholder?: string
  rightContent?: React.ReactNode
  currentUser?: { name: string; role: string }
  hideSearch?: boolean
  onSearch?: (searchTerm: string) => void
  searchValue?: string
}

/**
 * Teacher TopBar Component
 * 
 * Modern topbar with optional search functionality
 * - Sticky positioning for better UX
 * - Responsive design
 * - Clean, minimalist styling
 */
export default function TeacherTopBar({ 
  searchPlaceholder = "Search...", 
  rightContent, 
  currentUser,
  hideSearch = false,
  onSearch,
  searchValue
}: TeacherTopBarProps) {
  const [searchTerm, setSearchTerm] = useState(searchValue || '')

  // Sync with parent searchValue if provided
  React.useEffect(() => {
    if (searchValue !== undefined) {
      setSearchTerm(searchValue)
    }
  }, [searchValue])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    if (onSearch) {
      onSearch(value)
    }
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    if (onSearch) {
      onSearch('')
    }
  }

  return (
    <header className="top-bar top-bar-sticky">
      {/* Search bar - can be hidden via hideSearch prop */}
      {!hideSearch && (
        <div className="search-bar" style={{ position: 'relative', flex: 1, maxWidth: '600px' }}>
          <input 
            type="text" 
            className="search-input" 
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={handleSearchChange}
          />
        <i className="bi bi-search search-icon"></i>
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '40px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--gray-500)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Clear search"
            >
              <i className="bi bi-x-circle" style={{ fontSize: '18px' }}></i>
            </button>
          )}
      </div>
      )}
      <div className="d-flex align-items-center gap-3" style={{ marginLeft: hideSearch ? 'auto' : '0' }}>
        {currentUser && (
          <NotificationDropdown currentUser={currentUser} />
        )}
        {rightContent}
      </div>
    </header>
  )
}
