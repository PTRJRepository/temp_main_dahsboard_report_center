# 🚀 API Gateway & Proxy Management System

Sistem management proxy dengan UI dashboard untuk mengelola routing dari berbagai service lokal yang berjalan di port berbeda, semuanya dapat diakses melalui **satu port gateway (3001)**.

## ✨ Features

- **📡 Dynamic Proxy Routing** - Route traffic dari satu port ke multiple backend services
- **🎛️ Web Management Dashboard** - UI yang modern dan intuitif untuk manage routes
- **✏️ CRUD Operations** - Add, Edit, Delete, Enable/Disable routes dengan mudah
- **🏥 Health Checking** - Real-time status monitoring untuk backend services
- **💾 JSON Configuration** - Simple configuration storage tanpa database
- **🔄 Hot Configuration** - Update routes TANPA PERLU restart (hot-reload otomatis!)
- **📊 Statistics Dashboard** - Lihat total routes dan active routes
- **🎨 Modern UI** - Dark theme dengan glassmorphism dan smooth animations

## 📋 Prerequisites

- Node.js v14 atau lebih tinggi
- npm atau yarn

## 🚀 Installation

1. **Install dependencies**
   ```bash
   cd d:\Dashboard_Web_Service\proxy-gateway
   npm install
   ```

2. **Start the gateway**
   ```bash
   npm start
   ```

   Atau untuk development dengan auto-reload:
   ```bash
   npm run dev
   ```

## 📖 Usage

### Panduan Layanan (Comprehensive Guide)
Untuk informasi lengkap cara menggunakan setiap layanan (Payroll, Absensi, Gdrive, dll), silakan baca:
👉 **[Panduan Komprehensif Layanan](./Dokumentasi/panduan_komprehensif_layanan.md)**

### Akses Management Dashboard

Buka browser dan navigasi ke:
```
http://localhost:3001/dashboard
```

### Add Route Baru

1. Klik tombol **"Add New Route"**
2. Isi form:
   - **Path**: URL path untuk routing (e.g., `/api/produk`)
   - **Target URL**: URL backend service (e.g., `http://localhost:5001`)
   - **Description**: Deskripsi optional
   - **Enable**: Centang untuk enable route
3. Klik **"Add Route"**
4. **Restart server** untuk apply changes

### Edit Route

1. Klik icon **✏️** pada route card
2. Update informasi yang diperlukan
3. Klik **"Save Changes"**
4. **Restart server** untuk apply changes

### Delete Route

1. Klik icon **🗑️** pada route card
2. Confirm deletion
3. **Restart server** untuk apply changes

### Enable/Disable Route

1. Klik icon **⏸️** atau **▶️** pada route card
2. **Restart server** untuk apply changes

### Check Health Status

- Health check berjalan otomatis saat dashboard load
- Klik **"Check Health"** button untuk manual check
- Status indicator:
  - 🟢 **Green** = Healthy (backend service reachable)
  - 🔴 **Red** = Unhealthy (backend service not reachable)
  - 🟡 **Yellow** = Checking...

## 📝 Configuration

Routes disimpan di `routes-config.json`:

```json
[
  {
    "id": "route-1234567890",
    "path": "/api/produk",
    "target": "http://localhost:5001",
    "description": "Service Produk",
    "enabled": true
  }
]
```

## 🔌 API Endpoints

### Management API

- `GET /api/routes` - List semua routes
- `POST /api/routes` - Add new route
- `PUT /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route
- `POST /api/routes/:id/toggle` - Toggle enable/disable
- `GET /api/routes/:id/health` - Check backend service health

### Utility Endpoints

- `GET /health` - Gateway health check
- `GET /dashboard` - Management dashboard UI

## 🌐 Example Usage

Misalkan Anda memiliki services berikut:
- **Service Produk** running di `http://localhost:5001`
- **Service User** running di `http://localhost:5002`
- **Service Payment** running di `http://localhost:5003`

Setelah configure routes di dashboard:

```
http://localhost:3001/api/produk → http://localhost:5001
http://localhost:3001/api/user → http://localhost:5002
http://localhost:3001/api/payment → http://localhost:5003
```

User hanya perlu akses **port 3001**, dan gateway akan route ke service yang sesuai!

## 🛠️ Troubleshooting

### Route tidak work setelah add/edit

**Solusi**: Restart server untuk apply changes
```bash
# Stop server (Ctrl+C)
# Start again
npm start
```

### Backend service unreachable

1. Pastikan backend service running
2. Check port number sudah benar
3. Check health status di dashboard
4. Verify target URL format: `http://localhost:PORT`

### Port 3001 sudah digunakan

Edit `server.js` dan ubah `PORT`:
```javascript
const PORT = 3002; // Ganti dengan port yang available
```

## 📂 Project Structure

```
proxy-gateway/
├── server.js              # Main gateway server
├── routes-config.json     # Routes configuration
├── package.json           # Node.js dependencies
├── public/
│   ├── index.html        # Dashboard HTML
│   ├── css/
│   │   └── style.css     # Styling
│   └── js/
│       └── app.js        # Dashboard logic
└── README.md             # This file
```

## 🎯 Features Roadmap (Future)

- [ ] Rate limiting per route
- [ ] Authentication untuk dashboard access
- [ ] Request/Response logging detail
- [ ] Analytics & metrics (total requests, response times)
- [ ] WebSocket support
- [ ] Load balancing untuk multiple instances
- [ ] Export/Import configuration

## 📄 License

MIT

---

**Made with ❤️ for easier service management**
