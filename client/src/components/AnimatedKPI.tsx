import React from 'react'
import { useCountUp } from '../hooks/useCountUp'

interface AnimatedKPIProps {
  label: string
  value: number
  icon: string
  iconClass: string
  loading: boolean
  dataReady: boolean
}

/**
 * Reusable KPI Card component with count-up animation
 * Only animates when dataReady is true and loading is false
 */
export function AnimatedKPI({ label, value, icon, iconClass, loading, dataReady }: AnimatedKPIProps) {
  // Only animate when data is ready, otherwise show 0 or nothing
  const targetValue = dataReady ? value : 0
  const { count } = useCountUp(targetValue, {
    duration: 1200,
    startOnMount: dataReady
  })

  return (
    <div className={`kpi-card kpi-card-modern ${dataReady ? 'fade-in' : ''}`}>
      <div className="kpi-info">
        <h3 className="kpi-label">{label}</h3>
        <div className="kpi-value">
          {loading ? (
            <div className="loading-spinner"></div>
          ) : dataReady ? (
            <span className="kpi-number">{count.toLocaleString()}</span>
          ) : null}
        </div>
      </div>
      <div className={`kpi-icon-wrapper ${iconClass}`}>
        <i className={`bi ${icon} kpi-icon`}></i>
      </div>
    </div>
  )
}

