import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

let privateKey: string = ''
let publicKey: string = ''

// Load keys - server.js runs from proxy-gateway
// Next.js runs from Dashboard_Utama via server.js
function loadKeys() {
    // Try multiple relative paths
    const possibleDirs = [
        // If cwd is Dashboard_Utama (Next.js direct)
        path.join(process.cwd(), 'keys'),
        // If cwd is proxy-gateway (server.js)
        path.join(process.cwd(), 'Dashboard_Utama', 'keys'),
    ]

    for (const keysDir of possibleDirs) {
        const privPath = path.join(keysDir, 'private.pem')
        const pubPath = path.join(keysDir, 'public.pem')

        try {
            if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
                privateKey = fs.readFileSync(privPath, 'utf8')
                publicKey = fs.readFileSync(pubPath, 'utf8')
                console.log('✅ RSA keys loaded from:', keysDir)
                return
            }
        } catch (error) {
            // Continue to next path
        }
    }

    console.error('⚠️ RSA keys not found. Tried:', possibleDirs)
}

loadKeys()

export interface JwtPayload {
    userId: number
    email: string
    name: string
    role: string
    iat?: number
    exp?: number
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    if (!privateKey) {
        throw new Error('Private key not loaded')
    }

    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        expiresIn: '8h',
    })
}

export function verifyToken(token: string): JwtPayload | null {
    if (!publicKey) {
        throw new Error('Public key not loaded')
    }

    try {
        const decoded = jwt.verify(token, publicKey, {
            algorithms: ['RS256']
        }) as JwtPayload
        return decoded
    } catch (error) {
        console.error('Token verification failed:', error)
        return null
    }
}

export function getPublicKey(): string {
    return publicKey
}

export default { signToken, verifyToken, getPublicKey }
