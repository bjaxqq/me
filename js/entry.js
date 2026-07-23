import { initScroll, initReveals } from './motion.js';
import { render, excerpt } from './markdown.js';
import { longDate, parseDate } from './dates.js';
import { initTheme } from './theme.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const slot = (name) => document.querySelector(`[data-slot="${name}"]`);

function currentSlug() {
    const fromPath = location.pathname.replace(/\/+$/, '').split('/').pop();
    const fromQuery = new URLSearchParams(location.search).get('e');
    const slug = fromQuery || fromPath || '';
    return /^[a-z0-9][a-z0-9-]*$/i.test(slug) && slug !== 'journal' ? slug : null;
}

function readingTime(markdown) {
    const words = markdown.trim().split(/\s+/).length;
    return `${Math.max(1, Math.round(words / 220))} min read &middot; ${words.toLocaleString('en-US')} words`;
}

function notFound(message) {
    document.title = 'Not found — Brooks Jackson';
    slot('title').textContent = 'Not found';
    slot('dek').textContent = message;
    slot('date').textContent = '—';
    slot('reading').textContent = '—';
    slot('body').innerHTML = `<p>That entry isn&rsquo;t here — it may have been renamed or removed. The <a class="link" href="/journal">journal</a> has everything that is.</p>`;
}

function neighbours(entries, index) {
    const nav = slot('updown');
    if (!nav) return;

    const older = entries[index + 1];
    const newer = entries[index - 1];

    const cell = (entry, kind) => entry
        ? `<a class="updown__cell updown__cell--${kind}" href="/journal/${esc(entry.slug)}">
               <span class="agate agate--faint">${kind === 'prev' ? '&larr; Previous' : 'Next &rarr;'}</span>
               <span class="updown__title">${esc(entry.title)}</span>
               <span class="agate agate--faint">${esc(longDate(entry.date))}</span>
           </a>`
        : `<div class="updown__cell updown__cell--${kind} updown__cell--empty">
               <span class="agate agate--faint">${kind === 'prev' ? 'Nothing older' : 'Nothing newer'}</span>
           </div>`;

    nav.innerHTML = cell(older, 'prev') + cell(newer, 'next');
}

async function load() {
    const slug = currentSlug();
    if (!slug) return notFound('No entry was requested.');

    let entries = [];
    try {
        const res = await fetch('/posts/index.json');
        if (res.ok) entries = (await res.json())
            .filter((e) => !e.draft)
            .sort((a, b) => parseDate(b.date) - parseDate(a.date));
    } catch {  }

    const index = entries.findIndex((e) => e.slug === slug);
    const meta = index >= 0 ? entries[index] : null;

    let markdown;
    try {
        const res = await fetch(`/posts/${encodeURIComponent(slug)}.md`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        markdown = await res.text();
        if (/^\s*<!DOCTYPE/i.test(markdown)) throw new Error('not an entry');
    } catch {
        return notFound('This entry doesn’t exist.');
    }

    const title = meta?.title || markdown.match(/^#\s+(.*)$/m)?.[1] || slug.replace(/-/g, ' ');
    const dek = meta?.dek || excerpt(markdown.replace(/^#\s+.*$/m, ''), 140);
    const body = markdown.replace(/^#\s+.*$/m, '').trim();

    document.title = `${title} — The Journal — Brooks Jackson`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', dek);

    slot('title').textContent = title;
    slot('dek').textContent = dek;
    slot('date').textContent = meta?.date ? longDate(meta.date) : '';
    slot('reading').innerHTML = readingTime(body);
    slot('body').innerHTML = `${render(body)}<div class="article__end"></div>`;

    if (index >= 0) neighbours(entries, index);
    initReveals(document);
}

initTheme();
initScroll();
load();
