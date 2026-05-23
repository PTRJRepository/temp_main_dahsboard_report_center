// Create admin user script
// Run with: node prisma/create-admin.js

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdmin() {
    try {
        const email = 'admin';
        const password = 'ptrj@123';
        const name = 'Administrator';
        const role = 'ADMIN';

        // Check if user exists
        const existing = await prisma.user.findUnique({
            where: { email }
        });

        if (existing) {
            console.log('User admin sudah ada!');
            console.log(`Email: ${email}`);
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role
            }
        });

        console.log('✓ Admin user created successfully!');
        console.log('----------------------------');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log(`Role: ${role}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
