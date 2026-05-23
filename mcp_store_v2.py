#!/usr/bin/env python3
"""Store all inventory reference docs to MCP otak-digital-atta.
Fixed: session ID extracted from HTTP headers (not JSON-RPC body).
Uses raw socket to keep connection alive between initialize and store_knowledge.
"""
import socket, json

TOKEN   = "fAXUhbSSl48ao15JMwjax4KwW67Ads5EwXcIcz7Df68g0-V7lnETOSnwj19JRB3I"
HOST, PORT = "10.0.0.110", 8765
CRLF = b"\r\n"

def http_req(sock, method, params=None, sess_id=None, req_id=2):
    """Send JSON-RPC via HTTP/1.1 on existing socket connection."""
    payload = {"jsonrpc":"2.0","method":method,"id":req_id}
    if params: payload["params"] = params
    body = json.dumps(payload).encode()
    
    headers = [
        "POST /mcp HTTP/1.1",
        f"Host: {HOST}:{PORT}",
        "Content-Type: application/json",
        "Accept: application/json, text/event-stream",
        f"Authorization: Bearer {TOKEN}",
        f"Content-Length: {len(body)}",
    ]
    if sess_id:
        headers.append(f"MCP_SESSION_ID: {sess_id}")
    headers.append("Connection: keep-alive")
    headers.append("")  # blank line = end of headers
    headers.append("")
    
    sock.sendall(CRLF.join(h.encode() for h in headers) + CRLF + body)
    
    # Read full HTTP response
    resp = b""
    while True:
        try:
            chunk = sock.recv(16384)
            if not chunk:
                break
            resp += chunk
            # Check if we have complete response
            if b"\r\n\r\n" in resp:
                # Check for chunked encoding
                header_end = resp.find(b"\r\n\r\n")
                header_text = resp[:header_end].decode("latin-1")
                body_start = header_end + 4
                
                if "chunked" in header_text.lower():
                    # Read chunks
                    remaining = resp[body_start:]
                    full_body = b""
                    while True:
                        # Find chunk size line
                        line_end = remaining.find(b"\r\n")
                        if line_end == -1:
                            # Need more data
                            more = sock.recv(4096)
                            if not more: break
                            remaining += more
                            continue
                        chunk_size_hex = remaining[:line_end].decode().strip()
                        if not chunk_size_hex:
                            # blank line after last chunk
                            break
                        try:
                            chunk_size = int(chunk_size_hex, 16)
                        except ValueError:
                            break
                        chunk_data = remaining[line_end+2 : line_end+2+chunk_size]
                        full_body += chunk_data
                        remaining = remaining[line_end+2+chunk_size+2:]
                        if chunk_size == 0:
                            break
                    return header_text, full_body.decode("utf-8", errors="replace")
                else:
                    # Content-Length
                    cl_match = [l for l in header_text.split("\r\n") if l.lower().startswith("content-length:")]
                    if cl_match:
                        cl = int(cl_match[0].split(":")[1].strip())
                        body_received = len(resp) - body_start
                        while body_received < cl:
                            more = sock.recv(cl - body_received)
                            if not more: break
                            resp += more
                            body_received += len(more)
                        return header_text, (resp[body_start:body_start+cl]).decode("utf-8", errors="replace")
                    return header_text, ""
        except socket.timeout:
            break
    return "", ""

def parse_sse(data):
    for line in data.split("\r\n"):
        if line.startswith("data: "):
            try: return json.loads(line[6:])
            except: pass
    return {}

def parse_header(header_text):
    for line in header_text.split("\r\n"):
        if "mcp-session-id:" in line.lower():
            return line.split(":", 1)[1].strip().split(";")[0].strip()
    return None

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(30)
sock.connect((HOST, PORT))

# Initialize
_, body = http_req(sock, "initialize", {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "hermes-inventory", "version": "2.0"}
})
sess_id = parse_header(_.split("\r\n\r\n")[0]) if _ else None
init_data = parse_sse(body)
print(f"Session: {sess_id}")
print(f"Server: {init_data.get('result',{}).get('serverInfo',{}).get('name','?')}")

# Docs to store
BASE = "D:/Gawean Rebinmas/Main Dashboard"
docs = [
    (f"{BASE}/PR_TABLES_MCP.md",         "PR Tables (IN_PR, IN_PRLN, IN_PRLN_ACC)",
     ["inventory","ptrj","estate","mill","schema","pr-tables","in_pr","purchase-requisition"]),
    (f"{BASE}/IN_TABLES_MCP.md",          "IN Item/Month-End Tables (IN_ITEMCODE, IN_MTHENDITEM, IN_MTHENDTRX, IN_ITEM_ACC)",
     ["inventory","ptrj","estate","mill","schema","in-itemcode","in-mthend","item-master"]),
    (f"{BASE}/Dokumentasi/FUEL_TABLES_DEEP_DIVE.md", "Fuel Tables (IN_FUELISSUE, IN_FUELRTN)",
     ["inventory","ptrj","estate","mill","schema","fuel","diesel"]),
    (f"{BASE}/IN_LOOKUP_TABLES_MCP.md",   "Lookup Tables (IN_PRODTYPE, IN_PRODCAT, etc.)",
     ["inventory","ptrj","estate","mill","schema","lookup","prodtype"]),
    (f"{BASE}/IN_STOCK_TABLES_MCP.md",    "Stock Movement Tables (IN_STOCKISSUE, IN_STOCKRTN, IN_STOCKADJ)",
     ["inventory","ptrj","estate","mill","schema","stock-movement","in-stock"]),
]

results = []
for filepath, label, tags in docs:
    print(f"\nStoring {label}...", end=" ", flush=True)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        print(f"NOT FOUND: {filepath}")
        results.append((label, "NOT FOUND", ""))
        continue

    if len(text) > 44000:
        text = text[:44000] + f"\n\n[TRUNCATED - full doc at {filepath}]"
    
    _, body = http_req(sock, "store_knowledge", {
        "text": text,
        "project": "inventory-ptrj",
        "tags": tags,
        "metadata": {"source": "hermes", "file": filepath, "label": label}
    }, sess_id=sess_id)
    
    result = parse_sse(body)
    if result.get("error"):
        err = result["error"]
        print(f"ERROR: {err}")
        results.append((label, "ERROR", str(err)[:100]))
    else:
        doc_id = str(result.get("result", {}))[:80]
        print(f"OK")
        results.append((label, "OK", doc_id[:40]))

sock.close()

print("\n\n=== STORAGE SUMMARY ===")
ok = sum(1 for _, s, _ in results if s == "OK")
print(f"Stored: {ok}/{len(results)}")
for label, status, detail in results:
    tag = "OK" if status == "OK" else status
    print(f"  [{tag}] {label}")
print("\nDone.")