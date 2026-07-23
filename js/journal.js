import { initScroll, initReveals, initChrome, stampDateline, fitLines } from './motion.js';
import { parseDate, shortDate, year as yearOf } from './dates.js';
import { initTheme } from './theme.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const host = document.getElementById('archive-body');

function entryRow(entry, i) {
    return `
        <a class="entry-row" href="/journal/${esc(entry.slug)}" data-reveal style="--delay:${Math.min(i, 6) * 60}ms">
            <span class="entry-row__date">${esc(shortDate(entry.date))}</span>
            <span class="entry-row__main">
                <span class="entry-row__title">${esc(entry.title)}</span>
                ${entry.dek ? `<span class="entry-row__dek">${esc(entry.dek)}</span>` : ''}
                ${entry.tags?.length ? `<span class="entry-row__tags">${entry.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
            </span>
            <span class="entry-row__arrow">&rarr;</span>
        </a>
    `;
}

function sortEntries(entries, mode) {
    const sorted = [...entries];

    if (mode === 'oldest') sorted.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    else sorted.sort((a, b) => parseDate(b.date) - parseDate(a.date));

    return sorted;
}

function render(entries, mode) {
    const byYear = new Map();

    entries.forEach((e) => {
        const y = yearOf(e.date);

        if (!byYear.has(y)) byYear.set(y, []);

        byYear.get(y).push(e);
    });

    const years = [...byYear.entries()].sort((a, b) => mode === 'oldest' ? a[0] - b[0] : b[0] - a[0]);

    host.innerHTML = years.map(([year, list]) => `
        <section class="year">
            <h2 class="year__label" data-reveal>${year}</h2>
            <div class="entries">${list.map(entryRow).join('')}</div>
        </section>
    `).join('');

    initReveals(host);
}

let allEntries = [];
let sortMode = 'newest';

function renderSorted() {
    const count = document.getElementById('jcount');

    if (count) count.textContent = String(allEntries.length);

    render(sortEntries(allEntries, sortMode), sortMode);
}

function initSort() {
    document.querySelectorAll('.jsort button').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.sort === sortMode || !allEntries.length) return;

            sortMode = btn.dataset.sort;

            document.querySelectorAll('.jsort button').forEach((b) => {
                b.setAttribute('aria-current', String(b === btn));
            });

            renderSorted();
        });
    });
}

async function load() {
    try {
        const res = await fetch('/posts/index.json');
    
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        allEntries = (await res.json()).filter((e) => !e.draft);

        const generated = document.getElementById('generated');

        if (generated && allEntries.length) {
            const newest = allEntries.reduce((a, b) => (parseDate(b.date) > parseDate(a.date) ? b : a));
            generated.textContent = parseDate(newest.date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
            });
        }

        if (!allEntries.length) {
            const count = document.getElementById('jcount');
            if (count) count.textContent = '0';
            host.innerHTML = `
                <div class="rule rule--hard"></div>
                <div class="empty">
                    <p class="empty__title">No entries yet.</p>
                    <p class="empty__note">
                        This is where notes will go. Check back, or
                        <a href="/" class="link link--ruled">head back to the front page</a>.
                    </p>
                </div>`;
            return;
        }

        renderSorted();
    } catch (err) {
        console.warn('[journal]', err.message);
    
        host.innerHTML = `<p class="agate agate--faint" style="padding-block:4rem">Couldn&rsquo;t load the journal.</p>`;
    }
}

initTheme();
initSort();
stampDateline();
// Sized as if it read "Brooks Jackson." — same font-size as the home page
// heading, rather than "Journal." independently filling its own width.
fitLines(document.querySelector('.wordmark'), { sample: 'Brooks Jackson.' });
initScroll();
initReveals(document);
initChrome();
load();
