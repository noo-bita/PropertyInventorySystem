// Get API base URL from environment variable or default to localhost for development
export const getApiBaseUrl = () => {
  // Check for environment variable first (for production)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  // Default to localhost for development
  return 'http://127.0.0.1:8000'
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('api_token')
  const headers: any = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const apiBaseUrl = getApiBaseUrl()
  return fetch(`${apiBaseUrl}${path}`, { ...options, headers })
}
