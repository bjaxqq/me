import { req, NotConfigured } from './http.js';

const API = 'https://api.myanimelist.net/v2';
const TIMEOUT = 9000;
const PAGE = 1000;

function config() {
    const clientId = process.env.MAL_CLIENT_ID;
    const user = process.env.MAL_USER;
   
    if (!clientId || !user) throw new NotConfigured('MAL_CLIENT_ID / MAL_USER');
   
    return { clientId, user };
}

async function list({ clientId, user }, kind, status, fields) {
    const out = [];

    let url = `${API}/users/${encodeURIComponent(user)}/${kind}?${new URLSearchParams({
        status, sort: 'list_updated_at', limit: String(PAGE), fields: `list_status,${fields}`, nsfw: 'true',
    })}`;

    for (let page = 0; url && page < 5; page += 1) {
        const res = await req(url, {
            headers: { 'X-MAL-CLIENT-ID': clientId, Accept: 'application/json' },
        }, TIMEOUT);

        if (res.status === 403) {
            throw new Error(
                'MyAnimeList is refusing to share this list. In MyAnimeList → Settings → '
                + 'Privacy, set your anime and manga list visibility to public.'
            );
        }
   
        if (res.status === 404) throw new Error(`No MyAnimeList user "${user}"`);
   
        if (!res.ok) throw new Error(`MyAnimeList responded ${res.status}`);

        const data = await res.json();
   
        out.push(...(Array.isArray(data.data) ? data.data : []));
        url = data.paging?.next || null;
    }

    return out;
}

const art = (node) => node.main_picture?.medium || node.main_picture?.large || null;

const entry = (kind) => (item) => {
    const n = item.node || {};
    const s = item.list_status || {};
    const done = kind === 'anime' ? s.num_episodes_watched : s.num_chapters_read;
    const total = kind === 'anime' ? n.num_episodes : n.num_chapters;

    return {
        title: n.title,
        art: art(n),
        url: `https://myanimelist.net/${kind}/${n.id}`,
        score: s.score || null,
        done: done ?? null,
        total: total || null,
        unit: kind === 'anime' ? 'ep' : 'ch',

        started: s.start_date || null,
        finished: s.finish_date || null,
        updated: s.updated_at ? s.updated_at.slice(0, 10) : null,
    };
};

function byFinished(a, b) {
    if (a.finished && b.finished) return a.finished < b.finished ? 1 : a.finished > b.finished ? -1 : 0;
   
    if (a.finished) return -1;
   
    if (b.finished) return 1;
   
    return String(b.updated || '').localeCompare(String(a.updated || ''));
}

const sum = (rows) => rows.reduce((n, r) => n + (r.done || 0), 0);

export async function mal() {
    const cfg = config();
    const A = 'num_episodes,main_picture';
    const M = 'num_chapters,num_volumes,main_picture';

    const [watching, animeDone, reading, mangaDone] = await Promise.all([
        list(cfg, 'animelist', 'watching', A),
        list(cfg, 'animelist', 'completed', A),
        list(cfg, 'mangalist', 'reading', M),
        list(cfg, 'mangalist', 'completed', M),
    ]);

    const anime = { watching: watching.map(entry('anime')), completed: animeDone.map(entry('anime')) };
    const manga = { reading: reading.map(entry('manga')), completed: mangaDone.map(entry('manga')) };

    anime.completed.sort(byFinished);
    manga.completed.sort(byFinished);

    return {
        user: cfg.user,
   
        anime: {
            profileUrl: `https://myanimelist.net/animelist/${encodeURIComponent(cfg.user)}`,
            watching: anime.watching.slice(0, 5),
            completed: anime.completed.slice(0, 5),
   
            totals: {
                completed: anime.completed.length,
                inProgress: anime.watching.length,
                units: sum(anime.completed) + sum(anime.watching),
            },
        },
   
        manga: {
            profileUrl: `https://myanimelist.net/mangalist/${encodeURIComponent(cfg.user)}`,
            reading: manga.reading.slice(0, 5),
            completed: manga.completed.slice(0, 5),
   
            totals: {
                completed: manga.completed.length,
                inProgress: manga.reading.length,
                units: sum(manga.completed) + sum(manga.reading),
            },
        },
    };
}
