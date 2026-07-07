/**
 * IFESS Control Server - Quick Test Script
 *
 * Run this to test the IFESS API endpoints:
 *
 * Usage:
 *   node scripts/test-ifess.js
 *   bun scripts/test-ifess.js
 */

const http = require('http');

const BASE_URL = process.env.GATEWAY_BASE || 'http://localhost:3001';
const API_KEY = process.env.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function test() {
    console.log('\n========================================');
    console.log('  IFESS Control Server - Test Suite');
    console.log('========================================\n');
    console.log(`Testing against: ${BASE_URL}\n`);

    // Test 1: Health Check
    console.log('📡 Test 1: Health Check (Public)');
    try {
        const res = await fetch(`${BASE_URL}/api/ifess/health`);
        const data = JSON.parse(res.body);
        console.log(`   Status: ${res.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Response: ${res.body}`);
    } catch (e) {
        console.log(`   ❌ FAIL: ${e.message}`);
    }

    // Test 2: Server Info
    console.log('\n📡 Test 2: Server Info (Public)');
    try {
        const res = await fetch(`${BASE_URL}/api/ifess/server-info`);
        const data = JSON.parse(res.body);
        console.log(`   Status: ${res.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Server URL: ${data.serverUrl}`);
        console.log(`   Port: ${data.serverPort}`);
        console.log(`   Version: ${data.version}`);
    } catch (e) {
        console.log(`   ❌ FAIL: ${e.message}`);
    }

    // Test 3: List Clients (Requires Auth)
    console.log('\n📡 Test 3: List Clients (Auth Required)');
    try {
        const res = await fetch(`${BASE_URL}/api/ifess/clients`, {
            headers: { 'X-API-Key': API_KEY }
        });
        const data = JSON.parse(res.body);
        console.log(`   Status: ${res.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Clients: ${Array.isArray(data) ? data.length : 'error'}`);
    } catch (e) {
        console.log(`   ❌ FAIL: ${e.message}`);
    }

    // Test 4: Register a Test Client
    console.log('\n📡 Test 4: Register Test Client');
    try {
        const res = await fetch(`${BASE_URL}/api/ifess/clients/register`, {
            method: 'POST',
            headers: {
                'X-API-Key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId: `test-client-${Date.now()}`,
                clientName: 'Test Client',
                machineName: 'TEST-MACHINE',
                environment: 'test',
                appVersion: '1.0.0',
                os: 'Windows'
            })
        });
        const data = JSON.parse(res.body);
        console.log(`   Status: ${res.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Response: ${JSON.stringify(data)}`);
    } catch (e) {
        console.log(`   ❌ FAIL: ${e.message}`);
    }

    // Test 5: Dashboard Summary
    console.log('\n📡 Test 5: Dashboard Summary (Auth Required)');
    try {
        const res = await fetch(`${BASE_URL}/api/ifess/dashboard`, {
            headers: { 'X-API-Key': API_KEY }
        });
        const data = JSON.parse(res.body);
        console.log(`   Status: ${res.status === 200 ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Total Clients: ${data.totalClients}`);
        console.log(`   Online: ${data.onlineClients}`);
    } catch (e) {
        console.log(`   ❌ FAIL: ${e.message}`);
    }

    // Test 6: Unauthorized Access
    console.log('\n📡 Test 6: Unauthorized Access Test');
    try {
        const res = await fetch(`${BASE_URL}/api/ifess/clients`);
        if (res.status === 401) {
            console.log(`   ✅ PASS - Correctly rejected unauthorized request`);
        } else {
            console.log(`   ⚠️  WARNING - Expected 401, got ${res.status}`);
        }
    } catch (e) {
        console.log(`   ❌ FAIL: ${e.message}`);
    }

    console.log('\n========================================');
    console.log('  Test Suite Complete');
    console.log('========================================\n');
}

test().catch(console.error);
