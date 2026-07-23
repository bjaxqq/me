import { json, collect } from './_lib/http.js';
import { osu } from './_lib/osu.js';

export default async function handler(req, res) {
    json(res, await collect('osu', osu), { maxAge: 600, swr: 86400 });
}
