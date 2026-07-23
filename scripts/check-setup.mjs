import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));

try {
    const env = await readFile(join(ROOT, '.env'), 'utf8');

    for (const line of env.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);

        if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
} catch {
    console.log('\n  No .env found. Copy .env.example to .env and fill it in.\n');
}

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', YEL = '\x1b[33m', OFF = '\x1b[0m';

const SOURCES = [
    {
        name: 'Goodreads',
        vars: ['GOODREADS_USER_ID'],
        hint: 'The number in goodreads.com/user/show/<NUMBER>-name. Shelves must be public.',
        module: '../api/_lib/goodreads.js',

        run: (m) => m.goodreads(),
        summary: (d) => `${d.totals.year} finished this year · ${d.reading.length} currently reading · ${d.read.length} recent`,
        sanity: (d) => d.read.length === 0 && d.reading.length === 0
            ? 'Connected, but both shelves came back empty — check they are public.'
            : null,
    },
    {
        name: 'Letterboxd',
        vars: ['LETTERBOXD_USER'],
        hint: 'Your username, no @.',
        module: '../api/_lib/letterboxd.js',

        run: (m) => m.letterboxd(),
        summary: (d) => `${d.totals.total ?? '?'} films all time · ${d.totals.year ?? '?'} this year · latest "${d.totals.latest ?? '—'}"`,
        sanity: (d) => d.totals.total === null
            ? 'Diary works, but the profile totals could not be read — the headline number will show a dash.'
            : null,
    },
    {
        name: 'Spotify',
        vars: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN'],
        hint: 'Run: node scripts/spotify-token.mjs',
        module: '../api/_lib/spotify.js',

        run: (m) => m.spotify(),
        summary: (d) => `${d.artists.length} top artists · ${d.tracks.length} top tracks · ${d.totals.artists} in rotation · ${d.now ? `now/last: "${d.now.title}"` : 'nothing playing'}`,
        sanity: (d) => d.artists.length === 0
            ? 'Token works but no top artists came back — the account may be too new, or the scope user-top-read is missing.'
            : null,
    },
    {
        name: 'osu!',
        vars: ['OSU_CLIENT_ID', 'OSU_CLIENT_SECRET', 'OSU_USER'],
        hint: 'osu.ppy.sh/home/account/edit → OAuth → New application.',
        module: '../api/_lib/osu.js',

        run: (m) => m.osu(),
        summary: (d) => `${d.user.name} · #${d.stats.globalRank?.toLocaleString() ?? '?'} · ${d.stats.pp ?? '?'}pp · ${d.stats.accuracy ?? '?'}% · ${d.top.length} top plays`,
        sanity: (d) => d.stats.globalRank === null
            ? 'Account found but unranked — the rank cells will show dashes.'
            : null,
    },
    {
        name: 'MyAnimeList',
        vars: ['MAL_CLIENT_ID', 'MAL_USER'],
        hint: 'myanimelist.net/apiconfig → Create ID. Lists must be public: Settings → Privacy.',
        module: '../api/_lib/mal.js',

        run: (m) => m.mal(),
        summary: (d) => `${d.anime.watching.length} watching · ${d.anime.completed.length} anime done · ${d.manga.reading.length} reading · ${d.manga.completed.length} manga done`,
        sanity: (d) => (d.anime.watching.length + d.manga.reading.length) === 0
            ? 'Connected, but nothing is in progress on either list.'
            : null,
    },
];

console.log('');

let ready = 0;

for (const source of SOURCES) {
    const missing = source.vars.filter((v) => !process.env[v]);

    if (missing.length === source.vars.length) {
        console.log(`  ${DIM}○ ${source.name.padEnd(11)} not configured${OFF}`);
        console.log(`  ${DIM}  ${source.hint}${OFF}\n`);

        continue;
    }

    if (missing.length) {
        console.log(`  ${YEL}▲ ${source.name.padEnd(11)} partly configured${OFF}`);
        console.log(`  ${DIM}  missing: ${missing.join(', ')}${OFF}\n`);

        continue;
    }

    process.stdout.write(`  … ${source.name.padEnd(11)} checking`);

    const started = Date.now();

    try {
        const mod = await import(source.module);
        const data = await source.run(mod);
        const ms = Date.now() - started;

        process.stdout.write('\r');

        console.log(`  ${GREEN}●${OFF} ${source.name.padEnd(11)} ${GREEN}working${OFF} ${DIM}(${ms}ms)${OFF}`);
        console.log(`  ${DIM}  ${source.summary(data)}${OFF}`);

        const warn = source.sanity(data);

        if (warn) console.log(`  ${YEL}  ${warn}${OFF}`);

        console.log('');

        ready += 1;
    } catch (err) {
        process.stdout.write('\r');

        console.log(`  ${RED}✕${OFF} ${source.name.padEnd(11)} ${RED}failed${OFF}`);
        console.log(`  ${DIM}  ${err.message}${OFF}`);
        console.log(`  ${DIM}  ${source.hint}${OFF}\n`);
    }
}

console.log(`  ${ready} of ${SOURCES.length} sources working.\n`);

if (ready > 0) {
    console.log(`  ${DIM}Preview with real data:  node scripts/dev.mjs${OFF}`);
    console.log(`  ${DIM}Then add the same variables in Vercel → Settings → Environment Variables.${OFF}\n`);
}
