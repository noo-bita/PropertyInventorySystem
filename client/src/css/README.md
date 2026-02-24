# CSS Architecture Refactoring

This directory contains page-based CSS files extracted from the monolithic `App.css`.

## File Structure

- `global.css` - Base styles, CSS variables, layout, sidebar, topbar, common components
- `login.css` - Login page specific styles
- `dashboard.css` - Dashboard KPI cards, charts, activity sections
- `inventory.css` - Inventory table, grouped items, action buttons
- `requests.css` - Request management, custom requests, return review page
- `modals.css` - All modal styles
- `users.css` - User management page
- `reports.css` - Reports page
- `settings.css` - Settings page
- `qr-generator.css` - QR generator page
- `assigned-items.css` - Assigned items page

## Import Order

1. Always import `global.css` first
2. Then import page-specific CSS files as needed

Example:
```tsx
import '../css/global.css'
import '../css/dashboard.css'
```
