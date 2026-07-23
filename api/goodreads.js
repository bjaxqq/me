import { json, collect } from './_lib/http.js';
import { goodreads } from './_lib/goodreads.js';

export default async function handler(req, res) {
    json(res, await collect('goodreads', goodreads), { maxAge: 3600, swr: 86400 });
}
