import React from 'react'

interface AnimatedTextProps {
  children: React.ReactNode
  dataReady: boolean
  delay?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Reusable text component with fade-in animation
 * Only renders and animates when dataReady is true
 */
export function AnimatedText({ 
  children, 
  dataReady, 
  delay = 0, 
  className = '', 
  style = {} 
}: AnimatedTextProps) {
  if (!dataReady) {
    return null
  }

  return (
    <div 
      className={`fade-in ${className}`}
      style={{
        ...style,
        animationDelay: `${delay}s`
      }}
    >
      {children}
    </div>
  )
}

