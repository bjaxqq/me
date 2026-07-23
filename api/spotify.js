import { json, collect } from './_lib/http.js';
import { spotify } from './_lib/spotify.js';

export default async function handler(req, res) {
    const nowOnly = 'now' in (req.query || {});
    const data = await collect('spotify', () => spotify({ nowOnly }));

    json(res, data, nowOnly ? { maxAge: 30, swr: 60 } : { maxAge: 300, swr: 86400 });
}
