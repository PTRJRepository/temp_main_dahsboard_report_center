# SQL Server Port Forwarding & Client

Program Python untuk melakukan port forwarding dari port 3001 ke SQL Server port 1433, serta client untuk mengakses SQL Server.

## Struktur File

```
access_sql_server_from_3001/
├── tcp_port_forwarder.py   # TCP proxy untuk forward port 3001 -> 1433
├── sql_server_client.py    # Client untuk akses SQL Server via proxy
├── requirements.txt        # Dependencies Python
└── README.md              # Dokumentasi ini
```

## Cara Penggunaan

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

> **Note:** Anda juga perlu menginstall **ODBC Driver 17 for SQL Server** dari Microsoft:
> https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

### 2. Jalankan Port Forwarder (Terminal 1)

```bash
python tcp_port_forwarder.py
```

Output:
```
[*] TCP Port Forwarder berjalan...
[*] Listening di port 3001
[*] Forwarding ke localhost:1433
[*] Tekan Ctrl+C untuk berhenti
```

### 3. Test Koneksi via Client (Terminal 2)

```bash
python sql_server_client.py
```

## Konfigurasi

### Port Forwarder (`tcp_port_forwarder.py`)

```python
LOCAL_PORT = 3001          # Port proxy yang diekspos
TARGET_HOST = "localhost"   # Host SQL Server
TARGET_PORT = 1433         # Port SQL Server asli
```

### SQL Client (`sql_server_client.py`)

```python
server = "localhost"
port = 3001          # Port proxy
username = "sa"
password = "ptrj@123"
```

## Penggunaan dalam Kode Anda

```python
from sql_server_client import execute_query

# Query sederhana
results = execute_query("SELECT * FROM TableName", database="DatabaseName")

# Loop hasil
for row in results:
    print(row)
```

## Catatan Penting

1. **Pastikan SQL Server berjalan** di port 1433 sebelum menjalankan port forwarder
2. **Port forwarder harus aktif** selama menggunakan client via port 3001
3. Jika hanya ingin akses dari Python saja, Anda bisa langsung konek ke port 1433 tanpa forwarder
4. Port forwarder berguna jika:
   - Aplikasi lain perlu akses SQL Server via port berbeda
   - Ingin membuat abstraksi layer antara aplikasi dan database
   - Testing dalam environment terbatas
