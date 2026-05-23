import crypto from 'crypto'

// Get AUTH_SECRET from environment
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'ptrj-rebinmas-secret-key-2024'

// Create a 32-byte key from AUTH_SECRET using SHA256
function getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(AUTH_SECRET).digest()
}

/**
 * Encrypt a password using AES-256-GCM with AUTH_SECRET
 */
export function encryptPassword(password: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

    let encrypted = cipher.update(password, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Return iv:authTag:encrypted format
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt a password using AES-256-GCM with AUTH_SECRET
 */
export function decryptPassword(encryptedPassword: string): string | null {
    try {
        const key = getEncryptionKey()
        const parts = encryptedPassword.split(':')

        if (parts.length !== 3) {
            return null
        }

        const iv = Buffer.from(parts[0], 'hex')
        const authTag = Buffer.from(parts[1], 'hex')
        const encrypted = parts[2]

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(authTag)

        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (error) {
        console.error('Failed to decrypt password:', error)
        return null
    }
}
