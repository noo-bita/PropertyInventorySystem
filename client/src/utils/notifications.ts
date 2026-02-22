export const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  // Get existing notifications container or create one
  let container = document.getElementById('notification-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'notification-container'
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
      pointer-events: none;
    `
    document.body.appendChild(container)
  }

  // Create notification element
  const notification = document.createElement('div')
  notification.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} notification-toast`
  notification.style.cssText = `
    min-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-radius: 8px;
    padding: 16px 20px;
    margin: 0;
    animation: slideInRight 0.3s ease-out;
    pointer-events: auto;
  `
  notification.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2"></i>
      <span>${message}</span>
      <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `
  
  // Add to container (will stack automatically)
  container.appendChild(notification)
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease-out'
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove()
        }
        // Remove container if empty
        if (container && container.children.length === 0) {
          container.remove()
        }
      }, 300)
    }
  }, 5000)
}
