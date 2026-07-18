#!/usr/bin/env python3
import json

with open('server_bun.js', 'rb') as f:
    raw = f.read()
content = raw.decode('utf-8')
lines = content.split('\r\n')
print(f'Lines: {len(lines)}')

# 1. Add proxy keys after IFESS_API_KEY
ki = next(i for i, l in enumerate(lines) if "IFESS_API_KEY" in l and "process.env" in l)
print(f'Key at line {ki+1}')
keys = [
    "// Phase 5: Proxy route API keys",
    "const QUERY_API_KEY = process.env.QUERY_API_KEY || 'ptrj-query-gateway-key';",
    "const UPATH_API_KEY = process.env.UPATH_API_KEY || 'ptrj-upath-key';",
    "const IFESS_CLIENT_API_KEY = process.env.IFESS_CLIENT_API_KEY || 'ptrj-ifess-client-key';",
    ""
]
for j, k in enumerate(keys):
    lines.insert(ki + 1 + j, k)
print(f'Inserted {len(keys)} key lines')

# 2. JWT check
ji = next(i for i, l in enumerate(lines) if i > 3700 and "const user = token ? verifyJWT" in l)
print(f'JWT check at line {ji+1}')

# Auth checks - condensed to one-liners to avoid quoting issues
auth = [
    "",
    "        // Phase 5: require X-API-Key for /backend/upah, /query, /ifess",
    "        const hApiKey = req.headers.get('x-api-key'); const reqId = extractRequestId(req) || createRequestId();",
    "",
    "        if (reqPath.startsWith('/backend/upah') && !hApiKey) { structuredLog('warn', 'auth_missing', { path: reqPath, requestId: reqId }); return new Response(JSON.stringify(errorEnvelope('UNAUTHORIZED', 'X-API-Key required', reqId), { status: 401, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway', 'X-Request-ID': reqId } }); }",
    "        if (reqPath.startsWith('/backend/upah') && hApiKey !== UPATH_API_KEY) { structuredLog('warn', 'auth_rejected', { path: reqPath, requestId: reqId }); return new Response(JSON.stringify(errorEnvelope('FORBIDDEN', 'Invalid X-API-Key', reqId), { status: 403, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway', 'X-Request-ID': reqId } }); }",
    "",
    "        if (reqPath.startsWith('/query') && !hApiKey) { structuredLog('warn', 'auth_missing', { path: reqPath, requestId: reqId }); return new Response(JSON.stringify(errorEnvelope('UNAUTHORIZED', 'X-API-Key required', reqId), { status: 401, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway', 'X-Request-ID': reqId } }); }",
    "        if (reqPath.startsWith('/query') && hApiKey !== QUERY_API_KEY) { structuredLog('warn', 'auth_rejected', { path: reqPath, requestId: reqId }); return new Response(JSON.stringify(errorEnvelope('FORBIDDEN', 'Invalid X-API-Key', reqId), { status: 403, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway', 'X-Request-ID': reqId } }); }",
    "",
    "        if (reqPath.startsWith('/ifess') && !hApiKey) { structuredLog('warn', 'auth_missing', { path: reqPath, requestId: reqId }); return new Response(JSON.stringify(errorEnvelope('UNAUTHORIZED', 'X-API-Key required', reqId), { status: 401, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway', 'X-Request-ID': reqId } }); }",
    "        if (reqPath.startsWith('/ifess') && hApiKey !== IFESS_CLIENT_API_KEY) { structuredLog('warn', 'auth_rejected', { path: reqPath, requestId: reqId }); return new Response(JSON.stringify(errorEnvelope('FORBIDDEN', 'Invalid X-API-Key', reqId), { status: 403, headers: { 'Content-Type': 'application/json', 'Server': 'Bun-Gateway', 'X-Request-ID': reqId } }); }",
]
for j, a in enumerate(auth):
    lines.insert(ji + 1 + j, a)
print(f'Inserted {len(auth)} auth lines')

# Write server_bun.js
with open('server_bun.js', 'w', newline='', encoding='utf-8') as f2:
    f2.write('\r\n'.join(lines))
print(f'Written: {len(lines)} lines, size={len(lines)} chars')

# 3. routes-config.json
with open('routes-config.json') as rf:
    routes = json.load(rf)
n = 0
for r in routes:
    if r.get('id') in ('backend-upah', 'query', 'ifess') and r.get('public'):
        del r['public']
        n += 1
        print(f'  Secured: {r["id"]}')
with open('routes-config.json', 'w') as wf:
    json.dump(routes, wf, indent=2, ensure_ascii=False)
print(f'routes-config.json updated ({n} routes secured)')
print('ALL DONE')
