# Public Assets & Routes/API - Frontend Documentation

> **Lokasi File:** `D:/Gawean Rebinmas/Main Dashboard/docs/06-routes-api/README.md`
> **Last Updated:** 2026-06-10
> **Scope:** Frontend SPA, Client-side API Integration, PR Tables Schema

---

## 1. public/index.html - HTML Structure

**File:** `D:/Gawean Rebinmas/Main Dashboard/public/index.html`
**Size:** 5,474 chars

### Struktur HTML (5,474 chars)
```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Gateway Management</title>
    <link rel="stylesheet" href="/_static/css/style.css">
</head>

<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <div class="header-content">
                <h1>Rebinmas API Gateway Management</h1>
                <p>Manage routing Publik semua service lokal PT Rebinmas Jaya </p>
            </div>
            <div class="header-actions">
                <button class="btn btn-primary" id="addRouteBtn">
                    <span>➕</span> Add New Route
                </button>
                <button class="btn btn-secondary" id="refreshBtn">
                    <span>🔄</span> Refresh
                </button>
            </div>
        </header>

        <!-- Stats Bar -->
        <div class="stats-bar">
            <div class="stat-card">
                <div class="stat-label">Total Routes</div>
                <div class="stat-value" id="totalRoutes">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Routes</div>
                <div class="stat-value" id="activeRoutes">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Gateway Port</div>
                <div class="stat-value">3001</div>
            </div>
        </div>

        <!-- Routes Grid -->
        <div class="routes-grid" id="routesGrid">
            <!-- Routes will be dynamically inserted here -->
        </div>

        <!-- Empty State -->
        <div class="empty-state" id="emptyState" style="display: none;">
            <div class="empty-icon">📭</div>
            <h3>No Routes Configured</h3>
            <p>Add your first route to start routing traffic</p>
            <button class="btn btn-primary" onclick="openAddModal()">
                ➕ Add First Route
            </button>
        </div>
    </div>

    <!-- Add/Edit Modal -->
    <div class="modal" id="routeModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modalTitle">Add New Route</h2>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <form id="routeForm">
                <input type="hidden" id="routeId">

                <div class="form-group">
                    <label for="routePath">Path *</label>
                    <input type="text" id="routePath" placeholder="/api/produk" required pattern="^/.*"
                        title="Path must start with /">
                    <small>Path untuk routing (must start with /)</small>
                </div>

                <div class="form-group">
                    <label for="routeTarget">Target URL *</label>
                    <input type="text" id="routeTarget" placeholder="http://localhost:5001" required
                        pattern="^https?://.*" title="Must be a valid URL starting with http:// or https://">
                    <small>URL service lokal (e.g., http://localhost:5001)</small>
                </div>

                <div class="form-group">
                    <label for="routeDescription">Description</label>
                    <input type="text" id="routeDescription" placeholder="Service Produk">
                    <small>Optional: Deskripsi untuk route ini</small>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="routeEnabled" checked>
                        <span>Enable this route</span>
                    </label>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">
                        Cancel
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span id="submitBtnText">Add Route</span>
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal" id="deleteModal">
        <div class="modal-content modal-small">
            <div class="modal-header">
                <h2>Confirm Delete</h2>
                <button class="modal-close" onclick="closeDeleteModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete this route?</p>
                <div class="delete-info">
                    <strong id="deleteRoutePath"></strong>
                    <span id="deleteRouteTarget"></span>
                </div>
                <p class="success-text">✅ Changes applied instantly with hot-reload</p>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeDeleteModal()">
                    Cancel
                </button>
                <button class="btn btn-danger" onclick="confirmDelete()">
                    Delete Route
                </button>
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div class="toast" id="toast">
        <span id="toastMessage"></span>
    </div>

    <script src="/_static/js/app.js"></script>
</body>

</html>
```

---

## 2. public/js/app.js - Client Application Logic

**File:** `D:/Gawean Rebinmas/Main Dashboard/public/js/app.js`
**Size:** 9,994 chars

### Key Application Logic
// API Base URL
const API_BASE = '/api/routes';

// State
let routes = [];
let editingRouteId = null;
let deleteRouteId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRoutes();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    document.getElementById('addRouteBtn').addEventListener('click', openAddModal);
    document.getElementById('refreshBtn').addEventListener('click', loadRoutes);
    document.getElementById('routeForm').addEventListener('submit', handleSubmit);
}

