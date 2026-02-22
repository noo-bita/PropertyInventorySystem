import { useState, useEffect } from 'react'

/**
 * Hook to manage data ready state for animations
 * Sets dataReady to true after loading completes with a brief delay
 * to allow spinner to fade out smoothly
 */
export function useDataReady(loading: boolean, delay: number = 100) {
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    if (!loading) {
      // Mark data as ready after a brief delay to allow spinner to fade out
      const timer = setTimeout(() => {
        setDataReady(true)
      }, delay)
      return () => clearTimeout(timer)
    } else {
      // Reset when loading starts
      setDataReady(false)
    }
  }, [loading, delay])

  return dataReady
}

