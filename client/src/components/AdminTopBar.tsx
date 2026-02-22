import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import AdminNotificationDropdown from './AdminNotificationDropdown'
import AdminQrScanner from './AdminQrScanner'

interface AdminTopBarProps {
  searchPlaceholder?: string
  rightContent?: React.ReactNode
  currentUser?: { name: string; role: string }
  onSearch?: (searchTerm: string) => void
  hideSearch?: boolean
  searchValue?: string
}

export default function AdminTopBar({ 
  searchPlaceholder = "Search...", 
  rightContent, 
  currentUser,
  onSearch,
  hideSearch = false,
  searchValue
}: AdminTopBarProps) {
  // Always start with empty string, never allow email in initial state
  const [searchTerm, setSearchTerm] = useState(() => {
    // Filter out any email values from initial state
    if (searchValue && !searchValue.includes('@')) {
      return searchValue
    }
    return ''
  })
  const [showQRScanner, setShowQRScanner] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const inputIdRef = useRef(`search-input-${Math.random().toString(36).substr(2, 9)}`)
  
  // Immediate clear on first render - before any effects run
  if (typeof window !== 'undefined') {
    // Use a microtask to clear immediately after render
    Promise.resolve().then(() => {
      if (searchInputRef.current) {
        const val = searchInputRef.current.value
        if (val && val.includes('@')) {
          searchInputRef.current.value = ''
          searchInputRef.current.setAttribute('value', '')
        }
      }
    })
  }

  // Sync with parent searchValue if provided - but filter out emails
  useEffect(() => {
    // Only sync if searchValue doesn't look like an email
    if (searchValue && !searchValue.includes('@')) {
      setSearchTerm(searchValue)
    } else if (!searchValue) {
      setSearchTerm('')
    }
  }, [searchValue])

  // Use layout effect to clear BEFORE browser paints (synchronous)
  useLayoutEffect(() => {
    if (searchInputRef.current) {
      const currentValue = searchInputRef.current.value
      if (currentValue && currentValue.includes('@')) {
        searchInputRef.current.value = ''
        searchInputRef.current.setAttribute('value', '')
        searchInputRef.current.removeAttribute('data-autofilled')
        setSearchTerm('')
        if (onSearch) {
          onSearch('')
        }
      }
    }
  })

  // Aggressive autofill prevention - clear on mount and continuously monitor
  useEffect(() => {
    const clearEmailAutofill = () => {
      if (searchInputRef.current) {
        const currentValue = searchInputRef.current.value
        // If it looks like an email, clear it immediately
        if (currentValue && currentValue.includes('@')) {
          searchInputRef.current.value = ''
          searchInputRef.current.setAttribute('value', '')
          searchInputRef.current.removeAttribute('data-autofilled')
          setSearchTerm('')
          if (onSearch) {
            onSearch('')
          }
        }
      }
    }

    // Use requestAnimationFrame for immediate clearing before browser paints
    requestAnimationFrame(() => {
      clearEmailAutofill()
      // Also use setTimeout as fallback
      setTimeout(clearEmailAutofill, 0)
      // Double-check after a microtask
      Promise.resolve().then(clearEmailAutofill)
    })

    // Clear immediately - multiple times to catch early autofill
    clearEmailAutofill()
    setTimeout(clearEmailAutofill, 0)
    setTimeout(clearEmailAutofill, 1)
    setTimeout(clearEmailAutofill, 5)

    // Set up interval to continuously check and clear (more frequent)
    const intervalId = setInterval(clearEmailAutofill, 50)

    // Also check after various delays to catch delayed autofill
    const timeouts = [0, 10, 50, 100, 200, 500, 1000, 2000].map(delay => 
      setTimeout(clearEmailAutofill, delay)
    )

    // Use MutationObserver to watch for attribute/value changes
    let observer: MutationObserver | null = null
    if (searchInputRef.current) {
      observer = new MutationObserver(() => {
        clearEmailAutofill()
      })
      observer.observe(searchInputRef.current, {
        attributes: true,
        attributeFilter: ['value', 'data-autofilled'],
        childList: false,
        subtree: false
      })
    }

    return () => {
      clearInterval(intervalId)
      timeouts.forEach(clearTimeout)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [onSearch])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Prevent email autofill even during typing
    if (value && value.includes('@') && value.length > 0 && !searchTerm.includes('@')) {
      // If user didn't type this (it was autofilled), clear it
      e.target.value = ''
      e.target.setAttribute('value', '')
      setSearchTerm('')
      if (onSearch) {
        onSearch('')
      }
      return
    }
    setSearchTerm(value)
    if (onSearch) {
      onSearch(value)
    }
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Clear any browser autofilled value on focus
    if (searchInputRef.current) {
      const currentValue = searchInputRef.current.value
      // Always clear if it looks like an email
      if (currentValue && currentValue.includes('@')) {
        e.target.value = ''
        e.target.setAttribute('value', '')
        searchInputRef.current.value = ''
        searchInputRef.current.setAttribute('value', '')
        setSearchTerm('')
        if (onSearch) {
          onSearch('')
        }
      }
    }
  }

  const handleBlur = () => {
    // Also check on blur in case autofill happens after focus
    if (searchInputRef.current) {
      const currentValue = searchInputRef.current.value
      if (currentValue && currentValue.includes('@')) {
        searchInputRef.current.value = ''
        searchInputRef.current.setAttribute('value', '')
        setSearchTerm('')
        if (onSearch) {
          onSearch('')
        }
      }
    }
  }

  const handleQRScan = (decodedText: string) => {
    setSearchTerm(decodedText)
    if (onSearch) {
      onSearch(decodedText)
    }
    setShowQRScanner(false)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    if (onSearch) {
      onSearch('')
    }
  }

  return (
    <>
      {/* Sticky topbar - remains visible when scrolling */}
      <header className="top-bar top-bar-sticky">
        {/* Search bar - can be hidden via hideSearch prop */}
        {!hideSearch && (
          <div className="search-bar" style={{ position: 'relative', flex: 1, maxWidth: '600px' }}>
            <input 
              ref={searchInputRef}
              type="search" 
              className="search-input" 
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onInput={(e) => {
                // Additional check on input event
                const target = e.target as HTMLInputElement
                if (target.value && target.value.includes('@') && !searchTerm.includes('@')) {
                  target.value = ''
                  target.setAttribute('value', '')
                  setSearchTerm('')
                  if (onSearch) {
                    onSearch('')
                  }
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              name={`search-${inputIdRef.current}`}
              id={`search-${inputIdRef.current}`}
              data-form-type="search"
              data-lpignore="true"
              data-1p-ignore="true"
              data-browser-autofill="off"
              readOnly={false}
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
          {/* Right content (e.g., Scan QR button) comes first */}
          {rightContent}
          {/* Notification dropdown comes after */}
        {currentUser && (
          <AdminNotificationDropdown currentUser={currentUser} />
        )}
      </div>
    </header>
      {showQRScanner && (
        <AdminQrScanner
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onDetected={handleQRScan}
        />
      )}
    </>
  )
}
