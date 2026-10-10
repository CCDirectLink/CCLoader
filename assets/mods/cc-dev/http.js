function errorBody(error) {
    return { ok: false, error: {
        name: error && error.name || 'Error',
        message: error && error.message || String(error),
        stack: error && error.stack || undefined
    } };
}

function httpError(status, message) {
    return Object.assign(new Error(message), { status });
}

export class DevServer {
    constructor({ http, crypto, fs, evaluate, dev, sessionFile, port = 0, timeout = 10000, maxBytes = 1024 * 1024 }) {
        Object.assign(this, { http, crypto, fs, evaluate, dev, sessionFile, port, timeout, maxBytes });
        this.token = crypto.randomBytes(32).toString('hex');
        this.evalQueue = Promise.resolve();
        this.closed = false;
        this.sockets = new Set();
    }

    async start() {
        this.server = this.http.createServer((request, response) => {
            this.handle(request, response).catch(error => this.send(response, error && error.status || 500, errorBody(error)));
        });
        this.server.on('connection', socket => {
            this.sockets.add(socket);
            socket.on('close', () => this.sockets.delete(socket));
        });
        this.server.headersTimeout = 10000;
        this.server.requestTimeout = 15000;
        await new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(this.port, '127.0.0.1', resolve);
        });
        const port = this.server.address().port;
        if (this.closed) {
            await this.stop();
            throw new Error('cc-dev stopped during HTTP startup');
        }
        this.host = '127.0.0.1:' + port;
        this.session = { url: 'http://' + this.host, token: this.token };
        try {
            // An existing file may belong to another game instance. Never overwrite it.
            this.fs.writeFileSync(this.sessionFile, JSON.stringify(this.session, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
            this.ownsSession = true;
        } catch (error) {
            await this.stop();
            throw new Error('Cannot create cc-dev session file: ' + error.message + '. Remove a stale file only after closing its game session.');
        }
        return this.session;
    }

    authorized(request) {
        const supplied = request.headers.authorization || '';
        const expected = 'Bearer ' + this.token;
        const left = Buffer.from(supplied);
        const right = Buffer.from(expected);
        return left.length === right.length && this.crypto.timingSafeEqual(left, right);
    }

    async handle(request, response) {
        if (this.closed) throw httpError(503, 'cc-dev is stopped');
        if (request.headers.origin || (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'none')) {
            throw httpError(403, 'Browser-origin requests are not allowed');
        }
        if (request.headers.host !== this.host) throw httpError(403, 'Invalid Host');
        if (!this.authorized(request)) throw httpError(401, 'Authentication required');
        if (request.method === 'GET' && request.url === '/status') {
            this.send(response, 200, { ok: true, result: this.dev.status() });
            return;
        }
        if (request.method !== 'POST' || !['/eval', '/reload'].includes(request.url)) throw httpError(404, 'Unknown endpoint');
        if ((request.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') {
            throw httpError(415, 'Expected application/json');
        }
        const body = await this.readBody(request);
        if (request.url === '/reload') {
            if (typeof body.id !== 'string' || !body.id) throw httpError(400, 'Expected a mod id');
            this.send(response, 200, { ok: true, result: await this.dev.reload(body.id) });
            return;
        }
        if (typeof body.code !== 'string') throw httpError(400, 'Expected code as a string');
        // A timed-out evaluation still owns the queue until its code settles.
        // Otherwise a slow old eval could mutate the game during the next eval.
        const task = this.evalQueue.then(() => {
            if (this.closed) throw httpError(503, 'cc-dev is stopped');
            return this.runEval(body.code);
        });
        this.evalQueue = task.then(result => result.pending ? result.pending.catch(() => {}) : undefined, () => {});
        const result = await task;
        this.send(response, result.status, result.body);
    }

    readBody(request) {
        return new Promise((resolve, reject) => {
            let size = 0;
            const chunks = [];
            request.on('data', chunk => {
                size += chunk.length;
                if (size > this.maxBytes) {
                    chunks.length = 0;
                    reject(httpError(413, 'Request is too large'));
                } else chunks.push(chunk);
            });
            request.on('end', () => {
                if (size > this.maxBytes) return;
                try {
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
                    resolve(body);
                } catch (_error) { reject(httpError(400, 'Invalid JSON object')); }
            });
            request.on('error', reject);
            request.on('aborted', () => reject(httpError(400, 'Request aborted')));
        });
    }

    async runEval(code) {
        const logs = [];
        let logBytes = 0;
        const captured = {};
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
            captured[level] = (...args) => {
                if (logs.length >= 100 || logBytes >= 65536) return;
                const values = args.map(value => {
                    try {
                        const json = JSON.stringify(value);
                        return json === undefined ? String(value) : json.slice(0, 4096);
                    } catch (_error) { return '[unserializable]'; }
                });
                const entry = { level, values };
                logBytes += JSON.stringify(entry).length;
                logs.push(entry);
            };
        }
        let timer;
        const execution = Promise.resolve().then(() => this.evaluate(code, captured, this.dev));
        const expired = new Promise(resolve => {
            timer = setTimeout(() => resolve({ timedOut: true }), this.timeout);
        });
        try {
            const outcome = await Promise.race([
                execution.then(value => ({ value }), error => ({ failed: true, error })), expired
            ]);
            if (outcome.timedOut) {
                // Send the timeout immediately, but preserve execution serialization.
                return { status: 504, body: { ...errorBody(new Error('Evaluation timed out; code may still be running')), logs }, pending: execution };
            }
            if (outcome.failed) return { status: 500, body: { ...errorBody(outcome.error), logs } };
            // Serialization is validated in send(); undefined has a stable wire value.
            return { status: 200, body: { ok: true, result: outcome.value === undefined ? null : outcome.value, logs } };
        } finally {
            clearTimeout(timer);
        }
    }

    send(response, status, body) {
        if (response.destroyed || response.writableEnded) return;
        let json;
        try {
            json = JSON.stringify(body);
            if (Buffer.byteLength(json) > this.maxBytes) throw new Error('Response is too large');
        } catch (error) {
            status = 500;
            json = JSON.stringify(errorBody(new Error('Cannot serialize result: ' + error.message)));
        }
        response.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        response.end(json);
    }

    async stop() {
        this.closed = true;
        if (this.ownsSession) {
            try {
                const current = JSON.parse(this.fs.readFileSync(this.sessionFile, 'utf8'));
                if (current.token === this.token) this.fs.unlinkSync(this.sessionFile);
            } catch (_error) { /* File may already have been removed. */ }
            this.ownsSession = false;
        }
        if (this.server && this.server.listening) {
            const closed = new Promise(resolve => this.server.close(resolve));
            for (const socket of this.sockets) socket.destroy();
            await closed;
        }
    }
}
