import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const argv = process.argv.slice(2);
const MOCK = argv.includes('--mock');
const PORT = Number(argv[argv.indexOf('--port') + 1]) || 3000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.woff2': 'font/woff2',
};

try {
    const env = await readFile(join(ROOT, '.env'), 'utf8');
    for (const line of env.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    }
    console.log('· loaded .env');
} catch {  }

async function serveFile(res, path, status = 200) {
    const body = await readFile(path);
    res.writeHead(status, {
        'Content-Type': MIME[extname(path)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
    });
    res.end(body);
}

async function exists(path) {
    try { return (await stat(path)).isFile(); } catch { return false; }
}

const STARTED = Date.now();
let warnedStale = false;

async function apiIsStale() {
    const dir = join(ROOT, 'api', '_lib');
    try {
        const files = await readdir(dir);
        for (const f of files) {
            const { mtimeMs } = await stat(join(dir, f));
            if (mtimeMs > STARTED) return f;
        }
    } catch {  }
    return null;
}

async function runApi(name, req, res, url) {
    const changed = await apiIsStale();
    if (changed && !warnedStale) {
        warnedStale = true;
        console.warn(`
  ┌─────────────────────────────────────────────────────────────────┐
  │  api/_lib/${changed.padEnd(20)} changed since this server started.  │
  │  Node cannot reload it in place — RESTART to pick up the change. │
  │  Until then the API keeps serving the old code.                  │
  └─────────────────────────────────────────────────────────────────┘
`);
    }
    if (changed) res.setHeader('X-Dev-Stale', changed);

    if (MOCK && name === 'stats') {
        const fixture = await readFile(join(ROOT, 'scripts/fixtures/stats.json'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(fixture);
    }

    const file = join(ROOT, 'api', `${name}.js`);
    if (!(await exists(file))) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end('{"error":"no such endpoint"}');
    }

    req.query = Object.fromEntries(url.searchParams);
    res.status = (code) => { res.statusCode = code; return res; };
    res.send = (body) => res.end(body);

    const { default: handler } = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
    await handler(req, res);
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let path = decodeURIComponent(url.pathname);

    try {
        if (path.startsWith('/api/')) {
            return await runApi(path.slice(5).split('/')[0], req, res, url);
        }

        if (/^\/journal\/[^/]+$/.test(path)) path = '/entry.html';

        if (path === '/') path = '/index.html';
        let file = normalize(join(ROOT, path));
        if (!file.startsWith(ROOT)) throw new Error('traversal');

        if (!(await exists(file)) && !extname(file)) file += '.html';

        if (await exists(file)) return await serveFile(res, file);

        return await serveFile(res, join(ROOT, '404.html'), 404);
    } catch (err) {
        console.error(req.url, err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`500 ${err.message}`);
    }
});

server.listen(PORT, () => {
    console.log(`\n  Dev server running${MOCK ? ' (mock data)' : ''}`);
    console.log(`  http://localhost:${PORT}\n`);
});
