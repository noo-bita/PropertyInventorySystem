/**
 * Utility functions for managing input field history
 * Stores up to 5 previous values per field in localStorage
 */

const HISTORY_LIMIT = 5
const STORAGE_PREFIX = 'inventory_history_'

/**
 * Get history for a specific field
 */
export function getInputHistory(fieldName: string): string[] {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${fieldName}`)
    if (stored) {
      const history = JSON.parse(stored)
      return Array.isArray(history) ? history : []
    }
  } catch (error) {
    console.error(`Error reading history for ${fieldName}:`, error)
  }
  return []
}

/**
 * Save a value to history for a specific field
 * Removes duplicates and limits to HISTORY_LIMIT items
 */
export function saveToHistory(fieldName: string, value: string): void {
  if (!value || value.trim() === '') {
    return // Don't save empty values
  }

  try {
    const currentHistory = getInputHistory(fieldName)
    
    // Remove the value if it already exists (to move it to the top)
    const filteredHistory = currentHistory.filter(item => item.toLowerCase() !== value.toLowerCase())
    
    // Add the new value at the beginning
    const newHistory = [value.trim(), ...filteredHistory]
    
    // Limit to HISTORY_LIMIT items
    const limitedHistory = newHistory.slice(0, HISTORY_LIMIT)
    
    // Save to localStorage
    localStorage.setItem(`${STORAGE_PREFIX}${fieldName}`, JSON.stringify(limitedHistory))
  } catch (error) {
    console.error(`Error saving history for ${fieldName}:`, error)
  }
}

/**
 * Clear history for a specific field
 */
export function clearHistory(fieldName: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${fieldName}`)
  } catch (error) {
    console.error(`Error clearing history for ${fieldName}:`, error)
  }
}

/**
 * Clear all input histories
 */
export function clearAllHistories(): void {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  } catch (error) {
    console.error('Error clearing all histories:', error)
  }
}

