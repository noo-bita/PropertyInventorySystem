import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../context/AuthContext'
import { showNotification } from '../utils/notifications'
import { getApiBaseUrl } from '../utils/api'
import TeacherItemRequestModal from './TeacherItemRequestModal'

type Props = {
  isOpen: boolean
  onClose: () => void
  onRequestSuccess: () => void
}

interface ScannedItem {
  id: number
  name: string
  category: string
  secondary_category?: string
  available: number
  location?: string
  quantity: number
  status: string
  description?: string
  serial_number?: string
}

export default function TeacherQrScanner({ isOpen, onClose, onRequestSuccess }: Props) {
  const { user: currentUser } = useAuth()
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'file'>('camera')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const startedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initRef = useRef(false)
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null)
  const [showItemDetails, setShowItemDetails] = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)

  const cleanupMediaStreams = () => {
    // Stop all video streams
    document.querySelectorAll('video').forEach((v) => {
      const vid = v as HTMLVideoElement
      try {
        const stream = vid.srcObject as MediaStream | null
        stream?.getTracks().forEach((t) => t.stop())
        vid.srcObject = null
      } catch {}
    })
    
    // Remove all video elements from the scanner container
    const teacherEl = document.getElementById('teacher-qr-inline')
    if (teacherEl) {
      const videos = teacherEl.querySelectorAll('video')
      videos.forEach(v => v.remove())
      
      // Also remove any canvas elements created by Html5Qrcode
      const canvases = teacherEl.querySelectorAll('canvas')
      canvases.forEach(c => c.remove())
      
      // Remove any other Html5Qrcode generated elements
      const qrShadedRegions = teacherEl.querySelectorAll('[id^="qr-shaded-region"]')
      qrShadedRegions.forEach(el => el.remove())
    }
  }

  const stopAndClear = async () => {
    try {
      if (scannerRef.current) {
        try { 
          await scannerRef.current.stop() 
        } catch (e) {
          console.log('Scanner stop error (expected if not started):', e)
        }
        try { 
          await scannerRef.current.clear() 
        } catch (e) {
          console.log('Scanner clear error (expected if not started):', e)
        }
        scannerRef.current = null
      }
    } finally {
      cleanupMediaStreams()
      startedRef.current = false
      initRef.current = false
      ;(window as any).__TEACHER_QR_ACTIVE = false
      
      // Clear the DOM element completely
      const teacherEl = document.getElementById('teacher-qr-inline')
      if (teacherEl) {
        // Remove all child elements
        while (teacherEl.firstChild) {
          teacherEl.removeChild(teacherEl.firstChild)
        }
        teacherEl.innerHTML = ''
      }
      
      // Also clean up any orphaned video elements
      document.querySelectorAll('video').forEach((v) => {
        const vid = v as HTMLVideoElement
        // Only remove videos that are not in any active scanner
        if (!v.closest('#teacher-qr-inline') && !v.closest('#admin-qr-inline')) {
          try {
            const stream = vid.srcObject as MediaStream | null
            stream?.getTracks().forEach((t) => t.stop())
            vid.srcObject = null
            v.remove()
          } catch {}
        }
      })
    }
  }

  const checkQRExists = async (qrData: string): Promise<ScannedItem | null> => {
    try {
      console.log('Checking QR code:', qrData)
      
      // First try the search endpoint
      const searchUrl = `${getApiBaseUrl()}/api/inventory/search?qr=${encodeURIComponent(qrData)}`
      console.log('Search URL:', searchUrl)
      
      const response = await fetch(searchUrl)
      
      if (!response.ok) {
        console.error('Search API error:', response.status, response.statusText)
        const errorText = await response.text()
        console.error('Error response:', errorText)
      }
      
      const data = await response.json()
      console.log('Search API response:', data)
      
      if (data.exists && data.item) {
        console.log('Item found via search API:', data.item)
        return {
          id: data.item.id,
          name: data.item.name,
          category: data.item.category,
          secondary_category: data.item.secondary_category,
          available: data.item.available || 0,
          location: data.item.location,
          quantity: data.item.quantity || 0,
          status: data.item.status || 'Available',
          description: data.item.description,
          serial_number: data.item.serial_number
        }
      }
      
      // If search endpoint doesn't find it, try to parse the QR data
      // QR codes might contain serial numbers directly or ITEM-{id} format
      if (qrData && qrData.trim()) {
        console.log('Search API didn\'t find item, trying direct inventory search...')
        
        // Try to find by serial number directly
        const allItemsResponse = await fetch(`${getApiBaseUrl()}/api/inventory`)
        if (allItemsResponse.ok) {
          const allItems = await allItemsResponse.json()
          console.log(`Searching through ${allItems.length} items...`)
          
          // Try multiple matching strategies
          let foundItem = allItems.find((item: any) => {
            // Exact match
            if (item.serial_number === qrData) {
              console.log('Found exact serial number match:', item.serial_number)
              return true
            }
            // Serial number contains QR data
            if (item.serial_number && item.serial_number.includes(qrData)) {
              console.log('Found serial number contains QR:', item.serial_number)
              return true
            }
            // QR data contains serial number
            if (item.serial_number && qrData.includes(item.serial_number)) {
              console.log('Found QR contains serial number:', item.serial_number)
              return true
            }
            // Try ITEM-{id} format - extract ID from QR
            if (qrData.startsWith('ITEM-')) {
              const parts = qrData.split('-')
              if (parts.length > 1) {
                const qrId = parseInt(parts[1])
                if (!isNaN(qrId) && item.id === qrId) {
                  console.log('Found by ID from ITEM- format:', item.id)
                  return true
                }
              }
            }
            return false
          })
          
          if (foundItem) {
            console.log('Item found via direct search:', foundItem)
            return {
              id: foundItem.id,
              name: foundItem.name,
              category: foundItem.category,
              secondary_category: foundItem.secondary_category,
              available: foundItem.available || 0,
              location: foundItem.location,
              quantity: foundItem.quantity || 0,
              status: foundItem.status || 'Available',
              description: foundItem.description,
              serial_number: foundItem.serial_number
            }
          } else {
            console.log('No item found matching QR code:', qrData)
          }
        } else {
          console.error('Failed to fetch all items:', allItemsResponse.status)
        }
      }
      
      console.log('QR code not found in system')
      return null
    } catch (error) {
      console.error('Error checking QR:', error)
      return null
    }
  }

  const handleQRDetected = async (decodedText: string) => {
    console.log('QR Code detected:', decodedText)
    await stopAndClear()
    
    const item = await checkQRExists(decodedText)
    if (item) {
      console.log('Item found, showing details:', item)
      setScannedItem(item)
      setShowItemDetails(true)
    } else {
      console.log('Item not found for QR:', decodedText)
      showNotification('Item not found in inventory. Please scan a valid QR code from an existing inventory item.', 'error')
      // Don't close the modal, let user try again or close manually
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsCameraLoading(true)
      // Stop any existing camera scanner first
      await stopAndClear()
      
      // Wait a bit for cleanup
      await new Promise((r) => setTimeout(r, 100))
      
      // Create a temporary hidden element for file scanning
      const tempElementId = 'teacher-qr-file-temp'
      let el = document.getElementById(tempElementId)
      if (!el) {
        el = document.createElement('div')
        el.id = tempElementId
        el.style.position = 'absolute'
        el.style.width = '1px'
        el.style.height = '1px'
        el.style.visibility = 'hidden'
        el.style.pointerEvents = 'none'
        el.style.top = '-9999px'
        document.body.appendChild(el)
      }
      
      // Create a temporary scanner instance for file scanning
      const scanner = new Html5Qrcode(tempElementId)
    
      try {
        // Scan the file - the second parameter (true) means show scan line
        const decodedText = await scanner.scanFile(file, true)
        if (decodedText) {
          // Clean up the temporary scanner
          try {
            await scanner.clear()
          } catch (clearError) {
            console.log('Scanner clear error (non-critical):', clearError)
          }
          
          // Clean up temporary element
          const tempEl = document.getElementById('teacher-qr-file-temp')
          if (tempEl) {
            tempEl.remove()
          }
          
          await handleQRDetected(decodedText)
          await stopAndClear()
        }
      } catch (scanError: any) {
        // Clean up scanner on error
        try {
          await scanner.clear()
        } catch (clearError) {
          console.log('Scanner clear error (non-critical):', clearError)
        }
        
        // Clean up temporary element
        const tempEl = document.getElementById('teacher-qr-file-temp')
        if (tempEl) {
          tempEl.remove()
        }
        
        throw scanError
      }
    } catch (error: any) {
      console.error('Error scanning QR code from file:', error)
      const errorMessage = error?.message || 'Unknown error'
      if (errorMessage.includes('No QR code found') || errorMessage.includes('No MultiFormat Readers') || errorMessage.includes('QR code parse error')) {
        showNotification('No QR code found in the image. Please make sure the image contains a valid QR code.', 'error')
      } else if (errorMessage.includes('not supported') || errorMessage.includes('format')) {
        showNotification('Image format not supported. Please use JPG, PNG, or GIF format.', 'error')
      } else {
        showNotification(`Failed to scan QR code from image: ${errorMessage}. Please make sure the image contains a valid QR code.`, 'error')
      }
    } finally {
      setIsCameraLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  useEffect(() => {
    // Aggressive cleanup on mount - remove any leftover video elements
    if (isOpen) {
      // Remove all video elements that might be from previous scans
      document.querySelectorAll('video').forEach((v) => {
        const vid = v as HTMLVideoElement
        // Only remove videos that are not in active use
        if (!v.closest('#teacher-qr-inline') || !isOpen) {
          try {
            const stream = vid.srcObject as MediaStream | null
            stream?.getTracks().forEach((t) => t.stop())
            vid.srcObject = null
            v.remove()
          } catch {}
        }
      })
    }
    
    // Cleanup when modal closes
    if (!isOpen) {
      stopAndClear()
      setScannedItem(null)
      setShowItemDetails(false)
      setShowRequestModal(false)
      return
    }

    if (scanMode !== 'camera') {
      stopAndClear()
      return
    }

    // Prevent multiple initializations
    if (initRef.current || (window as any).__TEACHER_QR_ACTIVE) {
      console.warn('QR scanner already initializing or active, skipping')
      return
    }

    initRef.current = true
    ;(window as any).__TEACHER_QR_ACTIVE = true
    let cancelled = false

    const init = async () => {
      try {
        setIsCameraLoading(true)
        
        // Stop any existing scanners first (including inventory scanner)
        await stopAndClear()
        
        // Wait a bit for cleanup to complete
        await new Promise((r) => setTimeout(r, 300))
        
        if (cancelled || !isOpen) {
          initRef.current = false
          ;(window as any).__TEACHER_QR_ACTIVE = false
          return
        }
        
        const elementId = 'teacher-qr-inline'
        const el = document.getElementById(elementId)
        if (!el) { 
          setIsCameraLoading(false)
          initRef.current = false
          ;(window as any).__TEACHER_QR_ACTIVE = false
          return 
        }
        
        // Clear the element
        el.innerHTML = ''
        
        // Create new scanner instance
        const scanner = new Html5Qrcode(elementId)
        scannerRef.current = scanner
        
        try {
          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 280, height: 280 } },
            (decodedText) => {
              if (cancelled) return
              handleQRDetected(decodedText)
              stopAndClear().finally(() => {
                // Don't close modal here, show item details instead
              })
            },
            () => {}
          )
          startedRef.current = true
        } catch (e) {
          console.error('Failed to start Html5Qrcode', e)
          initRef.current = false
          ;(window as any).__TEACHER_QR_ACTIVE = false
        } finally {
          setIsCameraLoading(false)
        }
      } catch (error) {
        console.error('Error in scanner initialization:', error)
        initRef.current = false
        ;(window as any).__TEACHER_QR_ACTIVE = false
        setIsCameraLoading(false)
      }
    }
    
    init()

    return () => {
      cancelled = true
      stopAndClear()
    }
  }, [isOpen, scanMode])

  const handleRequestClick = () => {
    if (scannedItem && scannedItem.available > 0) {
      setShowItemDetails(false)
      setShowRequestModal(true)
    }
  }

  const handleRequestSuccess = () => {
    setShowRequestModal(false)
    setScannedItem(null)
    onRequestSuccess()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* QR Scanner Modal */}
      {!showItemDetails && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Scan QR Code to Request Item</h5>
                <button type="button" className="btn-close" onClick={async () => {
                  await stopAndClear()
                  onClose()
                }}></button>
              </div>
              <div className="modal-body">
                {/* Mode Toggle */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '16px',
                  justifyContent: 'center'
                }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await stopAndClear()
                      setScanMode('camera')
                    }}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: scanMode === 'camera' ? 'var(--primary-blue)' : 'var(--gray-200)',
                      color: scanMode === 'camera' ? 'white' : 'var(--text-dark)',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                  >
                    <i className="bi bi-camera-video me-2"></i>
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await stopAndClear()
                      setScanMode('file')
                    }}
                    style={{
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: scanMode === 'file' ? 'var(--primary-blue)' : 'var(--gray-200)',
                      color: scanMode === 'file' ? 'white' : 'var(--text-dark)',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                  >
                    <i className="bi bi-image me-2"></i>
                    Upload Image
                  </button>
                </div>

                {isCameraLoading && (
                  <div className="camera-loading" style={{ 
                    textAlign: 'center', 
                    padding: '40px',
                    color: 'var(--gray-600)'
                  }}>
                    <i className="bi bi-camera-video" style={{ fontSize: '2rem', marginBottom: '12px' }}></i>
                    <p>{scanMode === 'camera' ? 'Initializing QR scanner...' : 'Scanning image...'}</p>
                  </div>
                )}

                {scanMode === 'camera' ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ 
                      width: 520, 
                      maxWidth: '100%', 
                      background: 'transparent', 
                      borderRadius: 12, 
                      padding: 16,
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div 
                        id="teacher-qr-inline" 
                        style={{ 
                          width: '100%', 
                          height: 360,
                          position: 'relative',
                          background: 'transparent',
                          overflow: 'hidden',
                          display: 'block'
                        }} 
                      />
                      <style>{`
                        #teacher-qr-inline {
                          overflow: hidden !important;
                          background: transparent !important;
                        }
                        #teacher-qr-inline video {
                          background: transparent !important;
                          width: 100% !important;
                          height: 100% !important;
                          object-fit: cover !important;
                          max-width: 100% !important;
                        }
                        #teacher-qr-inline canvas {
                          background: transparent !important;
                          max-width: 100% !important;
                        }
                        #teacher-qr-inline > div {
                          background: transparent !important;
                          width: 100% !important;
                          max-width: 100% !important;
                          overflow: hidden !important;
                        }
                        #teacher-qr-inline #qr-shaded-region {
                          max-width: 100% !important;
                        }
                      `}</style>
                      <div style={{ marginTop: 12, textAlign: 'center', color: 'var(--gray-500)' }}>Position QR code within the frame</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    padding: '40px 20px',
                    border: '2px dashed var(--gray-300)',
                    borderRadius: '12px',
                    backgroundColor: 'var(--gray-50)'
                  }}>
                    <i className="bi bi-cloud-upload" style={{ fontSize: '3rem', color: 'var(--primary-blue)', marginBottom: '16px' }}></i>
                    <p style={{ marginBottom: '16px', color: 'var(--text-dark)', fontWeight: '500' }}>
                      Upload an image containing a QR code
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: 'var(--primary-blue)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--status-pending)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--primary-blue)'
                      }}
                    >
                      <i className="bi bi-folder2-open"></i>
                      Choose Image
                    </button>
                    <p style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                      Supported formats: JPG, PNG, GIF
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanned Item Details Modal */}
      {showItemDetails && scannedItem && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-box-seam me-2"></i>
                  Item Details
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowItemDetails(false)
                    setScannedItem(null)
                    onClose()
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Item Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={scannedItem.name}
                      readOnly
                      style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Category</label>
                    <input
                      type="text"
                      className="form-control"
                      value={`${scannedItem.category}${scannedItem.secondary_category ? ` / ${scannedItem.secondary_category}` : ''}`}
                      readOnly
                      style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    />
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Available</label>
                    <input
                      type="number"
                      className="form-control"
                      value={scannedItem.available}
                      readOnly
                      style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Location</label>
                    <input
                      type="text"
                      className="form-control"
                      value={scannedItem.location || 'N/A'}
                      readOnly
                      style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    />
                  </div>
                </div>

                {scannedItem.description && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">Description</label>
                    <textarea
                      className="form-control"
                      value={scannedItem.description}
                      readOnly
                      rows={3}
                      style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    />
                  </div>
                )}

                {scannedItem.serial_number && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">Serial Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={scannedItem.serial_number}
                      readOnly
                      style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
                    />
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-bold">Status</label>
                  <div>
                    <span className={`badge ${
                      scannedItem.status === 'Available' ? 'bg-success' :
                      scannedItem.status === 'Low Stock' ? 'bg-warning' :
                      scannedItem.status === 'Out of Stock' ? 'bg-danger' :
                      'bg-secondary'
                    }`}>
                      {scannedItem.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowItemDetails(false)
                    setScannedItem(null)
                    onClose()
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${scannedItem.available > 0 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={handleRequestClick}
                  disabled={scannedItem.available <= 0}
                >
                  <i className="bi bi-cart-plus me-2"></i>
                  {scannedItem.available > 0 ? 'Request Item' : 'Out of Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && scannedItem && currentUser && (
        <TeacherItemRequestModal
          item={{
            id: scannedItem.id,
            name: scannedItem.name,
            available: scannedItem.available,
            location: scannedItem.location,
            isGrouped: false
          }}
          currentUser={{
            id: currentUser.id,
            name: currentUser.name || currentUser.email || 'Teacher'
          }}
          onClose={() => {
            setShowRequestModal(false)
            setShowItemDetails(true)
          }}
          onSuccess={handleRequestSuccess}
          isFromQR={true}
        />
      )}
    </>
  )
}
