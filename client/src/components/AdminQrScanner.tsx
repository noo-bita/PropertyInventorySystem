import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../context/AuthContext'
import { showNotification } from '../utils/notifications'

type Props = {
  isOpen: boolean
  onClose: () => void
  onDetected: (decodedText: string) => void
  title?: string
  allowedRole?: 'ADMIN' | 'TEACHER' | 'BOTH' // New prop to allow role flexibility
}

export default function AdminQrScanner({ isOpen, onClose, onDetected, title = "Scan QR Code", allowedRole = 'ADMIN' }: Props) {
  const { user } = useAuth()
  const [isCameraLoading, setIsCameraLoading] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'file'>('camera')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const startedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initRef = useRef(false) // Track if initialization is in progress

  const cleanupMediaStreams = () => {
    document.querySelectorAll('video').forEach((v) => {
      const vid = v as HTMLVideoElement
      try {
        const stream = vid.srcObject as MediaStream | null
        stream?.getTracks().forEach((t) => t.stop())
        vid.srcObject = null
      } catch {}
    })
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
      ;(window as any).__ADMIN_QR_ACTIVE = false
      
      // Also clear the DOM element
      const adminEl = document.getElementById('admin-qr-inline')
      const teacherEl = document.getElementById('teacher-qr-inline')
      if (adminEl) {
        adminEl.innerHTML = ''
      }
      if (teacherEl) {
        teacherEl.innerHTML = ''
      }
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
      
        // Use different element ID based on role
        const elementId = allowedRole === 'TEACHER' ? 'teacher-qr-inline' : 'admin-qr-inline'
        const el = document.getElementById(elementId)
        if (!el) {
          throw new Error('Scanner element not found')
        }
        
        // Create a temporary scanner instance for file scanning
        const scanner = new Html5Qrcode(elementId)
      
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
          
          onDetected(decodedText)
          await stopAndClear()
          onClose()
        }
      } catch (scanError: any) {
        // Clean up scanner on error
        try {
          await scanner.clear()
        } catch (clearError) {
          console.log('Scanner clear error (non-critical):', clearError)
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
    // Cleanup when modal closes
    if (!isOpen) {
      stopAndClear()
      return
    }

    // Check role permissions
    const hasPermission = allowedRole === 'BOTH' || 
                          (allowedRole === 'ADMIN' && user?.role === 'ADMIN') ||
                          (allowedRole === 'TEACHER' && user?.role === 'TEACHER')
    
    if (!user || !hasPermission) {
      stopAndClear()
      return
    }

    if (scanMode !== 'camera') {
      stopAndClear()
      return
    }

    // Prevent multiple initializations
    if (initRef.current || (window as any).__ADMIN_QR_ACTIVE) {
      console.warn('QR scanner already initializing or active, skipping')
      return
    }

    initRef.current = true
      ;(window as any).__ADMIN_QR_ACTIVE = allowedRole === 'ADMIN' || allowedRole === 'BOTH'
      ;(window as any).__TEACHER_QR_ACTIVE = allowedRole === 'TEACHER' || allowedRole === 'BOTH'
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
          ;(window as any).__ADMIN_QR_ACTIVE = false
        ;(window as any).__TEACHER_QR_ACTIVE = false
          return
        }
        
        // Use different element ID based on role
        const elementId = allowedRole === 'TEACHER' ? 'teacher-qr-inline' : 'admin-qr-inline'
        const el = document.getElementById(elementId)
        if (!el) { 
          setIsCameraLoading(false)
          initRef.current = false
          ;(window as any).__ADMIN_QR_ACTIVE = false
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
              onDetected(decodedText)
              stopAndClear().finally(() => onClose())
            },
            () => {}
          )
          startedRef.current = true
        } catch (e) {
          console.error('Failed to start Html5Qrcode', e)
          initRef.current = false
          ;(window as any).__ADMIN_QR_ACTIVE = false
        ;(window as any).__TEACHER_QR_ACTIVE = false
        } finally {
          setIsCameraLoading(false)
        }
      } catch (error) {
        console.error('Error in scanner initialization:', error)
        initRef.current = false
        ;(window as any).__ADMIN_QR_ACTIVE = false
        ;(window as any).__TEACHER_QR_ACTIVE = false
        setIsCameraLoading(false)
      }
    }
    
    init()

    return () => {
      cancelled = true
      stopAndClear()
    }
  }, [isOpen, user, scanMode, onDetected, onClose])

  // Check role permissions
  const hasPermission = allowedRole === 'BOTH' || 
                        (allowedRole === 'ADMIN' && user?.role === 'ADMIN') ||
                        (allowedRole === 'TEACHER' && user?.role === 'TEACHER')
  
  if (!isOpen || !user || !hasPermission) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
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
                <div style={{ width: 520, maxWidth: '100%', background: '#000', borderRadius: 12, padding: 16 }}>
                  <div id={allowedRole === 'TEACHER' ? 'teacher-qr-inline' : 'admin-qr-inline'} style={{ width: '100%', height: 360 }} />
                  <div style={{ marginTop: 12, textAlign: 'center', color: '#94a3b8' }}>Position QR code within the frame</div>
                </div>
              </div>
            ) : (
              <>
                {/* Hidden element for file scanning - always needed for Html5Qrcode */}
                <div id={allowedRole === 'TEACHER' ? 'teacher-qr-inline' : 'admin-qr-inline'} style={{ 
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  visibility: 'hidden',
                  pointerEvents: 'none'
                }} />
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


