/**
 * Script untuk generate self-signed SSL certificate
 * Menggunakan Node.js crypto module
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, 'keys');

// Pastikan direktori keys ada
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

const keyPath = path.join(keysDir, 'ssl.key');
const certPath = path.join(keysDir, 'ssl.crt');

console.log('🔐 Generating self-signed SSL certificate...\n');

// Menggunakan PowerShell untuk generate self-signed certificate
// Karena OpenSSL tidak tersedia, kita gunakan pendekatan Node.js

const crypto = require('crypto');

// Generate RSA key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

// Save private key
fs.writeFileSync(keyPath, privateKey);
console.log(`✅ Private key saved to: ${keyPath}`);

// For self-signed certificate, we need to create a proper X.509 certificate
// Node.js crypto alone cannot create X.509 certificates, so we'll use a simple approach
// by installing 'selfsigned' package or creating manually

// Let's create a simple self-signed certificate using forge library approach
// Since we might not have the library, let's try an alternative

console.log('\n⚠️  Node.js native crypto cannot create X.509 certificates directly.');
console.log('📦 Installing "selfsigned" package to generate certificate...\n');

try {
    execSync('npm install selfsigned --save-dev', {
        cwd: __dirname,
        stdio: 'inherit'
    });

    const selfsigned = require('selfsigned');

    const attrs = [
        { name: 'commonName', value: 'localhost' },
        { name: 'countryName', value: 'ID' },
        { name: 'stateOrProvinceName', value: 'Indonesia' },
        { name: 'localityName', value: 'Jakarta' },
        { name: 'organizationName', value: 'PTRJ Development' },
        { name: 'organizationalUnitName', value: 'IT' }
    ];

    const pems = selfsigned.generate(attrs, {
        keySize: 2048,
        days: 365, // Valid for 1 year
        algorithm: 'sha256',
        extensions: [
            {
                name: 'subjectAltName',
                altNames: [
                    { type: 2, value: 'localhost' },
                    { type: 7, ip: '127.0.0.1' },
                    { type: 7, ip: '10.0.0.110' }
                ]
            }
        ]
    });

    // Save the generated certificate and key
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);

    console.log(`\n✅ SSL Certificate generated successfully!`);
    console.log(`   Private Key: ${keyPath}`);
    console.log(`   Certificate: ${certPath}`);
    console.log(`\n📋 Certificate Details:`);
    console.log(`   - Common Name: localhost`);
    console.log(`   - Organization: PTRJ Development`);
    console.log(`   - Valid for: 365 days`);
    console.log(`   - Alternative Names: localhost, 127.0.0.1, 10.0.0.110`);
    console.log(`\n🚀 Anda sekarang bisa menjalankan server dengan HTTPS!`);

} catch (error) {
    console.error('❌ Error generating certificate:', error.message);
    process.exit(1);
}
