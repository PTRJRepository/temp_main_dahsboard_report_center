import { userRepository, User, UserWithoutPassword } from './user-repository'
import { serviceRepository, Service } from './service-repository'
import { signToken } from './jwt'

export interface AuthResult {
    success: boolean
    token?: string
    user?: UserWithoutPassword
    error?: string
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(email: string, password: string): Promise<AuthResult> {
    try {
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
            role: user.role
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
