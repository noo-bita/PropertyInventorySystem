import React, { useState, useRef, useEffect } from 'react'
import { getInputHistory, saveToHistory } from '../utils/inputHistory'

interface AutocompleteTextareaProps {
  value: string
  onChange: (value: string) => void
  fieldName: string // Used to identify which field's history to use
  placeholder?: string
  className?: string
  rows?: number
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  onBlur?: () => void
  onFocus?: () => void
  style?: React.CSSProperties
}

export default function AutocompleteTextarea({
  value,
  onChange,
  fieldName,
  placeholder,
  className = '',
  rows = 4,
  disabled = false,
  required = false,
  id,
  name,
  onBlur,
  onFocus,
  style
}: AutocompleteTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [filteredHistory, setFilteredHistory] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load history when component mounts or fieldName changes
  useEffect(() => {
    const fieldHistory = getInputHistory(fieldName)
    setHistory(fieldHistory)
    setFilteredHistory(fieldHistory)
  }, [fieldName])

  // Filter history based on current input value
  useEffect(() => {
    if (value.trim() === '') {
      setFilteredHistory(history)
    } else {
      const lowerValue = value.toLowerCase()
      const filtered = history.filter(item => 
        item.toLowerCase().includes(lowerValue) && item.toLowerCase() !== lowerValue
      )
      setFilteredHistory(filtered)
    }
  }, [value, history])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleFocus = () => {
    if (history.length > 0) {
      setShowDropdown(true)
    }
    if (onFocus) {
      onFocus()
    }
  }

  const handleBlur = () => {
    // Delay closing to allow click on dropdown item
    setTimeout(() => {
      setShowDropdown(false)
    }, 200)
    if (onBlur) {
      onBlur()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Show dropdown if there's matching history
    if (newValue.trim() === '' || filteredHistory.length > 0) {
      setShowDropdown(true)
    }
  }

  const handleSelectHistoryItem = (item: string) => {
    onChange(item)
    setShowDropdown(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setShowDropdown(false)
    } else if (e.key === 'ArrowDown' && filteredHistory.length > 0) {
      e.preventDefault()
      setShowDropdown(true)
    }
  }

  // Save to history when value changes and input loses focus (on submit or blur)
  const handleInputBlur = () => {
    if (value && value.trim() !== '') {
      saveToHistory(fieldName, value)
      // Reload history to include the new value
      const updatedHistory = getInputHistory(fieldName)
      setHistory(updatedHistory)
    }
    handleBlur()
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        required={required}
        id={id}
        name={name}
        rows={rows}
        style={style}
        autoComplete="off"
      />
      
      {showDropdown && filteredHistory.length > 0 && (
        <div
          ref={dropdownRef}
          className="autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--gray-300)',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            zIndex: 1000,
            marginTop: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {filteredHistory.map((item, index) => (
            <div
              key={index}
              className="autocomplete-dropdown-item"
              onClick={() => handleSelectHistoryItem(item)}
              onMouseDown={(e) => e.preventDefault()} // Prevent textarea blur before click
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--text-dark)',
                borderBottom: index < filteredHistory.length - 1 ? '1px solid var(--gray-200)' : 'none',
                transition: 'background-color 0.15s ease',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gray-100)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