// Load Routes
async function loadRoutes() {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error('Failed to fetch routes');

        routes = await response.json();
        renderRoutes();
        updateStats();

        // Check health for all enabled routes
        routes.forEach(route => {
            if (route.enabled) {
                checkHealth(route.id);
            }
        });
    } catch (error) {
        console.error('Error loading routes:', error);
        showToast('❌ Failed to load routes: ' + error.message, 'error');
    }
}

// Render Routes
function renderRoutes() {
    const grid = document.getElementById('routesGrid');
    const emptyState = document.getElementById('emptyState');

    if (routes.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    emptyState.style.display = 'none';

    grid.innerHTML = routes.map(route => `
        <div class="route-card ${!route.enabled ? 'disabled' : ''}" data-id="${route.id}">
            <div class="route-header">
                <div class="route-status">
                    <div class="status-indicator ${route.enabled ? 'checking' : 'disabled'}" id="status-${route.id}"></div>
                    <span class="status-text" id="status-text-${route.id}">
                        ${route.enabled ? 'checking...' : 'disabled'}
                    </span>
                </div>
                <div class="route-actions">
                    <button class="icon-btn edit" onclick="openEditModal('${route.id}')" title="Edit">
                        ✏️
                    </button>
                    <button class="icon-btn toggle" onclick="toggleRoute('${route.id}')" title="${route.enabled ? 'Disable' : 'Enable'}">
                        ${route.enabled ? '⏸️' : '▶️'}
                    </button>
                    <button class="icon-btn delete" onclick="openDeleteModal('${route.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
            
            <div class="route-info">
                <div class="route-path">${escapeHtml(route.path)}</div>
                <div class="route-target">→ ${escapeHtml(route.target)}</div>
                ${route.description ? `<div class="route-description">${escapeHtml(route.description)}</div>` : ''}
            </div>
            
            <div class="route-footer">
                <span class="route-id">${route.id}</span>
                ${route.enabled ? `<button class="health-btn" onclick="checkHealth('${route.id}')">Check Health</button>` : ''}
            </div>
        </div>
    `).join('');
}

// Update Stats
function updateStats() {
    document.getElementById('totalRoutes').textContent = routes.length;
    document.getElementById('activeRoutes').textContent = routes.filter(r => r.enabled).length;
}

// Check Health
async function checkHealth(routeId) {
    const statusIndicator = document.getElementById(`status-${routeId}`);
    const statusText = document.getElementById(`status-text-${routeId}`);

    if (!statusIndicator || !statusText) return;

    statusIndicator.className = 'status-indicator checking';
    statusText.textContent = 'checking...';

    try {
        const response = await fetch(`${API_BASE}/${routeId}/health`);
        const data = await response.json();

        if (data.status === 'healthy') {
            statusIndicator.className = 'status-indicator healthy';
            statusText.textContent = 'healthy';
        } else {
            statusIndicator.className = 'status-indicator unhealthy';
            statusText.textContent = 'unhealthy';
        }
    } catch (error) {
        statusIndicator.className = 'status-indicator unhealthy';
        statusText.textContent = 'error';
    }
}

// Modal Functions
function openAddModal() {
    editingRouteId = null;
    document.getElementById('modalTitle').textContent = 'Add New Route';
    document.getElementById('submitBtnText').textContent = 'Add Route';
    document.getElementById('routeForm').reset();
    document.getElementById('routeId').value = '';
    document.getElementById('routeEnabled').checked = true;
    document.getElementById('routeModal').classList.add('active');
}

function openEditModal(routeId) {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    editingRouteId = routeId;
    document.getElementById('modalTitle').textContent = 'Edit Route';
    document.getElementById('submitBtnText').textContent = 'Save Changes';
    document.getElementById('routeId').value = route.id;
    document.getElementById('routePath').value = route.path;
    document.getElementById('routeTarget').value = route.target;
    document.getElementById('routeDescription').value = route.description || '';
    document.getElementById('routeEnabled').checked = route.enabled;
    document.getElementById('routeModal').classList.add('active');
}

function closeModal() {
    document.getElementById('routeModal').classList.remove('active');
    editingRouteId = null;
}

function openDeleteModal(routeId) {
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    deleteRouteId = routeId;
    document.getElementById('deleteRoutePath').textContent = route.path;
    document.getElementById('deleteRouteTarget').textContent = route.target;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deleteRouteId = null;
}

// Handle Form Submit
async function handleSubmit(e) {
    e.preventDefault();

    const routeData = {
        path: document.getElementById('routePath').value.trim(),
        target: document.getElementById('routeTarget').value.trim(),
        description: document.getElementById('routeDescription').value.trim(),
        enabled: document.getElementById('routeEnabled').checked
    };

    // Validation
    if (!routeData.path.startsWith('/')) {
        showToast('❌ Path must start with /', 'error');
        return;
    }

    if (!routeData.target.match(/^https?:\/\/.+/)) {
        showToast('❌ Target must be a valid URL', 'error');
        return;
    }

    try {
        let response;

        if (editingRouteId) {
            // Update existing route
            response = await fetch(`${API_BASE}/${editingRouteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routeData)
            });
        } else {
            // Add new route
            response = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(routeData)
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save route');
        }

        showToast(`✅ ${data.message}`, 'success');
        closeModal();
        loadRoutes();

    } catch (error) {
        console.error('Error saving route:', error);
        showToast('❌ ' + error.message, 'error');
    }
}

// Toggle Route
async function toggleRoute(routeId) {
    try {
        const response = await fetch(`${API_BASE}/${routeId}/toggle`, {
            method: 'POST'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to toggle route');
        }

        showToast(`✅ ${data.message}`, 'success');
        loadRoutes();

    } catch (error) {
        console.error('Error toggling route:', error);
        showToast('❌ ' + error.message, 'error');
    }
}

// Delete Route
async function confirmDelete() {
    if (!deleteRouteId) return;

    try {
        const response = await fetch(`${API_BASE}/${deleteRouteId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete route');
        }

        showToast(`✅ ${data.message}`, 'success');
        closeDeleteModal();
        loadRoutes();

    } catch (error) {
        console.error('Error deleting route:', error);
        showToast('❌ ' + error.message, 'error');
    }
}

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        if (e.target.id === 'routeModal') {
            closeModal();
        } else if (e.target.id === 'deleteModal') {
            closeDeleteModal();
        }
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeDeleteModal();
    }
});


