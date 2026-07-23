import { reqText, NotConfigured } from './http.js';
import { items, tag, num, firstImage, toDay, dayYear, decode } from './rss.js';

function config() {
    const user = process.env.LETTERBOXD_USER;
    if (!user) throw new NotConfigured('LETTERBOXD_USER');
    return { user: user.replace(/^@/, '').toLowerCase() };
}

function upscale(url) {
    if (!url) return null;
    return url.replace(/-0-\d+-0-\d+-crop/, '-0-300-0-450-crop');
}

function parseReview(html = '') {
    const text = html
        .replace(/<p>\s*<img[^>]*>\s*<\/p>/i, '')
        .replace(/<\/p>\s*<p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();

    const clean = decode(text).replace(/\n{3,}/g, '\n\n').trim();
    if (!clean) return null;
    if (/^Watched on \w+ \w+ \d{1,2}, \d{4}\.?$/i.test(clean)) return null;
    return clean;
}

function parseFilm(block) {
    const title = tag(block, 'letterboxd:filmTitle');
    if (!title) return null;

    const rating = num(block, 'letterboxd:memberRating');
    const description = tag(block, 'description') || '';

    return {
        title,
        year: tag(block, 'letterboxd:filmYear'),
        rating: rating && rating > 0 ? rating : null,
        watched: toDay(tag(block, 'letterboxd:watchedDate') || tag(block, 'pubDate')),
        rewatch: (tag(block, 'letterboxd:rewatch') || '').toLowerCase() === 'yes',
        poster: upscale(firstImage(description)),
        review: parseReview(description),
        url: tag(block, 'link'),
    };
}

async function profileTotals(user) {
    try {
        const html = await reqText(`https://letterboxd.com/${user}/`);
        const read = (label) => {
            const re = new RegExp(
                `<span class="value">\\s*([\\d,]+)\\s*</span>\\s*<span class="definition[^"]*">\\s*${label}\\s*</span>`, 'i'
            );
            const m = html.match(re);
            return m ? Number(m[1].replace(/,/g, '')) : null;
        };
        return { total: read('Films'), year: read('This year') };
    } catch {
        return { total: null, year: null };
    }
}

export async function letterboxd() {
    const { user } = config();

    const [xml, totals] = await Promise.all([
        reqText(`https://letterboxd.com/${user}/rss/`),
        profileTotals(user),
    ]);

    const recent = items(xml).map(parseFilm).filter(Boolean);
    const year = new Date().getFullYear();

    return {
        profileUrl: `https://letterboxd.com/${user}/`,
        recent: recent.slice(0, 10),
        totals: {
            total: totals.total,

            year: totals.year ?? recent.filter((f) => dayYear(f.watched) === year).length,
            latest: recent[0]?.title || null,
        },
    };
}
