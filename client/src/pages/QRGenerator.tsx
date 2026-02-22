import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import AdminTopBar from '../components/AdminTopBar'
import { showNotification } from '../utils/notifications'

export default function QRGenerator() {
  const { user: currentUser } = useAuth()
  const location = useLocation()
  const [itemName, setItemName] = useState('')
  const [itemCategory, setItemCategory] = useState('')
  const [generatedQR, setGeneratedQR] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  const categories = [
    'Electronics',
    'Furniture', 
    'Office Supplies',
    'Tools',
    'Books',
    'Sports Equipment',
    'Laboratory Equipment',
    'Other'
  ]

  // Reset loading when navigating to this page
  useEffect(() => {
    setLoading(true)
    // Simulate a brief loading time for consistency
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [location.pathname])

  const generateQR = async () => {
    if (!itemName.trim() || !itemCategory) {
      showNotification('Please fill in all required fields', 'error')
      return
    }

    setIsGenerating(true)
    
    try {
      // Create a structured data string for QR code
      const dataString = `ITEM-${Date.now()}-${itemName}-${itemCategory}`
      
      // Generate real QR code using qrcode library
      const qrDataURL = await QRCode.toDataURL(dataString, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      const newQR = {
        id: Date.now(),
        itemName,
        itemCategory,
        timestamp: new Date().toISOString(),
        qrData: dataString,
        qrCode: qrDataURL
      }

      setGeneratedQR(newQR)
      showNotification('QR Code generated successfully!', 'success')
    } catch (error) {
      console.error('Error generating QR code:', error)
      showNotification('Error generating QR code. Please try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadQR = () => {
    if (!generatedQR || !generatedQR.qrCode) return
    
    try {
      // Download the QR code as PNG image
      const link = document.createElement('a')
      link.download = `qr-${generatedQR.itemName || 'item'}-${Date.now()}.png`
      link.href = generatedQR.qrCode
      link.click()
      showNotification('QR Code download started...', 'info')
    } catch (error) {
      console.error('Error downloading QR image:', error)
      showNotification('Error downloading QR code. Please try again.', 'error')
    }
  }

  if (!currentUser) {
    return (
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">Access Denied</h4>
        <p>You must be logged in to access this page.</p>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      <Sidebar currentUser={currentUser} />
      
      <main className="main-content">
        {/* Loading overlay - only covers main content, sidebar remains visible */}
        {loading && (
          <div className="main-content-loading">
            <div className="full-screen-spinner">
              <div className="loading-spinner-large"></div>
              <p style={{ marginTop: 'var(--space-4)', color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                Loading QR Generator...
              </p>
            </div>
          </div>
        )}
        
        {/* Topbar inside main-content to prevent sidebar overlap - no search bar */}
        <AdminTopBar 
          currentUser={currentUser}
          hideSearch={true}
        />
        
        <div className="dashboard-content">
          <div className="container-fluid py-4">
            {/* Header */}
            <div className="mb-4">
              <h1 className="dashboard-title">QR Code Generator</h1>
              <p className="dashboard-subtitle">Generate QR codes for school inventory items</p>
            </div>

            {/* Main QR Generator Section - Modern Design */}
            <div className="row">
              {/* Left Column - Form */}
              <div className="col-lg-6 mb-4">
                <div className="standard-card">
                  <div className="standard-card-header">
                    <h3 className="standard-card-title">
                      <i className="bi bi-pencil-square me-2"></i>
                      Step 1: Enter Item Details
                    </h3>
                  </div>
                  <div className="standard-card-body">
                    <div className="form-group mb-4">
                      <label className="form-label" style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--text-dark)' }}>
                        Item Name <span className="text-danger">*</span>
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Enter item name"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        style={{
                          borderRadius: '8px',
                          padding: '12px 16px',
                          border: '1px solid var(--gray-300)',
                          fontSize: '0.95rem'
                        }}
                      />
                    </div>
                    
                    <div className="form-group mb-4">
                      <label className="form-label" style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--text-dark)' }}>
                        Item Category <span className="text-danger">*</span>
                      </label>
                      <select 
                        className="form-select"
                        value={itemCategory}
                        onChange={(e) => setItemCategory(e.target.value)}
                        style={{
                          borderRadius: '8px',
                          padding: '12px 16px',
                          border: '1px solid var(--gray-300)',
                          fontSize: '0.95rem'
                        }}
                      >
                        <option value="">Select a category</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button 
                      className="btn-standard btn-primary"
                      onClick={generateQR}
                      disabled={!itemName.trim() || !itemCategory || isGenerating}
                      style={{
                        width: '100%',
                        padding: '12px 24px',
                        fontSize: '1rem',
                        fontWeight: '600'
                      }}
                    >
                      {isGenerating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Generating...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-qr-code me-2"></i>
                          Generate QR Code
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column - QR Display */}
              <div className="col-lg-6 mb-4">
                <div className="standard-card">
                  <div className="standard-card-header">
                    <h3 className="standard-card-title">
                      <i className="bi bi-qr-code-scan me-2"></i>
                      Generated QR Code
                    </h3>
                  </div>
                  <div className="standard-card-body">
                    <div className="qr-display-area" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '300px',
                      padding: 'var(--space-6)'
                    }}>
                      {generatedQR ? (
                        <div className="qr-code-generated" style={{ textAlign: 'center', width: '100%' }}>
                          <div className="qr-code-image" style={{ marginBottom: 'var(--space-4)' }}>
                            <img 
                              src={generatedQR.qrCode}
                              alt="Generated QR Code"
                              style={{ 
                                width: '256px', 
                                height: '256px', 
                                border: '2px solid var(--gray-200)',
                                borderRadius: '12px',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                padding: '12px'
                              }}
                            />
                          </div>
                          <div className="qr-item-info" style={{
                            backgroundColor: 'var(--gray-50)',
                            borderRadius: '8px',
                            padding: 'var(--space-4)',
                            marginBottom: 'var(--space-4)'
                          }}>
                            <p style={{ margin: '4px 0', fontSize: '0.95rem' }}>
                              <strong>Item:</strong> {generatedQR.itemName}
                            </p>
                            <p style={{ margin: '4px 0', fontSize: '0.95rem' }}>
                              <strong>Category:</strong> {generatedQR.itemCategory}
                            </p>
                          </div>
                          <button 
                            className="btn-standard btn-primary"
                            onClick={downloadQR}
                            style={{
                              width: '100%',
                              maxWidth: '300px',
                              padding: '12px 24px',
                              fontSize: '1rem',
                              fontWeight: '600'
                            }}
                          >
                            <i className="bi bi-download me-2"></i>
                            Download QR Code
                          </button>
                        </div>
                      ) : (
                        <div className="qr-placeholder" style={{
                          width: '100%',
                          textAlign: 'center',
                          color: 'var(--gray-500)'
                        }}>
                          <div style={{ 
                            width: '256px', 
                            height: '256px', 
                            border: '2px dashed var(--gray-300)',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--gray-50)',
                            margin: '0 auto',
                            padding: 'var(--space-4)'
                          }}>
                            <i className="bi bi-qr-code" style={{ fontSize: '4rem', color: 'var(--gray-400)', marginBottom: 'var(--space-3)' }}></i>
                            <p style={{ 
                              fontSize: '0.95rem', 
                              color: 'var(--gray-600)',
                              margin: 0,
                              maxWidth: '200px'
                            }}>
                              Enter item details and click generate to create QR code
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Use QR Codes Section - Modern Design */}
            <div className="standard-card" style={{ marginTop: 'var(--space-6)' }}>
              <div className="standard-card-header">
                <h3 className="standard-card-title">
                  <i className="bi bi-info-circle me-2"></i>
                  How to Use QR Codes
                </h3>
              </div>
              <div className="standard-card-body">
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <div className="usage-step-card" style={{
                      padding: 'var(--space-5)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--gray-50)',
                      textAlign: 'center',
                      height: '100%',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    >
                      <div className="step-icon" style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        backgroundColor: 'var(--accent-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-4)',
                        color: 'white',
                        fontSize: '2rem'
                      }}>
                        <i className="bi bi-qr-code"></i>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--space-2)', color: 'var(--text-dark)' }}>
                        Generate QR Code
                      </h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: 0 }}>
                        Enter the item name and select category, then generate a unique QR code for each item.
                      </p>
                    </div>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <div className="usage-step-card" style={{
                      padding: 'var(--space-5)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--gray-50)',
                      textAlign: 'center',
                      height: '100%',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    >
                      <div className="step-icon" style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        backgroundColor: 'var(--success-green)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-4)',
                        color: 'white',
                        fontSize: '2rem'
                      }}>
                        <i className="bi bi-download"></i>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--space-2)', color: 'var(--text-dark)' }}>
                        Download & Attach
                      </h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: 0 }}>
                        Download the QR code and print it, then attach it to the physical item.
                      </p>
                    </div>
                  </div>
                  
                  <div className="col-md-4 mb-3">
                    <div className="usage-step-card" style={{
                      padding: 'var(--space-5)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--gray-50)',
                      textAlign: 'center',
                      height: '100%',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    >
                      <div className="step-icon" style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        backgroundColor: 'var(--warning-orange)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-4)',
                        color: 'white',
                        fontSize: '2rem'
                      }}>
                        <i className="bi bi-phone"></i>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--space-2)', color: 'var(--text-dark)' }}>
                        Scan & Update
                      </h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: 0 }}>
                        Scan the QR code to access detailed item information and update records.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