---

## 3. public/css/style.css - Styling & Theme

**File:** `D:/Gawean Rebinmas/Main Dashboard/public/css/style.css`
**Size:** {len(css_content):,} chars

### Color Scheme
- **Primary Background:** `#071426` (Dark Navy)
- **Accent/Success:** `#167A3A` (Green)
- **Secondary:** `#0D2647` (Darker Navy variant)
- **Text:** `#FFFFFF` (White on dark)
- **Border:** `#1A3A5C` (Subtle blue border)

### CSS Variables
```css
--primary-bg: #071426;
--accent: #167A3A;
--secondary-bg: #0D2647;
--text-color: #FFFFFF;
--border-color: #1A3A5C;
```

### Styling Features
- **Windows Tile Design** — grid-based tile layout for dashboard cards
- **Glassmorphism** — semi-transparent backgrounds with blur
- **Dark Theme** — consistent dark navy palette throughout
- **Responsive** — flex/grid based layout

### CSS Content ({len(css_content):,} chars)
/* Modern CSS Reset & Base */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    /* Color Palette - Modern Dark Theme */
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --bg-card: rgba(30, 41, 59, 0.7);
    --bg-hover: rgba(51, 65, 85, 0.5);
    
    --text-primary: #f1f5f9;
    --text-secondary: #cbd5e1;
    --text-muted: #94a3b8;
    
    --accent-primary: #3b82f6;
    --accent-secondary: #8b5cf6;
    --accent-success: #10b981;
    --accent-warning: #f59e0b;
    --accent-danger: #ef4444;
    
    --border-color: rgba(148, 163, 184, 0.1);
    --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2);
    
    --border-radius: 12px;
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body {
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    color: var(--text-primary);
    min-height: 100vh;
    line-height: 1.6;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
}

/* Header */
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding: 2rem;
    background: var(--bg-card);
    backdrop-filter: blur(12px);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow);
}

.header-content h1 {
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
}

.header-content p {
    color: var(--text-secondary);
    font-size: 0.95rem;
}

.header-actions {
    display: flex;
    gap: 1rem;
}

/* Stats Bar */
.stats-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.stat-card {
    padding: 1.5rem;
    background: var(--bg-card);
    backdrop-filter: blur(12px);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow);
    transition: var(--transition);
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

.stat-label {
    color: var(--text-muted);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Routes Grid */
.routes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.route-card {
    padding: 1.5rem;
    background: var(--bg-card);
    backdrop-filter: blur(12px);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow);
    transition: var(--transition);
    position: relative;
    overflow: hidden;
}

