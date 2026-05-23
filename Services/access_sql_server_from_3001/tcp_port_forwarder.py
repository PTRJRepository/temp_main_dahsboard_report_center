"""
TCP Port Forwarder - Forward port 3001 to SQL Server port 1433
Ini adalah proxy TCP level rendah yang meneruskan semua koneksi TCP.

Jalankan script ini, lalu aplikasi lain bisa konek ke localhost:3001
dan akan diteruskan ke SQL Server di port 1433.
"""

import socket
import threading
import sys

# Konfigurasi
LOCAL_PORT = 3001              # Port proxy yang diekspos
TARGET_HOST = "localhost"      # SQL Server di mesin yang sama
TARGET_PORT = 1433             # Port SQL Server asli

BUFFER_SIZE = 4096


def forward_data(source, destination, direction):
    """Meneruskan data dari source ke destination"""
    try:
        while True:
            data = source.recv(BUFFER_SIZE)
            if not data:
                break
            destination.sendall(data)
    except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
        pass
    except Exception as e:
        print(f"[{direction}] Error: {e}")
    finally:
        try:
            source.close()
        except:
            pass
        try:
            destination.close()
        except:
            pass


def handle_client(client_socket, client_address):
    """Handle koneksi client dan buat koneksi ke target"""
    print(f"[+] Koneksi baru dari {client_address}")
    
    try:
        # Buat koneksi ke SQL Server
        target_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        target_socket.connect((TARGET_HOST, TARGET_PORT))
        print(f"[+] Terhubung ke {TARGET_HOST}:{TARGET_PORT}")
        
        # Buat thread untuk forward data di kedua arah
        client_to_target = threading.Thread(
            target=forward_data, 
            args=(client_socket, target_socket, "CLIENT->SQL"),
            daemon=True
        )
        target_to_client = threading.Thread(
            target=forward_data, 
            args=(target_socket, client_socket, "SQL->CLIENT"),
            daemon=True
        )
        
        client_to_target.start()
        target_to_client.start()
        
        # Tunggu sampai salah satu thread selesai
        client_to_target.join()
        target_to_client.join()
        
    except ConnectionRefusedError:
        print(f"[-] Tidak bisa konek ke {TARGET_HOST}:{TARGET_PORT} - SQL Server tidak berjalan?")
        client_socket.close()
    except Exception as e:
        print(f"[-] Error handling client: {e}")
        client_socket.close()
    
    print(f"[-] Koneksi dari {client_address} ditutup")


def start_proxy():
    """Mulai proxy server"""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind(("0.0.0.0", LOCAL_PORT))
        server.listen(5)
        print(f"[*] TCP Port Forwarder berjalan...")
        print(f"[*] Listening di port {LOCAL_PORT}")
        print(f"[*] Forwarding ke {TARGET_HOST}:{TARGET_PORT}")
        print(f"[*] Tekan Ctrl+C untuk berhenti\n")
        
        while True:
            client_socket, client_address = server.accept()
            client_handler = threading.Thread(
                target=handle_client,
                args=(client_socket, client_address),
                daemon=True
            )
            client_handler.start()
            
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
    except Exception as e:
        print(f"[-] Server error: {e}")
    finally:
        server.close()


if __name__ == "__main__":
    start_proxy()
