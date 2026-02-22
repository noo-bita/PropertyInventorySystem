import { useEffect, useState, useRef } from 'react'

interface UseCountUpOptions {
  duration?: number
  startOnMount?: boolean
}

/**
 * Custom hook for animating numbers from 0 to target value
 * @param targetValue - The final number to count up to
 * @param options - Animation options (duration in ms, startOnMount flag)
 * @returns The current animated value
 */
export function useCountUp(targetValue: number, options: UseCountUpOptions = {}) {
  const { duration = 1000, startOnMount = true } = options
  const [count, setCount] = useState(0)
  const animationFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef(0)
  const previousTargetRef = useRef(0)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    // If startOnMount is false and we haven't animated yet, don't start
    if (!startOnMount && !hasAnimatedRef.current) {
      return
    }

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Don't animate if target is 0 or negative
    if (targetValue <= 0) {
      setCount(0)
      previousTargetRef.current = 0
      return
    }

    // If target changed from previous value, start animation from previous
    // If this is the first time and target > 0, start from 0
    if (targetValue !== previousTargetRef.current) {
      startValueRef.current = previousTargetRef.current > 0 ? previousTargetRef.current : 0
      previousTargetRef.current = targetValue
    }

    // If already at target and it hasn't changed, don't re-animate
    if (count === targetValue && startValueRef.current === targetValue) {
      return
    }

    // Start animation
    startTimeRef.current = performance.now()
    hasAnimatedRef.current = true

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime
      }

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.floor(startValueRef.current + (targetValue - startValueRef.current) * easeOut)

      setCount(currentValue)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Ensure we end at exact target value
        setCount(targetValue)
        startTimeRef.current = null
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [targetValue, duration, startOnMount])

  return { count }
}

