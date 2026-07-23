import { reqText, NotConfigured } from './http.js';
import { items, tag, num, toDay, dayYear } from './rss.js';

const BASE = 'https://www.goodreads.com/review/list_rss';
const TIMEOUT = 12000;

function config() {
    const userId = process.env.GOODREADS_USER_ID;
  
    if (!userId) throw new NotConfigured('GOODREADS_USER_ID');
  
    return { userId, key: process.env.GOODREADS_RSS_KEY || '' };
}

function feedUrl({ userId, key }, shelf) {
    const params = new URLSearchParams({ shelf, sort: 'date_read', order: 'd' });
  
    if (key) params.set('key', key);
  
    return `${BASE}/${encodeURIComponent(userId)}?${params}`;
}

function parseBook(block) {
    const rating = num(block, 'user_rating');
    const read = tag(block, 'user_read_at') || tag(block, 'user_date_added');

    return {
        title: tag(block, 'title'),
        author: tag(block, 'author_name'),
        cover: tag(block, 'book_large_image_url') || tag(block, 'book_image_url'),
        rating: rating && rating > 0 ? rating : null,
        date: toDay(read),
        started: toDay(tag(block, 'user_date_added')),
        pages: num(block, 'num_pages'),
        url: tag(block, 'link'),
    };
}

async function progress({ userId }) {
    const xml = await reqText(
        `https://www.goodreads.com/user/updates_rss/${encodeURIComponent(userId)}`, {}, TIMEOUT
    );

    const byTitle = new Map();
  
    for (const block of items(xml)) {
        const title = tag(block, 'title') || '';

        const m = /\bis on page\s+([\d,]+)\s+of\s+([\d,]+)\s+of\s+(.+)$/is.exec(title.replace(/\s+/g, ' ').trim());
  
        if (!m) continue;

        const book = m[3].trim().replace(/[.\s]+$/, '');

        if (!byTitle.has(book.toLowerCase())) {
            byTitle.set(book.toLowerCase(), {
                page: Number(m[1].replace(/,/g, '')),
                pages: Number(m[2].replace(/,/g, '')),
            });
        }
    }
  
    return byTitle;
}

function matchProgress(map, title) {
    const key = String(title || '').toLowerCase().trim();
  
    if (!key) return null;
  
    if (map.has(key)) return map.get(key);

    for (const [name, value] of map) {
        if (key.startsWith(name) || name.startsWith(key)) return value;
    }
  
    return null;
}

async function shelf(cfg, name) {
    const xml = await reqText(feedUrl(cfg, name), {}, TIMEOUT);
  
    return items(xml).map(parseBook).filter((b) => b.title);
}

export async function goodreads() {
    const cfg = config();
    const year = new Date().getFullYear();

    const [read, reading, progressByTitle] = await Promise.all([
        shelf(cfg, 'read'),
        shelf(cfg, 'currently-reading').catch(() => []),

        progress(cfg).catch(() => new Map()),
    ]);

    const finishedThisYear = read.filter((b) => dayYear(b.date) === year).length;

    const manual = Number(process.env.GOODREADS_CURRENT_PAGE);
    const hasManual = Number.isFinite(manual) && manual > 0;

    return {
        profileUrl: `https://www.goodreads.com/user/show/${encodeURIComponent(cfg.userId)}`,
        reading: reading.slice(0, 3).map((b, i) => {
            const live = matchProgress(progressByTitle, b.title);
  
            return {
                ...b,
                page: live?.page ?? (i === 0 && hasManual ? manual : null),
                pages: b.pages ?? live?.pages ?? null,
                note: b.started ? `Picked up ${b.started}` : null,
            };
        }),
        read: read.slice(0, 8),
  
        totals: {
            year: finishedThisYear,
            reading: reading.length,
        },
    };
}
