import { req, reqJson, NotConfigured } from './http.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

function config() {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
   
    if (!clientId || !clientSecret || !refreshToken) {
        throw new NotConfigured('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REFRESH_TOKEN');
    }
   
    return { clientId, clientSecret, refreshToken };
}

async function accessToken() {
    const { clientId, clientSecret, refreshToken } = config();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const data = await reqJson(TOKEN_URL, {
        method: 'POST',
   
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
   
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });

    if (!data.access_token) throw new Error('Spotify refused the refresh token');
   
    return data.access_token;
}

const smallest = (images = []) => images[images.length - 1]?.url || images[0]?.url || null;

async function nowPlaying(token) {
    const res = await req(`${API}/me/player/currently-playing`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 204 || res.status === 202) return null;
   
    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    const item = data?.item;
   
    if (!item) return null;

    return {
        playing: Boolean(data.is_playing),
        title: item.name,
        artist: (item.artists || []).map((a) => a.name).join(', '),
        album: item.album?.name || null,
        art: smallest(item.album?.images),
        url: item.external_urls?.spotify || null,
    };
}

export async function spotify({ nowOnly = false } = {}) {
    const token = await accessToken();
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    if (nowOnly) return { now: await nowPlaying(token) };

    const [now, artists, tracks, recent, profile] = await Promise.all([
        nowPlaying(token),
        reqJson(`${API}/me/top/artists?time_range=short_term&limit=5`, auth).catch(() => ({ items: [] })),
        reqJson(`${API}/me/top/tracks?time_range=short_term&limit=5`, auth).catch(() => ({ items: [] })),
        reqJson(`${API}/me/player/recently-played?limit=50`, auth).catch(() => ({ items: [] })),
        reqJson(`${API}/me`, auth).catch(() => null),
    ]);

    const plays = recent.items || [];

    const rotation = new Set(
        plays.flatMap((p) => (p.track?.artists || []).map((a) => a.name))
    );

    const weekAgo = Date.now() - 7 * 864e5;
    const thisWeek = plays.filter((p) => new Date(p.played_at).getTime() >= weekAgo);

    const minutes = Math.round(
        thisWeek.reduce((sum, p) => sum + (p.track?.duration_ms || 0), 0) / 60000
    );

    const oldest = plays.length
        ? new Date(plays[plays.length - 1].played_at).getTime()
        : null;

    let last = now;

    if (!last && plays[0]?.track) {
        last = {
            playing: false,
            title: plays[0].track.name,
            artist: (plays[0].track.artists || []).map((a) => a.name).join(', '),
            art: smallest(plays[0].track.album?.images),
            url: plays[0].track.external_urls?.spotify || null,
        };
    }

    const topArtists = (artists.items || []).map((a) => ({
        name: a.name,
        genre: (a.genres || [])[0] || null,
        art: smallest(a.images),
        url: a.external_urls?.spotify || null,
    }));

    return {
        profileUrl: profile?.external_urls?.spotify || null,
        now: last,
        artists: topArtists,

        tracks: (tracks.items || []).map((t) => ({
            title: t.name,
            artist: (t.artists || []).map((a) => a.name).join(', '),
            art: smallest(t.album?.images),
            url: t.external_urls?.spotify || null,
        })),

        totals: {
            minutes,
            tracksThisWeek: thisWeek.length,
            capped: plays.length >= 50 && oldest !== null && oldest > weekAgo,
            artists: rotation.size,
            plays: plays.length,
            top: topArtists[0]?.name || null,
        },
    };
}
