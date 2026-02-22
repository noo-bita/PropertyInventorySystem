// ============================================================================
// OLD CHART COMPONENT – RETAINED FOR REFERENCE
// This component is kept for reference purposes only.
// The new modern chart component is DashboardChart.tsx
// ============================================================================

import React, { useMemo } from 'react'

interface SystemOverviewChartProps {
  dashboardData: {
    totalItems: number
    pendingRequests: number
    totalUsers: number
    availableItems: number
  }
  apiStatus: string
  timeFilter: 'today' | 'week' | 'month'
  loading: boolean
  requestsData: any[]
  reportsData: any[]
}

export default function SystemOverviewChart({ 
  dashboardData, 
  apiStatus, 
  timeFilter, 
  loading,
  requestsData,
  reportsData
}: SystemOverviewChartProps) {
  
  // Generate bar chart data (category distribution)
  const barChartData = useMemo(() => {
    const categoryCounts: { [key: string]: number } = {}
    
    // Get categories from requests data
    if (requestsData && Array.isArray(requestsData)) {
      requestsData.forEach((req: any) => {
        if (req) {
          const category = req.category || req.item_category || 'Other'
          categoryCounts[category] = (categoryCounts[category] || 0) + 1
        }
      })
    }
    
    // If no data, use sample categories
    if (Object.keys(categoryCounts).length === 0) {
      const sampleCategories = ['Electronics', 'Furniture', 'Office Supplies', 'Tools', 'Equipment']
      sampleCategories.forEach(cat => {
        categoryCounts[cat] = Math.floor(Math.random() * 15) + 3
      })
    }
    
    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    
    const maxValue = sortedCategories.length > 0 
      ? Math.max(...sortedCategories.map(([_, count]) => count), 1)
      : 1
    
    return {
      data: sortedCategories.map(([category, count]) => ({
        label: category.length > 10 ? category.substring(0, 10) + '...' : category,
        value: count,
        percentage: (count / maxValue) * 100
      })),
      maxValue
    }
  }, [requestsData])

  // Generate line chart data (trends over time)
  const lineChartData = useMemo(() => {
    const now = new Date()
    let startDate: Date
    let dataPoints: number
    let labels: string[] = []
    
    if (timeFilter === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      dataPoints = 12
      labels = Array.from({ length: 12 }, (_, i) => {
        const hour = i * 2
        return `${hour.toString().padStart(2, '0')}:00`
      })
    } else if (timeFilter === 'week') {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)
      dataPoints = 7
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      labels = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + i)
        return dayNames[date.getDay()]
      })
    } else {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 29)
      startDate.setHours(0, 0, 0, 0)
      dataPoints = 30
      labels = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + i)
        return `${date.getDate()}/${date.getMonth() + 1}`
      })
    }
    
    const requestsByPeriod = Array(dataPoints).fill(0)
    const activityByPeriod = Array(dataPoints).fill(0)
    
    if (!requestsData || !Array.isArray(requestsData)) {
      requestsData = []
    }
    if (!reportsData || !Array.isArray(reportsData)) {
      reportsData = []
    }
    
    requestsData.forEach((req: any) => {
      if (!req?.created_at) return
      try {
        const reqDate = new Date(req.created_at)
        if (isNaN(reqDate.getTime()) || reqDate < startDate || reqDate > now) return
        
        let index = -1
        if (timeFilter === 'today') {
          index = Math.min(Math.floor(reqDate.getHours() / 2), dataPoints - 1)
        } else {
          const daysDiff = Math.floor((reqDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          index = Math.max(0, Math.min(daysDiff, dataPoints - 1))
        }
        
        if (index >= 0 && index < dataPoints) {
          requestsByPeriod[index]++
          activityByPeriod[index]++
        }
      } catch (e) {
        // Skip invalid dates
      }
    })
    
    reportsData.forEach((report: any) => {
      if (!report?.created_at) return
      try {
        const reportDate = new Date(report.created_at)
        if (isNaN(reportDate.getTime()) || reportDate < startDate || reportDate > now) return
        
        let index = -1
        if (timeFilter === 'today') {
          index = Math.min(Math.floor(reportDate.getHours() / 2), dataPoints - 1)
        } else {
          const daysDiff = Math.floor((reportDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          index = Math.max(0, Math.min(daysDiff, dataPoints - 1))
        }
        
        if (index >= 0 && index < dataPoints) {
          activityByPeriod[index]++
        }
      } catch (e) {
        // Skip invalid dates
      }
    })
    
    const maxValue = Math.max(...requestsByPeriod, ...activityByPeriod, 1)
    
    return {
      labels,
      requests: requestsByPeriod,
      activity: activityByPeriod,
      maxValue
    }
  }, [requestsData, reportsData, timeFilter])

  if (loading) {
    return (
      <div className="chart-loading">
        <div className="loading-spinner"></div>
        <p>Loading chart data...</p>
      </div>
    )
  }

  // Bar Chart Configuration
  const barChartHeight = 200
  const barChartWidth = 800
  const barPadding = { top: 20, right: 40, bottom: 40, left: 50 }
  const barChartMax = barChartData.maxValue
  const barChartAreaHeight = barChartHeight - barPadding.top - barPadding.bottom
  const barChartAreaWidth = barChartWidth - barPadding.left - barPadding.right
  const barWidth = barChartData.data.length > 0 
    ? (barChartAreaWidth / barChartData.data.length) - 10 
    : 40

  // Line Chart Configuration
  const lineChartHeight = 200
  const lineChartWidth = 800
  const linePadding = { top: 20, right: 40, bottom: 40, left: 50 }
  const lineChartMax = lineChartData.maxValue || 10
  const lineChartAreaHeight = lineChartHeight - linePadding.top - linePadding.bottom
  const lineChartAreaWidth = lineChartWidth - linePadding.left - linePadding.right

  return (
    <div className="system-chart-container">
      {/* Chart Stats Summary */}
      <div className="chart-stats-summary">
        <div className="chart-stat-item">
          <div className="chart-stat-label">Total Items</div>
          <div className="chart-stat-value chart-stat-primary">
            {dashboardData.totalItems.toLocaleString()}
          </div>
        </div>
        <div className="chart-stat-item">
          <div className="chart-stat-label">Pending Requests</div>
          <div className="chart-stat-value chart-stat-warning">
            {dashboardData.pendingRequests.toLocaleString()}
          </div>
        </div>
        <div className="chart-stat-item">
          <div className="chart-stat-label">Available Items</div>
          <div className="chart-stat-value chart-stat-success">
            {dashboardData.availableItems.toLocaleString()}
          </div>
        </div>
        <div className="chart-stat-item">
          <div className="chart-stat-label">System Status</div>
          <div className={`chart-stat-value ${apiStatus === 'offline' ? 'chart-stat-danger' : 'chart-stat-success'}`}>
            {apiStatus === 'offline' ? 'Offline' : 'Online'}
          </div>
        </div>
      </div>

      {/* Bar Chart - Category Distribution */}
      <div className="chart-section">
        <h4 className="chart-section-title">Category Distribution</h4>
        <div className="chart-wrapper chart-bar-wrapper">
          <svg 
            viewBox={`0 0 ${barChartWidth} ${barChartHeight}`} 
            className="system-chart-bar"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#166534" />
              </linearGradient>
            </defs>
            
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = barPadding.top + barChartAreaHeight * (1 - ratio)
              const value = Math.round(barChartMax * ratio)
              return (
                <g key={ratio}>
                  <line
                    x1={barPadding.left}
                    y1={y}
                    x2={barChartWidth - barPadding.right}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={barPadding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#64748b"
                    fontWeight="500"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {/* Bars */}
            {barChartData.data.length > 0 && barChartData.data.map((item, i) => {
              const barHeight = (item.percentage / 100) * barChartAreaHeight
              const x = barPadding.left + i * (barChartAreaWidth / Math.max(barChartData.data.length, 1)) + 5
              const y = barPadding.top + barChartAreaHeight - barHeight
              
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill="url(#barGradient)"
                    rx="4"
                    className="chart-bar"
                  />
                  <text
                    x={x + barWidth / 2}
                    y={barChartHeight - barPadding.bottom + 20}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                    fontWeight="500"
                  >
                    {item.label}
                  </text>
                  {item.value > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#166534"
                      fontWeight="600"
                    >
                      {item.value}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Line Chart - Activity Trends */}
      <div className="chart-section">
        <h4 className="chart-section-title">Activity Trends</h4>
        <div className="chart-wrapper chart-line-wrapper">
          <svg 
            viewBox={`0 0 ${lineChartWidth} ${lineChartHeight}`} 
            className="system-chart-line"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0.05)" />
              </linearGradient>
              <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(245, 158, 11, 0.3)" />
                <stop offset="100%" stopColor="rgba(245, 158, 11, 0.05)" />
              </linearGradient>
            </defs>
            
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = linePadding.top + lineChartAreaHeight * (1 - ratio)
              const value = Math.round(lineChartMax * ratio)
              return (
                <g key={ratio}>
                  <line
                    x1={linePadding.left}
                    y1={y}
                    x2={lineChartWidth - linePadding.right}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={linePadding.left - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#64748b"
                    fontWeight="500"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {/* Area fills */}
            {lineChartData.labels.length > 0 && (
              <>
                {/* Activity area */}
                <path
                  d={`M ${linePadding.left},${linePadding.top + lineChartAreaHeight} ${
                    lineChartData.labels.map((_, i) => {
                      const x = linePadding.left + (i / (lineChartData.labels.length - 1 || 1)) * lineChartAreaWidth
                      const y = linePadding.top + lineChartAreaHeight * (1 - (lineChartData.activity[i] / lineChartMax))
                      return `L ${x},${y}`
                    }).join(' ')
                  } L ${linePadding.left + lineChartAreaWidth},${linePadding.top + lineChartAreaHeight} Z`}
                  fill="url(#lineGradient1)"
                  opacity="0.6"
                />
                
                {/* Requests area */}
                <path
                  d={`M ${linePadding.left},${linePadding.top + lineChartAreaHeight} ${
                    lineChartData.labels.map((_, i) => {
                      const x = linePadding.left + (i / (lineChartData.labels.length - 1 || 1)) * lineChartAreaWidth
                      const y = linePadding.top + lineChartAreaHeight * (1 - (lineChartData.requests[i] / lineChartMax))
                      return `L ${x},${y}`
                    }).join(' ')
                  } L ${linePadding.left + lineChartAreaWidth},${linePadding.top + lineChartAreaHeight} Z`}
                  fill="url(#lineGradient2)"
                  opacity="0.4"
                />

                {/* Activity line */}
                <path
                  d={`M ${
                    lineChartData.labels.map((_, i) => {
                      const x = linePadding.left + (i / (lineChartData.labels.length - 1 || 1)) * lineChartAreaWidth
                      const y = linePadding.top + lineChartAreaHeight * (1 - (lineChartData.activity[i] / lineChartMax))
                      return `${x},${y}`
                    }).join(' L ')
                  }`}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Requests line */}
                <path
                  d={`M ${
                    lineChartData.labels.map((_, i) => {
                      const x = linePadding.left + (i / (lineChartData.labels.length - 1 || 1)) * lineChartAreaWidth
                      const y = linePadding.top + lineChartAreaHeight * (1 - (lineChartData.requests[i] / lineChartMax))
                      return `${x},${y}`
                    }).join(' L ')
                  }`}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5,3"
                />

                {/* Data points */}
                {lineChartData.labels.map((_, i) => {
                  const x = linePadding.left + (i / (lineChartData.labels.length - 1 || 1)) * lineChartAreaWidth
                  const yActivity = linePadding.top + lineChartAreaHeight * (1 - (lineChartData.activity[i] / lineChartMax))
                  const yRequests = linePadding.top + lineChartAreaHeight * (1 - (lineChartData.requests[i] / lineChartMax))
                  
                  return (
                    <g key={i}>
                      {lineChartData.activity[i] > 0 && (
                        <circle
                          cx={x}
                          cy={yActivity}
                          r="4"
                          fill="#22c55e"
                          stroke="white"
                          strokeWidth="2"
                          className="chart-point"
                        />
                      )}
                      {lineChartData.requests[i] > 0 && (
                        <circle
                          cx={x}
                          cy={yRequests}
                          r="4"
                          fill="#f59e0b"
                          stroke="white"
                          strokeWidth="2"
                          className="chart-point"
                        />
                      )}
                    </g>
                  )
                })}

                {/* X-axis labels */}
                {lineChartData.labels.map((label, i) => {
                  const showLabel = timeFilter === 'today' 
                    ? (i % 3 === 0 || i === lineChartData.labels.length - 1)
                    : timeFilter === 'week'
                    ? true
                    : (i % 5 === 0 || i === lineChartData.labels.length - 1)
                  
                  if (!showLabel) return null
                  
                  const x = linePadding.left + (i / (lineChartData.labels.length - 1 || 1)) * lineChartAreaWidth
                  return (
                    <text
                      key={i}
                      x={x}
                      y={lineChartHeight - linePadding.bottom + 20}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748b"
                      fontWeight="500"
                    >
                      {label}
                    </text>
                  )
                })}
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Chart Legend */}
      <div className="chart-legend">
        <div className="legend-item">
          <div className="legend-color legend-color-solid" style={{ backgroundColor: '#22c55e' }}></div>
          <span className="legend-label">Activity Count</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-color-dashed" style={{ backgroundColor: '#f59e0b' }}></div>
          <span className="legend-label">Requests Created</span>
        </div>
      </div>
    </div>
  )
}
