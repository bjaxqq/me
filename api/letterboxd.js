import { json, collect } from './_lib/http.js';
import { letterboxd } from './_lib/letterboxd.js';

export default async function handler(req, res) {
    json(res, await collect('letterboxd', letterboxd), { maxAge: 1800, swr: 86400 });
}
