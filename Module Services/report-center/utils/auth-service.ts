import { userRepository, User, UserWithoutPassword } from './user-repository'
import { serviceRepository, Service } from './service-repository'
import { signToken } from './jwt'
import fs from 'fs'
import path from 'path'

export interface AuthResult {
    success: boolean
    token?: string
    user?: UserWithoutPassword
    error?: string
}

const BYPASS_USERNAME = process.env.AUTH_BYPASS_USERNAME || 'bypss_ptrj'
const BYPASS_ENABLED = process.env.AUTH_BYPASS_ENABLED !== 'false'

/**
 * Load the shared access key. Module services read the SAME file
 * (repo-root /keys/report-center-access.key) so rotating the key file
 * takes effect everywhere without code changes. Falls back to env
 * AUTH_BYPASS_PASSWORD / REPORT_CENTER_ACCESS_KEY.
 */
function loadAccessKey(): string {
    const candidates = [
        path.join(process.cwd(), '..', '..', 'keys', 'report-center-access.key'),
        path.join(process.cwd(), 'keys', 'report-center-access.key'),
    ]
    for (const filePath of candidates) {
        try {
            if (fs.existsSync(filePath)) {
                const value = fs.readFileSync(filePath, 'utf8').trim()
                if (value) return value
            }
        } catch { /* try next candidate */ }
    }
    return process.env.REPORT_CENTER_ACCESS_KEY || process.env.AUTH_BYPASS_PASSWORD || 'bypass_ptrj123'
}

const ACCESS_KEY = loadAccessKey()

function authenticateBypass(email: string, password: string): AuthResult | null {
    if (!BYPASS_ENABLED) return null
    // Shared access key: any username + correct key = ADMIN session.
    // The key file is the single source of truth — change it to rotate.
    if (password !== ACCESS_KEY) return null

    const bypassUser: UserWithoutPassword = {
        id: 0,
        name: 'Bypass PTRJ',
        email: BYPASS_USERNAME,
        plainPassword: undefined,
        role: 'ADMIN',
        divisi: 'ALL',
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const token = signToken({
        userId: bypassUser.id,
        email: bypassUser.email,
        name: bypassUser.name,
        role: bypassUser.role,
        username: bypassUser.email,
        divisi: bypassUser.divisi,
        division: bypassUser.divisi,
        divisions: bypassUser.divisi ? [bypassUser.divisi] : []
    })

    return {
        success: true,
        token,
        user: bypassUser,
    }
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
    try {

        const bypassResult = authenticateBypass(email, password)
        if (bypassResult) {
            console.log('Bypass login accepted:', email)
            return bypassResult
        }
        console.log('🔍 Looking up user:', email)
        const user = await userRepository.verifyPassword(email, password)

        console.log('🔍 User lookup result:', user ? { id: user.id, email: user.email, role: user.role } : 'NOT FOUND')

        if (!user) {
            return { success: false, error: 'Email atau password salah' }
        }

        // Generate JWT token
        const token = signToken({
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            username: user.email,
            divisi: user.divisi || null,
            division: user.divisi || null,
            divisions: user.divisi ? [user.divisi] : []
        })
        console.log('✅ Token generated for user:', user.id)

        // Return user without password
        const { password: _, ...userWithoutPassword } = user

        return {
            success: true,
            token,
            user: userWithoutPassword
        }
    } catch (error) {
        console.error('Authentication error:', error)
        return { success: false, error: 'Gagal melakukan autentikasi' }
    }
}

/**
 * Get services allowed for a user role
 */
export async function getUserServices(role: string): Promise<Service[]> {
    try {
        return await serviceRepository.findByRole(role)
    } catch (error) {
        console.error('Error fetching services:', error)
        return []
    }
}

/**
 * Create new user
 */
export async function createUser(
    name: string,
    email: string,
    password: string,
    role: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if email exists
        const existing = await userRepository.findByEmail(email)
        if (existing) {
            return { success: false, error: 'Email sudah terdaftar' }
        }

        await userRepository.create({ name, email, password, role })
        return { success: true }
    } catch (error) {
        console.error('Error creating user:', error)
        return { success: false, error: 'Gagal membuat user' }
    }
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<UserWithoutPassword[]> {
    return userRepository.findAll()
}

/**
 * Delete user
 */
export async function deleteUser(id: number): Promise<boolean> {
    return userRepository.delete(id)
}

export default {
    authenticateUser,
    getUserServices,
    createUser,
    getAllUsers,
    deleteUser
}
