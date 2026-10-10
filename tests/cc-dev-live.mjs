// Requires an actual running CrossCode renderer with cc-dev enabled.
// Usage: node tests/cc-dev-live.mjs <game-root> [--shutdown]
// --shutdown stops cc-dev (not the game) and checks credential removal.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { request as httpRequest } from 'node:http';

const root = process.argv[2];
if (!root) throw new Error('Provide the real game root containing .cc-dev-session.json');
const sessionFile = resolve(root, '.cc-dev-session.json');
const session = JSON.parse(await readFile(sessionFile, 'utf8'));
const endpoint = new URL(session.url);
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.protocol, 'http:');
assert.equal(typeof session.token, 'string');

async function request(path, body, extra = {}) {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolveResponse, reject) => {
        // Native HTTP transmits an explicitly supplied Host header verbatim.
        const outgoing = httpRequest(new URL(path, endpoint), {
            method: payload === undefined ? 'GET' : 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
                ...(payload === undefined ? {} : {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                }),
                ...extra,
            },
            signal: AbortSignal.timeout(15000),
        }, response => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('error', reject);
            response.on('aborted', () => reject(new Error('HTTP response aborted')));
            response.on('end', () => {
                try {
                    resolveResponse({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
                } catch (error) { reject(error); }
            });
        });
        outgoing.on('error', reject);
        outgoing.end(payload);
    });
}
async function evaluate(code) {
    const response = await request('/eval', { code });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.ok, true);
    return response.body;
}

assert.equal((await request('/status', undefined, { Authorization: '' })).status, 401);
assert.equal((await request('/status', undefined, { Origin: 'https://example.invalid' })).status, 403);
assert.equal((await request('/status', undefined, { Host: 'example.invalid' })).status, 403);
const status = await request('/status');
assert.equal(status.status, 200);
assert.equal(status.body.result.ready, true);
assert.ok(Array.isArray(status.body.result.mods));

const renderer = await evaluate(`
    await Promise.resolve();
    console.info('cc-dev live smoke', typeof ig, typeof sc);
    return {
        actualGame: !!ig.game && typeof sc === 'object',
        renderer: this === window && typeof document === 'object',
        sharedService: dev === window.ccDev,
        sameStatus: JSON.stringify(dev.status()) === JSON.stringify(window.ccDev.status())
    };
`);
assert.deepEqual(renderer.result, { actualGame: true, renderer: true, sharedService: true, sameStatus: true });
assert.ok(renderer.logs.some(entry => entry.level === 'info' && entry.values.includes('"cc-dev live smoke"')));

const rejected = await request('/eval', { code: "await Promise.reject(new TypeError('cc-dev smoke rejection'));" });
assert.equal(rejected.status, 500);
assert.equal(rejected.body.error.name, 'TypeError');
assert.equal(rejected.body.error.message, 'cc-dev smoke rejection');
assert.equal(typeof rejected.body.error.stack, 'string');
const circular = await request('/eval', { code: 'const value = {}; value.self = value; return value;' });
assert.equal(circular.status, 500);
assert.match(circular.body.error.message, /serialize/i);
assert.equal((await request('/reload', { id: '__cc_dev_no_such_real_mod__' })).status, 500);

// Two requests exercise serialization on the real server and renderer. Only
// a temporary global is touched; it is removed even if a check fails.
const key = '__ccDevSmoke_' + Date.now();
const literal = JSON.stringify(key);
try {
    await evaluate(`window[${literal}] = [];`);
    await Promise.all([1, 2].map(id => evaluate(`window[${literal}].push('${id}-started'); await new Promise(resolve => setTimeout(resolve, 50)); window[${literal}].push('${id}-finished');`)));
    const trace = (await evaluate(`return window[${literal}];`)).result;
    assert.ok([
        ['1-started', '1-finished', '2-started', '2-finished'],
        ['2-started', '2-finished', '1-started', '1-finished'],
    ].some(expected => JSON.stringify(expected) === JSON.stringify(trace)), JSON.stringify(trace));
} finally {
    await evaluate(`delete window[${literal}];`);
}

if (process.argv.includes('--shutdown')) {
    // Subscribe before stopping so credential removal cannot race the check.
    const removed = new Promise((resolveRemoval, reject) => {
        const watcher = watch(dirname(sessionFile), async (_event, name) => {
            if (String(name) !== basename(sessionFile)) return;
            try { await access(sessionFile); }
            catch (error) {
                if (error.code === 'ENOENT') { clearTimeout(timer); watcher.close(); resolveRemoval(); }
                else { clearTimeout(timer); watcher.close(); reject(error); }
            }
        });
        const timer = setTimeout(() => { watcher.close(); reject(new Error('cc-dev did not remove credentials after stop')); }, 5000);
    });
    await evaluate(`
        const mod = activeMods.find(mod => mod.name === 'cc-dev');
        if (!mod || !mod.pluginInstance || typeof mod.pluginInstance.stop !== 'function') throw new Error('No real cc-dev plugin instance to stop');
        setTimeout(() => mod.pluginInstance.stop(), 50);
        return true;
    `);
    await removed;
}
console.log('Live cc-dev HTTP smoke checks passed. Plugin replacement and filesystem watching require a real participating mod and are not covered by this script.');
