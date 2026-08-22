// Assert-based check for verifyJWTCached: second call hits the in-memory cache
// (same object identity), expired/malformed tokens stay uncached and rejected.
// Run: bun shared/auth/jwt.test.ts   (or: npx tsx shared/auth/jwt.test.ts)
import assert from 'node:assert';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { setPublicKey, verifyJWTCached } from './jwt.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
setPublicKey(publicKey.export({ type: 'spki', format: 'pem' }).toString());

const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function signToken(payload: object) {
    const head = b64url({ alg: 'RS256', typ: 'JWT' });
    const body = b64url(payload);
    const signer = createSign('RSA-SHA256');
    signer.update(`${head}.${body}`);
    signer.end();
    return `${head}.${body}.${signer.sign(privateKey, 'base64url')}`;
}

const now = Math.floor(Date.now() / 1000);
const token = signToken({ sub: 'u1', role: 'ADMIN', exp: now + 60 });

const first = verifyJWTCached(token, '.');
assert.ok(first, 'valid token verifies');
assert.equal(first!.sub, 'u1');

const second = verifyJWTCached(token, '.');
assert.strictEqual(second, first, 'second call served from cache (same object)');

const expired = signToken({ sub: 'u2', exp: now - 10 });
assert.equal(verifyJWTCached(expired, '.'), null, 'expired token rejected');
assert.equal(verifyJWTCached(expired, '.'), null, 'expired token never cached');

assert.equal(verifyJWTCached('not.a.jwt', '.'), null);
assert.equal(verifyJWTCached('', '.'), null);
assert.equal(verifyJWTCached(undefined as unknown as string, '.'), null);

console.log('jwt.test: all assertions passed');