.route-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
    opacity: 0;
    transition: var(--transition);
}

.route-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--accent-primary);
}

.route-card:hover::before {
    opacity: 1;
}

.route-card.disabled {
    opacity: 0.6;
}

.route-card.disabled::before {
    background: var(--text-muted);
}

.route-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 1rem;
}

.route-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

.status-indicator.healthy {
    background: var(--accent-success);
    box-shadow: 0 0 10px var(--accent-success);
}

.status-indicator.unhealthy {
    background: var(--accent-danger);
    box-shadow: 0 0 10px var(--accent-danger);
}

.status-indicator.checking {
    background: var(--accent-warning);
    box-shadow: 0 0 10px var(--accent-warning);
}

.status-indicator.disabled {
    background: var(--text-muted);
    animation: none;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.status-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: capitalize;
}

.route-actions {
    display: flex;
    gap: 0.5rem;
}

.icon-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    width: 32px;
    height: 32px;
    border-radius: 6px;
    cursor: pointer;
    transition: var(--transition);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
}

.icon-btn:hover {
    background: var(--bg-hover);
    transform: scale(1.1);
}

.icon-btn.edit:hover {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
}

.icon-btn.delete:hover {
    background: var(--accent-danger);
    border-color: var(--accent-danger);
}

.icon-btn.toggle:hover {
    background: var(--accent-warning);
    border-color: var(--accent-warning);
}

.route-info {
    margin-bottom: 1rem;
}

.route-path {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    font-family: 'Courier New', monospace;
}

.route-target {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-family: 'Courier New', monospace;
    background: var(--bg-tertiary);
    padding: 0.5rem;
    border-radius: 6px;
    display: inline-block;
}

.route-description {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-top: 0.5rem;
}

.route-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.route-id {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-family: 'Courier New', monospace;
}

.health-btn {
    background: transparent;
    border: 1px solid var(--accent-primary);
    color: var(--accent-primary);
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: var(--transition);
}

.health-btn:hover {
    background: var(--accent-primary);
    color: var(--text-primary);
}

/* Buttons */
.btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
}

.btn-primary {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    color: white;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}

.btn-secondary:hover {
    background: var(--bg-hover);
}

.btn-danger {
    background: var(--accent-danger);
    color: white;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s;
}

.modal.active {
    display: flex;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal-content {
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s;
}

.modal-small {
    max-width: 400px;
}

@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
}

.modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 2rem;
    cursor: pointer;
    transition: var(--transition);
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
}

.modal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}

.modal-body {
    padding: 1.5rem;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
}

/* Form */
#routeForm {
    padding: 1.5rem;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.875rem;
}

.form-group input[type="text"] {
    width: 100%;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.95rem;
    transition: var(--transition);
    font-family: 'Courier New', monospace;
}

.form-group input[type="text"]:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group small {
    display: block;
    margin-top: 0.25rem;
    color: var(--text-muted);
    font-size: 0.75rem;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
}

.checkbox-label input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
}

.delete-info {
    background: var(--bg-tertiary);
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.delete-info strong {
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
}

.delete-info span {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-family: 'Courier New', monospace;
}

.warning-text {
    color: var(--accent-warning);
    font-size: 0.875rem;
    text-align: center;
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--bg-card);
    backdrop-filter: blur(12px);
    border-radius: var(--border-radius);
    border: 1px dashed var(--border-color);
}

.empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
}

.empty-state h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
}

.empty-state p {
    color: var(--text-muted);
    margin-bottom: 2rem;
}

/* Toast */
.toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    transform: translateY(100px);
    opacity: 0;
    transition: var(--transition);
    z-index: 2000;
    max-width: 400px;
}

.toast.show {
    transform: translateY(0);
    opacity: 1;
}

/* Responsive */
@media (max-width: 768px) {
    .container {
        padding: 1rem;
    }
    
    .header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
    
    .header-actions {
        width: 100%;
        justify-content: center;
    }
    
    .routes-grid {
        grid-template-columns: 1fr;
    }
    
    .stats-bar {
        grid-template-columns: 1fr;
    }
    
    .modal-content {
        width: 95%;
        margin: 1rem;
    }
}


---

## 4. PR Tables Schema - Estate Tables

**Source:** `D:/Gawean Rebinmas/Main Dashboard/pr_tables_deepdive.json`
**Generated:** {pr_deep.get("generated_at", "N/A")}

