import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import { apiFetch, getApiBaseUrl } from '../utils/api'
import { showNotification } from '../utils/notifications'

export default function Reports() {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [selectedReportType, setSelectedReportType] = useState('inventory')
  const [dateRange, setDateRange] = useState('last30days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [reportData, setReportData] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false)
  const [reportGenerated, setReportGenerated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    // Simulate initial load time
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [location.pathname])

  const reportTypes = [
    { id: 'inventory', name: 'Inventory Report', icon: 'bi-box' },
    { id: 'users', name: 'User Activity', icon: 'bi-people' },
    { id: 'requests', name: 'Request History', icon: 'bi-file-earmark-text' },
    { id: 'costs', name: 'Cost Analysis', icon: 'bi-graph-up' }
  ]

  const dateRanges = [
    { id: 'last7days', name: 'Last 7 Days' },
    { id: 'last30days', name: 'Last 30 Days' },
    { id: 'last90days', name: 'Last 90 Days' },
    { id: 'custom', name: 'Custom Range' }
  ]

  const getDateRange = () => {
    const today = new Date()
    let startDate: Date
    let endDate = new Date(today)

    if (dateRange === 'custom') {
      if (!customStartDate || !customEndDate) {
        throw new Error('Please select both start and end dates for custom range')
      }
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
    } else if (dateRange === 'last7days') {
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 7)
    } else if (dateRange === 'last30days') {
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 30)
    } else if (dateRange === 'last90days') {
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 90)
    } else {
      startDate = new Date(today)
      startDate.setDate(today.getDate() - 30)
    }

    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }
  }

  const generateReport = async () => {
    try {
      if (dateRange === 'custom' && (!customStartDate || !customEndDate)) {
        showNotification('Please select both start and end dates for custom range', 'error')
        return
      }

      if (dateRange === 'custom' && new Date(customStartDate) > new Date(customEndDate)) {
        showNotification('Start date must be before end date', 'error')
        return
      }

      setIsGenerating(true)
      setReportGenerated(false)
      
      const dateRangeParams = getDateRange()
      
      const response = await apiFetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: selectedReportType,
          ...dateRangeParams
        })
      })

      // Check content type before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`)
      }

      // Parse JSON response once
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `Failed to generate report (${response.status})`)
      }

      // Check if response has success flag
      if (data.success === false) {
        throw new Error(data.message || 'Failed to generate report')
      }

      setReportData(data.data || [])
      setReportGenerated(true)
      showNotification('Report generated successfully!', 'success')
    } catch (error: any) {
      console.error('Error generating report:', error)
      showNotification(error.message || 'Failed to generate report. Please try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadReport = async () => {
    if (!reportGenerated || reportData.length === 0) {
      showNotification('Please generate a report first', 'error')
      return
    }

    try {
      setIsDownloading(true)
      
      const dateRangeParams = getDateRange()
      
      // Use apiFetch pattern to include authentication token
      // We can't use apiFetch directly because we need to handle blob response, not JSON
      const token = localStorage.getItem('api_token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${getApiBaseUrl()}/api/reports/download`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          report_type: selectedReportType,
          ...dateRangeParams
        })
      })

      // Check content type - for downloads, it might be application/octet-stream or docx
      const contentType = response.headers.get('content-type')
      
      if (!response.ok) {
        // If error, try to parse as JSON
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          const errorMessage = errorData.message || `Failed to download report (${response.status})`
          
          // Check for ZipArchive error and provide helpful message
          if (errorMessage.includes('ZipArchive') || errorMessage.includes('zip extension')) {
            throw new Error('PHP ZipArchive extension is not enabled. Please contact your administrator to enable the "zip" extension in php.ini and restart Apache.')
          }
          
          throw new Error(errorMessage)
        } else {
          const text = await response.text()
          throw new Error(`Failed to download report: ${text.substring(0, 100)}`)
        }
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const reportTypeName = reportTypes.find(t => t.id === selectedReportType)?.name || 'Report'
      const dateStr = dateRangeParams.start_date.replace(/-/g, '') + '_' + dateRangeParams.end_date.replace(/-/g, '')
      link.download = `${reportTypeName}_${dateStr}.docx`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      showNotification('Report downloaded successfully!', 'success')
    } catch (error: any) {
      console.error('Error downloading report:', error)
      showNotification(error.message || 'Failed to download report. Please try again.', 'error')
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadExcelReport = async () => {
    if (!reportGenerated || reportData.length === 0) {
      showNotification('Please generate a report first', 'error')
      return
    }

    try {
      setIsDownloadingExcel(true)
      
      const dateRangeParams = getDateRange()
      
      const token = localStorage.getItem('api_token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${getApiBaseUrl()}/api/reports/download-excel`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          report_type: selectedReportType,
          ...dateRangeParams
        })
      })

      const contentType = response.headers.get('content-type')
      
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          const errorMessage = errorData.message || `Failed to download Excel report (${response.status})`
          
          if (errorMessage.includes('PhpSpreadsheet') || errorMessage.includes('GD extension')) {
            throw new Error('PhpSpreadsheet library or GD extension is not installed. Please contact your administrator.')
          }
          
          throw new Error(errorMessage)
        } else {
          const text = await response.text()
          throw new Error(`Failed to download Excel report: ${text.substring(0, 100)}`)
        }
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const reportTypeName = reportTypes.find(t => t.id === selectedReportType)?.name || 'Report'
      const dateStr = dateRangeParams.start_date.replace(/-/g, '') + '_' + dateRangeParams.end_date.replace(/-/g, '')
      link.download = `${reportTypeName}_${dateStr}.xlsx`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      showNotification('Excel report downloaded successfully!', 'success')
    } catch (error: any) {
      console.error('Error downloading Excel report:', error)
      showNotification(error.message || 'Failed to download Excel report. Please try again.', 'error')
    } finally {
      setIsDownloadingExcel(false)
    }
  }

  const getReportColumns = () => {
    switch (selectedReportType) {
      case 'inventory':
        return ['ID', 'Item Name', 'Category', 'Quantity', 'Available', 'Location', 'Status', 'Purchase Price', 'Purchase Date']
      case 'users':
        return ['ID', 'Name', 'Email', 'Role', 'Last Login', 'Status']
      case 'requests':
        return ['ID', 'Teacher', 'Item', 'Quantity', 'Status', 'Request Date', 'Due Date']
      case 'costs':
        return ['ID', 'Item Name', 'Category', 'Quantity', 'Unit Price', 'Total Cost', 'Purchase Date', 'Supplier']
      default:
        return []
    }
  }

  const formatReportValue = (value: any, column: string) => {
    if (value === null || value === undefined || value === '') return 'N/A'
    
    if (column.includes('Date') || column.includes('date')) {
      if (typeof value === 'string' && value !== 'N/A') {
        try {
          return new Date(value).toLocaleDateString()
        } catch {
          return value
        }
      }
      return value
    }
    
    if (column.includes('Price') || column.includes('Cost') || column.includes('price') || column.includes('cost')) {
      if (typeof value === 'number') {
        return `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      return value
    }
    
    return String(value)
  }

  const getColumnKey = (column: string, row: any) => {
    // Map column names to backend response keys
    const columnMap: { [key: string]: string[] } = {
      'ID': ['id'],
      'Item Name': ['item_name', 'name'],
      'Category': ['category'],
      'Quantity': ['quantity'],
      'Available': ['available'],
      'Location': ['location'],
      'Status': ['status'],
      'Purchase Price': ['purchase_price', 'unit_price'],
      'Purchase Date': ['purchase_date'],
      'Name': ['name'],
      'Email': ['email'],
      'Role': ['role'],
      'Last Login': ['last_login'],
      'Teacher': ['teacher', 'teacher_name'],
      'Item': ['item', 'item_name'],
      'Request Date': ['request_date', 'created_at'],
      'Due Date': ['due_date'],
      'Unit Price': ['unit_price', 'purchase_price'],
      'Total Cost': ['total_cost'],
      'Supplier': ['supplier']
    }

    const possibleKeys = columnMap[column] || [column.toLowerCase().replace(/\s+/g, '_')]
    
    for (const key of possibleKeys) {
      if (row[key] !== undefined) {
        return row[key]
      }
    }
    
    // Fallback: try to find any key that contains parts of the column name
    const columnLower = column.toLowerCase().replace(/\s+/g, '_')
    for (const key in row) {
      if (key.toLowerCase().includes(columnLower.slice(0, 5)) || columnLower.includes(key.toLowerCase().slice(0, 5))) {
        return row[key]
      }
    }
    
    return null
  }

  return (
    <div className="dashboard-container">
      <Sidebar />
      
      <main className="main-content">
        <AdminTopBar 
          searchPlaceholder="Search reports..." 
          currentUser={currentUser || undefined}
        />
        
        {/* Loading overlay - only covers main content, sidebar remains visible */}
        {loading && (
          <div className="main-content-loading">
            <div className="full-screen-spinner">
              <div className="loading-spinner-large"></div>
              <p style={{ marginTop: 'var(--space-4)', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                Loading reports...
              </p>
            </div>
          </div>
        )}
        
        {!loading && (
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1 className="dashboard-title">Reports</h1>
            <p className="dashboard-subtitle">Generate and download comprehensive reports for your property management system.</p>
          </div>

          {/* Report Configuration */}
          <div className="reports-section">
            <div className="section-header">
              <h3>Report Configuration</h3>
            </div>
            
            <div className="report-config-grid">
              {/* Report Type Selection */}
              <div className="config-card">
                <h4>Report Type</h4>
                <div className="report-type-grid">
                  {reportTypes.map((type) => (
                    <div 
                      key={type.id}
                      className={`report-type-option ${selectedReportType === type.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedReportType(type.id)
                        setReportGenerated(false)
                        setReportData([])
                      }}
                    >
                      <i className={type.icon}></i>
                      <span>{type.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Range Selection */}
              <div className="config-card">
                <h4>Date Range</h4>
                <div className="date-range-options">
                  {dateRanges.map((range) => (
                    <label key={range.id} className="date-range-option">
                      <input 
                        type="radio" 
                        name="dateRange" 
                        value={range.id}
                        checked={dateRange === range.id}
                        onChange={(e) => {
                          setDateRange(e.target.value)
                          setReportGenerated(false)
                          setReportData([])
                        }}
                      />
                      <span>{range.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              {dateRange === 'custom' && (
                <div className="config-card">
                  <h4>Custom Date Range</h4>
                  <div className="custom-date-inputs">
                    <div className="date-input-group">
                      <label>From:</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={customStartDate}
                        onChange={(e) => {
                          setCustomStartDate(e.target.value)
                          setReportGenerated(false)
                          setReportData([])
                        }}
                      />
                    </div>
                    <div className="date-input-group">
                      <label>To:</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={customEndDate}
                        onChange={(e) => {
                          setCustomEndDate(e.target.value)
                          setReportGenerated(false)
                          setReportData([])
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="report-actions">
              <button 
                className="btn btn-primary" 
                onClick={generateReport}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Generating...
                  </>
                ) : (
                  <>
                <i className="bi bi-file-earmark-bar-graph"></i>
                Generate Report
                  </>
                )}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={downloadReport}
                disabled={!reportGenerated || isDownloading || reportData.length === 0}
              >
                {isDownloading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Downloading...
                  </>
                ) : (
                  <>
                <i className="bi bi-download"></i>
                    Download as DOCX
                  </>
                )}
              </button>
              <button 
                className="btn btn-success" 
                onClick={downloadExcelReport}
                disabled={!reportGenerated || isDownloadingExcel || reportData.length === 0}
              >
                {isDownloadingExcel ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Downloading...
                  </>
                ) : (
                  <>
                <i className="bi bi-file-earmark-spreadsheet"></i>
                    Download as Excel
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Report Display */}
          {reportGenerated && reportData.length > 0 && (
          <div className="reports-section">
            <div className="section-header">
                <h3>
                  {reportTypes.find(t => t.id === selectedReportType)?.name} 
                  <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#6c757d', marginLeft: '12px' }}>
                    ({reportData.length} {reportData.length === 1 ? 'record' : 'records'})
                  </span>
                </h3>
            </div>
            
              <div className="table-responsive" style={{ marginTop: '20px' }}>
                <table className="table-modern">
                  <thead>
                    <tr>
                      {getReportColumns().map((column, index) => (
                        <th key={index}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row: any, rowIndex: number) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'even-row' : 'odd-row'}>
                        {getReportColumns().map((column, colIndex) => {
                          const value = getColumnKey(column, row)
                          return (
                            <td key={colIndex}>
                              {formatReportValue(value, column)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
          )}

          {reportGenerated && reportData.length === 0 && (
          <div className="reports-section">
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                No data found for the selected report type and date range.
              </div>
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  )
}
