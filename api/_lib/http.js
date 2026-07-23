export const TIMEOUT = 8000;

export function json(res, body, { maxAge = 600, swr = 86400, status = 200 } = {}) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`);
    res.status(status).send(JSON.stringify(body));
}

export async function req(url, options = {}, timeout = TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'brooksjackson.site/1.0 (personal stats page)',
                ...(options.headers || {}),
            },
        });
    } finally {
        clearTimeout(timer);
    }
}

export async function reqJson(url, options = {}, timeout = TIMEOUT) {
    const res = await req(url, options, timeout);
    if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
    return res.json();
}

export async function reqText(url, options = {}, timeout = TIMEOUT) {
    const res = await req(url, options, timeout);
    if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
    return res.text();
}

export class NotConfigured extends Error {
    constructor(what) {
        super(`Missing configuration: ${what}`);
        this.name = 'NotConfigured';
    }
}

export async function collect(name, fn) {
    try {
        const data = await fn();
        return { ok: true, state: 'live', ...data };
    } catch (err) {
        const unconfigured = err instanceof NotConfigured;
        if (!unconfigured) console.error(`[${name}]`, err);
        return {
            ok: false,
            state: unconfigured ? 'unconfigured' : 'error',
            error: err.message,
        };
    }
}
