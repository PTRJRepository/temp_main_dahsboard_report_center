const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.GATEWAY_URL || 'http://localhost:3001'
const rootDir = path.resolve(__dirname, '..')

const failures = []

async function request(pathname, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000)
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      redirect: 'manual',
      signal: controller.signal,
      headers: options.headers,
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

async function check(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function loadRoutes() {
  const routePath = path.join(rootDir, 'routes-config.json')
  return JSON.parse(fs.readFileSync(routePath, 'utf8')).filter(route => route.enabled !== false)
}

function findSampleUpahAsset() {
  const routes = loadRoutes()
  const upah = routes.find(route => route.path === '/upah')
  const assetRoot = upah?.staticRoots?.find(root => root.prefix === '/upah/assets' && root.dir)
  const assetsDir = assetRoot
    ? path.resolve(rootDir, assetRoot.dir)
    : path.join(rootDir, 'Services', 'upah', 'dist', 'assets')
  const assetPrefix = assetRoot?.prefix || '/upah/assets'
  if (!fs.existsSync(assetsDir)) return null
  const stack = [assetsDir]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
        continue
      }
      if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(entry.name)) {
        return `${assetPrefix}/${path.relative(assetsDir, entryPath).replace(/\\/g, '/')}`
      }
    }
  }
  return null
}

async function main() {
  await check('gateway health', async () => {
    const response = await request('/__gateway/health')
    assert(response.status === 200, `expected 200, got ${response.status}`)
    const body = await response.json()
    assert(body.ok === true, 'health body missing ok=true')
  })

  await check('landing page route', async () => {
    const response = await request('/')
    assert(response.status !== 404, `expected non-404, got ${response.status}`)
    assert(response.status < 500, `expected non-5xx, got ${response.status}`)
  })

  await check('login page route', async () => {
    const response = await request('/login')
    assert(response.status !== 404, `expected non-404, got ${response.status}`)
    assert(response.status < 500, `expected non-5xx, got ${response.status}`)
  })

  await check('protected dashboard redirects unauthenticated', async () => {
    const response = await request('/dashboard')
    assert([302, 307, 308, 401].includes(response.status), `expected redirect or 401, got ${response.status}`)
    if (response.status !== 401) {
      const location = response.headers.get('location') || ''
      assert(location.includes('/login'), `expected login redirect, got ${location}`)
    }
  })

  const routes = loadRoutes()
  for (const route of routes) {
    await check(`configured route ${route.path}`, async () => {
      const response = await request(route.path, { headers: { accept: 'text/html' } })
      if (route.public === true) {
        assert(response.status !== 404, `public route returned 404`)
        assert(response.status !== 500, `public route returned raw 500`)
        return
      }
      assert([302, 307, 308, 401, 502, 503].includes(response.status) || response.status < 400,
        `unexpected status ${response.status}`)
    })
  }

  const sampleAsset = findSampleUpahAsset()
  if (sampleAsset) {
    await check('upah static asset cache header', async () => {
      const response = await request(sampleAsset)
      assert(response.status !== 404, `asset returned 404 for ${sampleAsset}`)
      const cacheControl = response.headers.get('cache-control') || ''
      assert(cacheControl.includes('max-age'), `missing cache header: ${cacheControl}`)
    })
  } else {
    console.log('SKIP upah static asset cache header: Services/upah/dist/assets not found')
  }

  if (failures.length > 0) {
    console.error('\nGateway smoke failures:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log('\nGateway smoke passed')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
