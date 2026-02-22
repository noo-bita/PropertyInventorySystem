import React, { useState } from 'react'
import { apiFetch } from '../utils/api'
import { showNotification } from '../utils/notifications'

interface CustomRequestFormProps {
  currentUser: { role: string; name: string; id?: number }
  onRequestSubmit: (requests: any[]) => Promise<void>
}

const CustomRequestForm: React.FC<CustomRequestFormProps> = ({ currentUser, onRequestSubmit }) => {
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    quantity: 1,
    location: '',
    estimated_cost: ''
  })
  const [image, setImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 1 : value
    }))
  }

  const handleEstimatedCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        estimated_cost: value
      }))
    }
  }

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(compressedDataUrl)
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showNotification('Image size must be less than 5MB', 'error')
        return
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        showNotification('Please select a valid image file', 'error')
        return
      }
      
      setImageFile(file)
      
      try {
        // Compress the image to reduce base64 size
        const compressedImage = await compressImage(file, 800, 0.8)
        setImage(compressedImage)
        console.log('Image compressed:', {
          originalSize: file.size,
          compressedSize: compressedImage.length,
          compressionRatio: ((file.size - compressedImage.length) / file.size * 100).toFixed(1) + '%'
        })
      } catch (error) {
        console.error('Error compressing image:', error)
        showNotification('Error processing image file', 'error')
        setImage(null)
        setImageFile(null)
      }
    }
  }

  const submitCustomRequest = async () => {
    // Clear previous errors
    setErrors({})
    
    // Validation
    const newErrors: { [key: string]: string } = {}
    if (!formData.item_name.trim()) {
      newErrors.item_name = 'Item name is required'
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required'
    }
    if (formData.quantity < 1) {
      newErrors.quantity = 'Quantity must be at least 1'
    }
    if (formData.estimated_cost && parseFloat(formData.estimated_cost) <= 0) {
      newErrors.estimated_cost = 'Estimated cost must be greater than zero'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (isSubmitting) return // Prevent double submission
    
    setIsSubmitting(true)
    
    try {


      const payload = {
        item_name: formData.item_name,
        teacher_name: currentUser.name,
        teacher_id: currentUser.id, // Add teacher_id
        quantity_requested: formData.quantity,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
        location: formData.location.trim(),
        subject: null, // Remove subject field
        notes: formData.description ? `CUSTOM REQUEST: ${formData.description}` : 'CUSTOM REQUEST',
        description: formData.description || '', // Allow empty description
        request_type: 'custom',
        photo: image || null // Include the base64 image or null
      }

      console.log('Sending payload:', {
        ...payload,
        photo: image ? `Base64 image (${image.length} characters)` : 'No image'
      }) // Debug log

      console.log('Submitting custom request:', payload)
      
      const res = await apiFetch('/api/custom-requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      console.log('Response status:', res.status)
      console.log('Response ok:', res.ok)

      if (!res.ok) {
        let errorMessage = 'Failed to submit custom request'
        try {
          const errorData = await res.json()
          console.log('Error data:', errorData)
          errorMessage = errorData.message || errorMessage
        } catch (jsonError) {
          console.log('JSON parse error:', jsonError)
          // If response is not JSON, use status text
          errorMessage = res.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const responseData = await res.json()
      console.log('Success response:', responseData)
      
      // Show success notification
      showNotification('Custom request submitted successfully!', 'success')
      
      // Reset form
      setFormData({
        item_name: '',
        description: '',
        quantity: 1,
        location: '',
        estimated_cost: ''
      })
      setImage(null)
      setImageFile(null)
      setErrors({})
      
      // Call parent callback if provided
      if (onRequestSubmit) {
        await onRequestSubmit([payload])
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit custom request'
      showNotification(errorMessage, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label fw-bold">
            Item Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className={`form-control ${errors.item_name ? 'is-invalid' : ''}`}
            name="item_name"
            value={formData.item_name}
            onChange={handleInputChange}
            placeholder="Enter item name"
            required
            disabled={isSubmitting}
            style={{
              padding: '10px 15px',
              fontSize: '14px',
              border: errors.item_name ? '1px solid #dc3545' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)'
            }}
          />
          {errors.item_name && (
            <div className="invalid-feedback d-block" style={{ fontSize: '0.875rem', color: '#dc3545' }}>
              {errors.item_name}
            </div>
          )}
        </div>
        
        <div className="col-md-6 mb-3">
          <label className="form-label fw-bold">
            Quantity <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            className={`form-control ${errors.quantity ? 'is-invalid' : ''}`}
            name="quantity"
            value={formData.quantity}
            onChange={handleInputChange}
            min="1"
            required
            disabled={isSubmitting}
            style={{
              padding: '10px 15px',
              fontSize: '14px',
              border: errors.quantity ? '1px solid #dc3545' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              WebkitAppearance: 'none',
              MozAppearance: 'textfield'
            }}
          />
          {errors.quantity && (
            <div className="invalid-feedback d-block" style={{ fontSize: '0.875rem', color: '#dc3545' }}>
              {errors.quantity}
            </div>
          )}
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label fw-bold">
            Estimated Cost
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
              fontWeight: '600',
              fontSize: '14px',
              zIndex: 1
            }}>
              ₱
            </span>
            <input
              type="text"
              className={`form-control ${errors.estimated_cost ? 'is-invalid' : ''}`}
              name="estimated_cost"
              value={formData.estimated_cost}
              onChange={handleEstimatedCostChange}
              placeholder="0.00"
              disabled={isSubmitting}
              style={{
                padding: '10px 15px 10px 35px',
                fontSize: '14px',
                border: errors.estimated_cost ? '1px solid #dc3545' : '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)'
              }}
            />
          </div>
          {errors.estimated_cost && (
            <div className="invalid-feedback d-block" style={{ fontSize: '0.875rem', color: '#dc3545' }}>
              {errors.estimated_cost}
            </div>
          )}
          <small className="text-muted" style={{ fontSize: '0.875rem' }}>
            Enter the estimated cost of the item (optional)
          </small>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label fw-bold">
            Location <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className={`form-control ${errors.location ? 'is-invalid' : ''}`}
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            placeholder="Enter location (e.g., Room 101, Library, Lab)"
            required
            disabled={isSubmitting}
            style={{
              padding: '10px 15px',
              fontSize: '14px',
              border: errors.location ? '1px solid #dc3545' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)'
            }}
          />
          {errors.location && (
            <div className="invalid-feedback d-block" style={{ fontSize: '0.875rem', color: '#dc3545' }}>
              {errors.location}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">Description</label>
        <textarea
          className="form-control"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={4}
          placeholder="Describe the item you need and why you need it (optional)"
          disabled={isSubmitting}
          style={{
            padding: '10px 15px',
            fontSize: '14px',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            resize: 'vertical'
          }}
        />
        <small className="text-muted" style={{ fontSize: '0.875rem' }}>
          Provide additional details to help admin understand your request
        </small>
      </div>

      <div className="mb-4">
        <label className="form-label fw-bold">Item Photo (Optional)</label>
        <input
          type="file"
          className="form-control"
          accept="image/*"
          onChange={handleImageChange}
          disabled={isSubmitting}
          style={{
            padding: '10px 15px',
            fontSize: '14px',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)'
          }}
        />
        {image && (
          <div className="mt-3">
            <img 
              src={image} 
              alt="Preview" 
              style={{ 
                maxWidth: '200px', 
                maxHeight: '200px', 
                objectFit: 'cover',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }} 
            />
            <button
              type="button"
              className="btn btn-sm btn-outline-danger ms-2"
              onClick={() => {
                setImage(null)
                setImageFile(null)
              }}
              disabled={isSubmitting}
            >
              <i className="bi bi-x"></i> Remove
            </button>
          </div>
        )}
        <small className="text-muted d-block mt-2" style={{ fontSize: '0.875rem' }}>
          Upload a photo to help identify the item you need (max 5MB)
        </small>
      </div>

      {/* Action Buttons */}
      <div className="d-flex gap-3" style={{ marginTop: '24px' }}>
        <button
          className="btn btn-primary"
          onClick={submitCustomRequest}
          disabled={isSubmitting}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: 'var(--radius-md)',
            minWidth: '160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Submitting...
            </>
          ) : (
            <>
              <i className="bi bi-send"></i>
              Submit Request
            </>
          )}
        </button>
        <button
          className="btn btn-outline-secondary"
          onClick={() => {
            setFormData({
              item_name: '',
              description: '',
              quantity: 1,
              location: '',
              estimated_cost: ''
            })
            setImage(null)
            setImageFile(null)
            setErrors({})
          }}
          disabled={isSubmitting}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: 'var(--radius-md)',
            minWidth: '120px',
            transition: 'all 0.2s ease'
          }}
        >
          <i className="bi bi-arrow-clockwise me-2"></i>
          Reset
        </button>
      </div>
    </div>
  )
}

export default CustomRequestForm
