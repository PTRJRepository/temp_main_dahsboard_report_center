#!/usr/bin/env python3
"""Store inventory reference docs into MCP otak-digital-atta via raw socket."""
import socket, json, sys

TOKEN   = "fAXUhbSSl48ao15JMwjax4KwW67Ads5EwXcIcz7Df68g0-V7lnETOSnwj19JRB3I"
HOST, PORT = "10.0.0.110", 8765
CRLF = b"\r\n"

def make_socket_request(sock, method, params=None, sess_id=None, req_id=2):
    payload = {"jsonrpc":"2.0","method":method,"id":req_id}
    if params:
        payload["params"] = params
    body = json.dumps(payload).encode()
    headers = [
        f"POST /mcp HTTP/1.1",
        f"Host: {HOST}:{PORT}",
        "Content-Type: application/json",
        "Accept: application/json, text/event-stream",
        f"Authorization: Bearer {TOKEN}",
        f"Content-Length: {len(body)}",
    ]
    if sess_id:
        headers.append(f"MCP_SESSION_ID: {sess_id}")
    headers.append("")
    headers.append("")
    sock.sendall(CRLF.join(h.encode() for h in headers) + CRLF + body)
    resp = b""
    while True:
        try:
            chunk = sock.recv(16384)
            if not chunk:
                break
            resp += chunk
            if resp.endswith(CRLF) or b"0\r\n\r\n" in resp:
                break
        except socket.timeout:
            break
    return resp.decode()

def parse_jsonrpc(resp):
    for line in resp.split("\r\n"):
        if line.startswith("data: "):
            try:
                return json.loads(line[6:])
            except:
                pass
    return {}

def store_knowledge(sock, sess_id, text, project, tags, metadata=None):
    return make_socket_request(sock, "store_knowledge", {
        "text": text,
        "project": project,
        "tags": tags,
        "metadata": metadata or {}
    }, sess_id=sess_id)

# Connect once, reuse for all requests
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(30)
sock.connect((HOST, PORT))

# Initialize
init_resp = make_socket_request(sock, "initialize", {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "hermes", "version": "1.0"}
})
sess_id = None
for line in init_resp.split("\r\n"):
    if "mcp-session-id:" in line.lower():
        sess_id = line.split(":", 1)[1].strip()
        break

print(f"Session: {sess_id}")
init_data = parse_jsonrpc(init_resp)
print(f"Server: {init_data.get('result',{}).get('serverInfo',{}).get('name','?')}")

# Docs to store
BASE = "D:/Gawean Rebinmas/Main Dashboard"
docs = [
    (f"{BASE}/PR_TABLES_MCP.md",         "PR Tables (IN_PR, IN_PRLN, IN_PRLN_ACC)",
     ["inventory","ptrj","estate","mill","schema","pr-tables","in_pr"]),
    (f"{BASE}/IN_TABLES_MCP.md",         "IN Item/Month-End Tables",
     ["inventory","ptrj","estate","mill","schema","in-itemcode","in-mthend"]),
    (f"{BASE}/Dokumentasi/FUEL_TABLES_DEEP_DIVE.md", "Fuel Tables",
     ["inventory","ptrj","estate","mill","schema","fuel","diesel"]),
    (f"{BASE}/IN_LOOKUP_TABLES_MCP.md",  "Lookup Tables",
     ["inventory","ptrj","estate","mill","schema","lookup","prodtype"]),
]

results = []
for filepath, doc_label, tags in docs:
    print(f"\nStoring {doc_label}...", flush=True)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
    except Exception as e:
        print(f"  READ ERROR: {e}")
        results.append((doc_label, "READ ERROR", str(e)))
        continue

    if len(text) > 44000:
        text = text[:44000] + f"\n\n[TRUNCATED - see {filepath}]"

    resp = store_knowledge(sock, sess_id, text, "inventory-ptrj", tags,
                           {"source":"hermes","file":filepath,"label":doc_label})
    result = parse_jsonrpc(resp)
    if result.get("error"):
        print(f"  ERROR: {result['error']}")
        results.append((doc_label, "ERROR", result["error"]))
    else:
        doc_id = str(result.get("result", {}).get("doc_id", result.get("result", {})))[:80]
        print(f"  OK: {doc_id}")
        results.append((doc_label, "OK", doc_id))

sock.close()

print("\n\n=== SUMMARY ===")
for label, status, detail in results:
    print(f"  [{status}] {label}: {detail[:80]}")
print("\nDone.")
