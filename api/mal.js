import { json, collect } from './_lib/http.js';
import { mal } from './_lib/mal.js';

export default async function handler(req, res) {
    json(res, await collect('mal', mal), { maxAge: 900, swr: 86400 });
}
