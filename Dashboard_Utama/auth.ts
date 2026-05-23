import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

// Note: We cannot import userRepository here because mssql is not compatible with Edge runtime
// The actual authentication happens in /api/auth/login API route

export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET || "ptrj-rebinmas-secret-key-2024",
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().min(1), password: z.string().min(6) }) // email is actually username
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;

                    // Call our API endpoint to verify credentials
                    try {
                        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001'
                        const response = await fetch(`${baseUrl}/api/auth/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, password }),
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.user) {
                                return {
                                    id: String(data.user.id),
                                    name: data.user.name,
                                    email: data.user.email,
                                    role: data.user.role
                                };
                            }
                        }
                    } catch (error) {
                        console.error('Auth error:', error);
                    }
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
                (session.user as any).id = token.id;
            }
            return session
        }
    },
    pages: {
        signIn: '/login',
    },
    trustHost: true,
})
