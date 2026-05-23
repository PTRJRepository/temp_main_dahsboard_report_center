"""
SQL Server Client via Proxy Port 3001
Mengakses SQL Server melalui port proxy 3001 (yang meneruskan ke 1433)

Kredensial:
- Server: localhost
- Port: 3001 (proxy dari 1433)
- Username: sa
- Password: ptrj@123
"""

import pyodbc


def connect_via_proxy():
    """Koneksi ke SQL Server via proxy port 3001"""
    
    # Konfigurasi koneksi
    server = "223.25.98.220"  # IP Publik server
    port = 3001  # Port proxy
    database = "db_ptrj"  # Database PTRJ
    username = "sa"
    password = "ptrj@123"
    
    # Connection string untuk SQL Server
    connection_string = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server},{port};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
    )
    
    print(f"[*] Mencoba koneksi ke SQL Server...")
    print(f"[*] Server: {server}:{port}")
    print(f"[*] Username: {username}")
    print(f"[*] Database: {database}")
    print("-" * 50)
    
    try:
        # Buat koneksi
        conn = pyodbc.connect(connection_string, timeout=10)
        cursor = conn.cursor()
        
        print("[+] Koneksi berhasil!\n")
        
        # Test query - dapatkan versi SQL Server
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()[0]
        print("[SQL Server Version]")
        print(version)
        print()
        
        # Tampilkan daftar database
        print("[Daftar Database]")
        cursor.execute("SELECT name FROM sys.databases ORDER BY name")
        databases = cursor.fetchall()
        for db in databases:
            print(f"  - {db[0]}")
        print()
        
        # Tampilkan info server
        print("[Server Info]")
        cursor.execute("SELECT SERVERPROPERTY('MachineName') AS MachineName")
        machine = cursor.fetchone()[0]
        print(f"  Machine Name: {machine}")
        
        cursor.execute("SELECT SERVERPROPERTY('Edition') AS Edition")
        edition = cursor.fetchone()[0]
        print(f"  Edition: {edition}")
        
        cursor.execute("SELECT SERVERPROPERTY('ProductVersion') AS Version")
        prod_version = cursor.fetchone()[0]
        print(f"  Product Version: {prod_version}")
        
        # Tutup koneksi
        cursor.close()
        conn.close()
        print("\n[+] Koneksi ditutup.")
        
        return True
        
    except pyodbc.Error as e:
        print(f"[-] Error koneksi: {e}")
        return False


def execute_query(query, database="master"):
    """
    Eksekusi query SQL dan return hasilnya
    
    Args:
        query: SQL query string
        database: nama database (default: master)
    
    Returns:
        list of tuples hasil query, atau None jika error
    """
    server = "223.25.98.220"  # IP Publik server
    port = 3001
    username = "sa"
    password = "ptrj@123"
    
    connection_string = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server},{port};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
    )
    
    try:
        conn = pyodbc.connect(connection_string, timeout=10)
        cursor = conn.cursor()
        cursor.execute(query)
        
        # Cek apakah query mengembalikan hasil
        if cursor.description:
            results = cursor.fetchall()
        else:
            results = None
            conn.commit()
        
        cursor.close()
        conn.close()
        return results
        
    except pyodbc.Error as e:
        print(f"[-] Query error: {e}")
        return None


if __name__ == "__main__":
    print("=" * 60)
    print("  SQL Server Client - Via Proxy Port 3001")
    print("=" * 60)
    print()
    
    # Test koneksi
    success = connect_via_proxy()
    
    if success:
        print("\n" + "=" * 60)
        print("  Contoh penggunaan execute_query():")
        print("=" * 60)
        print()
        
        # Contoh penggunaan function execute_query
        print("Query: SELECT TOP 5 name FROM sys.databases")
        results = execute_query("SELECT TOP 5 name FROM sys.databases")
        if results:
            for row in results:
                print(f"  {row[0]}")
