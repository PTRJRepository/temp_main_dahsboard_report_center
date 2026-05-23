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
