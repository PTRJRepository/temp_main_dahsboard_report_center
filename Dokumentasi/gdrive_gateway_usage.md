# Usage Guide: Gdrive Gateway (Proxy Access)

Dokumen ini menjelaskan cara menjalankan dan menggunakan Gateway untuk kebutuhan operasional melalui API Gateway.

## 1. Persiapan Lingkungan

### Instalasi Bun
Pastikan Anda sudah menginstal Bun. Jika belum:
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Konfigurasi Kredensial
1. Letakkan file `secret_key.json` (dari Google Cloud Console) ke dalam folder `_services_account/`.
2. Edit `_services_account/account.json` dan masukkan URL folder Google Drive Anda:
   ```json
   {
     "target_folder": "https://drive.google.com/drive/folders/ID_FOLDER_ANDA"
   }
   ```
3. Pastikan email Service Account Anda sudah ditambahkan sebagai **Editor** di folder Google Drive tersebut.

## 2. Menjalankan Aplikasi

### Instal Dependensi
```bash
bun install
```

### Menjalankan Server
```bash
# Mode Development (Auto-reload)
bun dev

# Mode Production
bun start
```
Server akan berjalan di `http://localhost:5178`.

## 3. Akses via Proxy Gateway

Service ini telah dikonfigurasi di Proxy Gateway (Port 3001) dengan path `/file`.

| Original URL | Proxy Gateway URL |
|--------------|-------------------|
| `http://localhost:5178/upload` | `http://localhost:3001/file/upload` |
| `http://localhost:5178/search` | `http://localhost:3001/file/search` |
| `http://localhost:5178/download` | `http://localhost:3001/file/download` |

## 4. Contoh Integrasi (cURL via Proxy)

### Upload File
```bash
curl -X POST http://localhost:3001/file/upload \
  -F "file=@/path/to/your/document.pdf"
```

### Cari File
```bash
curl "http://localhost:3001/file/search?q=statistik"
```

### Download File
```bash
curl -O -J http://localhost:3001/file/download/FILE_ID_GDIVE
```
