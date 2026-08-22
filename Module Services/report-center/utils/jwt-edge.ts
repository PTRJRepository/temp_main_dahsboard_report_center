/**
 * Edge-compatible JWT verification for Next.js middleware
 * Uses 'jose' library which works in Edge runtime (no Node.js deps)
 */
import * as jose from 'jose'

export interface JwtPayload {
    userId: number
    email: string
    name: string
    role: string
    iat?: number
    exp?: number
}

// Public key for RS256 verification
// This is the public key - safe to embed (not secret)
// In production, you can also use process.env.JWT_PUBLIC_KEY
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsvZtiVZBUOwHZxzf/WHg
GY+LlRZqSTC3XD3xaBZImmuhRVlk6YhtQ5a/EX7QHxbcyee6G7A882yiXcxSDElu
981drFrkuSACF/tgqNn9YAEYheRq9TQEEkGBkI+WvZkTaLBClPsqB7jCXs7wM1N2
Dm9RK9JyjghGQEuO/PF4F45IqQfYPJg8O3HBwI6wFhbgxHNC/0WDtBSTaEgShqOY
5A2Z2/d+PtivQ+5G4lRwJDCo661uBfMTXvElkdMBQk5nKvTET+3aOU+abd98EzBp
ZZk/5MiBGnntmcxoAObc2usKXP9FjB0qUQM+n2xLQJLEfUUiYwtk2na8K7fGk/gN
MQIDAQAB
-----END PUBLIC KEY-----`

let publicKeyObject: CryptoKey | null = null

async function getPublicKey(): Promise<CryptoKey> {
    if (publicKeyObject) {
        return publicKeyObject
    }

    // Try to get from environment variable first
    const envKey = process.env.JWT_PUBLIC_KEY || PUBLIC_KEY

    try {
        publicKeyObject = await jose.importSPKI(envKey, 'RS256')
        return publicKeyObject
    } catch (error) {
        console.error('Failed to import public key:', error)
        throw new Error('Failed to import public key')
    }
}

/**
 * Verify JWT token in Edge runtime (middleware)
 */
export async function verifyTokenEdge(token: string): Promise<JwtPayload | null> {
    try {
        const publicKey = await getPublicKey()
        const { payload } = await jose.jwtVerify(token, publicKey, {
            algorithms: ['RS256']
        })

        return {
            userId: payload.userId as number,
            email: payload.email as string,
            name: payload.name as string,
            role: payload.role as string,
            iat: payload.iat,
            exp: payload.exp
        }
    } catch (error) {
        console.error('Edge token verification failed:', error)
        return null
    }
}

export default { verifyTokenEdge }
