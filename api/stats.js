import { json, collect } from './_lib/http.js';
import { goodreads } from './_lib/goodreads.js';
import { letterboxd } from './_lib/letterboxd.js';
import { spotify } from './_lib/spotify.js';
import { osu } from './_lib/osu.js';
import { mal } from './_lib/mal.js';

export default async function handler(req, res) {
    const [books, films, sound, rhythm, lists] = await Promise.all([
        collect('goodreads', goodreads),
        collect('letterboxd', letterboxd),
        collect('spotify', () => spotify()),
        collect('osu', osu),
        collect('mal', mal),
    ]);

    const split = (key) => (lists.ok
        ? { ok: true, state: 'live', ...lists[key] }
        : lists);

    json(res, {
        generated: new Date().toISOString(),
        books,
        films,
        sound,
        osu: rhythm,
        anime: split('anime'),
        manga: split('manga'),
    }, { maxAge: 300, swr: 86400 });
}
