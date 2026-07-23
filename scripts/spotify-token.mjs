import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const ENV = join(ROOT, '.env');
const SCOPES = 'user-top-read user-read-currently-playing user-read-recently-played';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

function fail(message) {
    console.error(message);

    process.exitCode = 1;
}

let envText = '';

try {
    envText = await readFile(ENV, 'utf8');
} catch {
    fail('\n  No .env found. Copy .env.example to .env first.\n');
}

const read = (key) => envText.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');

const clientId = read('SPOTIFY_CLIENT_ID');
const clientSecret = read('SPOTIFY_CLIENT_SECRET');

const flagIndex = process.argv.indexOf('--redirect');
const REDIRECT = (flagIndex >= 0 && process.argv[flagIndex + 1])
    || read('SPOTIFY_REDIRECT_URI')
    || 'http://127.0.0.1:8888/callback';

const basic = () => `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

const page = (title, body, action = '') => `<!doctype html><meta charset="utf-8">
<title>${title}</title>
<style>
  body{background:#f4f1ea;color:#14110f;font:16px/1.6 Georgia,serif;
       display:grid;place-content:center;height:100vh;margin:0;text-align:center}
  h1{font-size:2.5rem;font-weight:400;letter-spacing:-.02em;margin:0 0 .5rem}
  p{color:rgba(20,17,15,.7);margin:0;max-width:34rem}
  b{color:#b3341f}
  a.go{display:inline-block;margin-top:1.75rem;padding:.75rem 1.5rem;
       background:#14110f;color:#f4f1ea;text-decoration:none;
       font:500 11px/1 ui-monospace,monospace;letter-spacing:.2em;
       text-transform:uppercase}
  a.go:hover{background:#b3341f}
</style>
<h1>${title}</h1><p>${body}</p>${action}`;

async function exchange(code) {
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT }),
    });

    const data = await res.json();

    if (!res.ok || !data.refresh_token) {
        throw new Error(data.error_description || data.error || `HTTP ${res.status}`);
    }

    return data.refresh_token;
}

async function save(token) {
    const line = `SPOTIFY_REFRESH_TOKEN=${token}`;
    const next = /^\s*SPOTIFY_REFRESH_TOKEN\s*=.*$/m.test(envText)
        ? envText.replace(/^\s*SPOTIFY_REFRESH_TOKEN\s*=.*$/m, line)
        : `${envText.replace(/\s*$/, '')}\n${line}\n`;
    await writeFile(ENV, next, 'utf8');
}

function openBrowser(url) {
    try {
        const [cmd, args] = process.platform === 'win32'

            ? ['powershell', ['-NoProfile', '-Command', `Start-Process '${url}'`]]
            : process.platform === 'darwin'
                ? ['open', [url]]
                : ['xdg-open', [url]];

        spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();

        return true;
    } catch {
        return false;
    }
}

async function main() {
    if (process.exitCode) return;

    let redirectUrl;

    try {
        redirectUrl = new URL(REDIRECT);
    } catch {
        return fail(`\n  Redirect URI is not a valid URL: ${REDIRECT}\n`);
    }

    const HOST = redirectUrl.hostname;
    const PORT = Number(redirectUrl.port) || 80;
    const CALLBACK_PATH = redirectUrl.pathname;

    if (HOST === 'localhost') {
        return fail(`
  Spotify no longer accepts "localhost" in a redirect URI — it requires the
  loopback address. Use 127.0.0.1 instead, in both places:

    ${REDIRECT.replace('localhost', '127.0.0.1')}
`);
    }

    if (!clientId || !clientSecret) {
        return fail(`
  SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in .env first.

  1. developer.spotify.com/dashboard → Create app
  2. Add this exact redirect URI, then click Add:  ${REDIRECT}
  3. Tick "Web API", accept the terms, Save
  4. Settings → copy the Client ID and secret into .env
  5. Run this again
`);
    }

    const preflight = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
    }).then((r) => r.json()).catch(() => null);

    if (!preflight?.access_token) {
        return fail(`
  Spotify rejected the credentials in .env: ${preflight?.error_description || preflight?.error || 'no response'}

  Both values should be 32 lowercase hex characters.
  Yours are ${clientId.length} and ${clientSecret.length} characters long.

  Re-copy them from developer.spotify.com/dashboard → your app → Settings.
`);
    }

    const state = Math.random().toString(36).slice(2);
    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: REDIRECT,
        scope: SCOPES,
        state,
    })}`;

    const done = (server) => {
        server.closeAllConnections?.();
        server.close();
    };

    const server = createServer(async (req, res) => {
        const url = new URL(req.url, `http://${HOST}:${PORT}`);
        const send = (code, html) =>
            res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);

        if (url.pathname === '/') {
            send(200, page(
                'Connect Spotify',
                'This links your account so the site can read your top artists, '
                + 'top tracks and what is playing. The token is written to '
                + '<b>.env</b> and never shown.',
                `<a class="go" href="${authUrl}">Authorise with Spotify</a>`,
            ));

            return;
        }

        if (url.pathname !== CALLBACK_PATH) {
            send(404, page('Wrong path', `Waiting on <b>${CALLBACK_PATH}</b>, not ${url.pathname}.`));

            return;
        }

        if (!url.searchParams.get('code') && !url.searchParams.get('error')) {
            send(400, page(
                'Nothing to exchange',
                'This address only works as a redirect from Spotify. Start at '
                + `<b>http://${HOST}:${PORT}</b> instead.`,
                `<a class="go" href="/">Start over</a>`,
            ));

            return;
        }

        if (url.searchParams.get('error')) {
            send(400, page('Denied', 'Authorisation was declined. Nothing was saved.'));
            fail(`\n  Declined: ${url.searchParams.get('error')}\n`);

            return done(server);
        }

        if (url.searchParams.get('state') !== state) {
            send(400, page('Mismatch', 'State did not match. Run the script again.'));
            fail('\n  State mismatch — possible cross-site request. Aborted.\n');

            return done(server);
        }

        try {
            await save(await exchange(url.searchParams.get('code')));

            send(200, page('Connected', 'Refresh token saved to <b>.env</b>. You can close this tab.'));

            console.log(`
  Saved SPOTIFY_REFRESH_TOKEN to .env — the value was not printed.

  Check it:  node scripts/check-setup.mjs
`);
        } catch (err) {
            send(500, page('Failed', 'Could not exchange the code. See the terminal.'));
            fail(`\n  Failed: ${err.message}\n`);
        }

        done(server);
    });

    server.on('error', (err) => {
        fail(err.code === 'EADDRINUSE'
            ? `
  Port ${PORT} is already in use — something else is listening there.
  Stop it, or register a different redirect URI on the app and pass it:

    node scripts/spotify-token.mjs --redirect http://127.0.0.1:8888/callback
`
            : `\n  ${err.message}\n`);
    });

    const start = `http://${HOST}:${PORT}`;

    server.listen(PORT, HOST, () => {
        console.log(`
  Credentials accepted. Leave this running.

  Opening ${start} — click "Authorise with Spotify" there.
  If your browser does not open, go to that address yourself. Do not
  reuse an older Spotify tab; it may carry a stale link.
`);

        if (process.argv.includes('--no-open')) return;

        if (!openBrowser(start)) {
            console.log(`  (Could not launch a browser — open ${start} yourself.)\n`);
        }
    });
}

await main();