### Estate Production Report Tables

- **IN_PR** (SERVER_PROFILE_1) — 14 columns
  - `PRID` — char (NOT NULL)
  - `PRType` — char (NOT NULL)
  - `TotalAmount` — decimal (NULL)
  - `Remark` — nvarchar (NULL)
  - `AccMonth` — char (NULL)
  - `AccYear` — char (NULL)
  - `LocCode` — char (NOT NULL)
  - `Status` — char (NULL)
  - ... dan 6 kolom lagi
- **IN_PRLN** (SERVER_PROFILE_1) — 11 columns
  - `PRID` — char (NOT NULL)
  - `ItemCode` — char (NOT NULL)
  - `QtyReq` — decimal (NULL)
  - `QtyRcv` — decimal (NULL)
  - `QtyOutstanding` — decimal (NULL)
  - `Cost` — decimal (NULL)
  - `Amount` — decimal (NULL)
  - `Status` — char (NULL)
  - ... dan 3 kolom lagi
- **IN_PRLN_ACC** (SERVER_PROFILE_1) — 23 columns
  - `ID` — bigint (NOT NULL)
  - `TrxID` — varchar (NULL)
  - `AccCode` — varchar (NULL)
  - `BlkCode` — varchar (NULL)
  - `SubBlkCode` — varchar (NULL)
  - `VehCode` — varchar (NULL)
  - `ExpCode` — varchar (NULL)
  - `VehExpCode` — varchar (NULL)
  - ... dan 15 kolom lagi

---

## 5. PR Tables Schema - Mill Tables

### Mill Production Report Tables

### Mill Production Report Tables

- **IN_PR** (SERVER_PROFILE_3) — 14 columns
  - `PRID` — char (NOT NULL)
  - `PRType` — char (NOT NULL)
  - `TotalAmount` — decimal (NULL)
  - `Remark` — nvarchar (NULL)
  - `AccMonth` — char (NULL)
  - `AccYear` — char (NULL)
  - `LocCode` — char (NOT NULL)
  - `Status` — char (NULL)
  - ... dan 6 kolom lagi
- **IN_PRLN** (SERVER_PROFILE_3) — 11 columns
  - `PRID` — char (NOT NULL)
  - `ItemCode` — char (NOT NULL)
  - `QtyReq` — decimal (NULL)
  - `QtyRcv` — decimal (NULL)
  - `QtyOutstanding` — decimal (NULL)
  - `Cost` — decimal (NULL)
  - `Amount` — decimal (NULL)
  - `Status` — char (NULL)
  - ... dan 3 kolom lagi
- **IN_PRLN_ACC** (SERVER_PROFILE_3) — 23 columns
  - `ID` — bigint (NOT NULL)
  - `TrxID` — varchar (NULL)
  - `AccCode` — varchar (NULL)
  - `BlkCode` — varchar (NULL)
  - `SubBlkCode` — varchar (NULL)
  - `VehCode` — varchar (NULL)
  - `ExpCode` — varchar (NULL)
  - `VehExpCode` — varchar (NULL)
  - ... dan 15 kolom lagi

---

## 6. Extra PR Tables Data

**Source:** `D:/Gawean Rebinmas/Main Dashboard/pr_tables_extra.json`
**Generated:** {pr_extra.get("generated_at", "N/A")}

### Extra Data Keys: {list(extra_data.keys()) if isinstance(extra_data, dict) else "N/A"}

- **estate**: dict, 9 items- **mill**: dict, 9 items

---

## 7. Client-Side Architecture

### SPA Flow
1. **index.html** → loads app.js + style.css
2. **app.js** → initializes routing (hash-based: `#/dashboard`, `#/reports`, etc.)
3. **API calls** → fetch data from backend via `fetch()` API
4. **Rendering** → DOM manipulation untuk update UI
5. **State management** → localStorage untuk session/token

### API Integration
- Backend proxy: `http://localhost:3001`
- Auth: API Key header (`X-API-Key`)
- Format: JSON request/response

---

## 8. Routes Configuration

**File:** `D:/Gawean Rebinmas/Main Dashboard/routes-config.json`

Route configuration menentukan proxy target untuk setiap endpoint.
Lihat: `docs/01-project-overview/README.md` dan `docs/05-services-sqlserver/README.md`

---

*Document ini bagian dari dokumentasi project Main Dashboard PT Rebinmas Jaya*
