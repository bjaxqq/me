import { reqJson, NotConfigured } from './http.js';

const TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const API = 'https://osu.ppy.sh/api/v2';

function config() {
    const clientId = process.env.OSU_CLIENT_ID;
    const clientSecret = process.env.OSU_CLIENT_SECRET;
    const user = process.env.OSU_USER;
 
    if (!clientId || !clientSecret || !user) {
        throw new NotConfigured('OSU_CLIENT_ID / OSU_CLIENT_SECRET / OSU_USER');
    }
 
    return { clientId, clientSecret, user };
}

async function accessToken({ clientId, clientSecret }) {
    const data = await reqJson(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            client_id: Number(clientId),
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: 'public',
        }),
    });

    if (!data.access_token) throw new Error('osu! refused the client credentials');
 
    return data.access_token;
}

const round = (n, places = 2) =>
    (Number.isFinite(n) ? Number(n.toFixed(places)) : null);

export async function osu() {
    const cfg = config();
    const token = await accessToken(cfg);
    const auth = { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } };

    const user = await reqJson(
        `${API}/users/${encodeURIComponent(cfg.user)}/osu?key=username`, auth
    );

    const s = user.statistics || {};

    const best = await reqJson(
        `${API}/users/${user.id}/scores/best?mode=osu&limit=6`, auth
    ).catch(() => []);

    return {
        user: {
            name: user.username,
            avatar: user.avatar_url,
            country: user.country_code,
            url: `https://osu.ppy.sh/users/${user.id}`,
            joined: user.join_date,
        },
 
        stats: {
            globalRank: s.global_rank ?? null,
            countryRank: s.country_rank ?? null,
            pp: round(s.pp, 0),
            accuracy: round(s.hit_accuracy, 2),
            playCount: s.play_count ?? null,
            level: s.level?.current ?? null,
            levelProgress: s.level?.progress ?? null,
            rankedScore: s.ranked_score ?? null,
            maxCombo: s.maximum_combo ?? null,
            hoursPlayed: s.play_time ? Math.round(s.play_time / 3600) : null,
        },
 
        top: (Array.isArray(best) ? best : []).map((score) => ({
            title: score.beatmapset?.title || 'Unknown',
            artist: score.beatmapset?.artist || null,
            difficulty: score.beatmap?.version || null,
            stars: round(score.beatmap?.difficulty_rating, 2),
            pp: round(score.pp, 0),
            accuracy: round((score.accuracy || 0) * 100, 2),
            rank: score.rank,
            mods: score.mods || [],
            url: score.beatmap?.url || null,
        })),
    };
}
