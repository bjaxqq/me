import { initScroll, initReveals, fitLines } from './motion.js';
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
            <span>
                <span class="entry-row__title">${esc(entry.title)}</span>
                ${entry.dek ? `<span class="entry-row__dek">${esc(entry.dek)}</span>` : ''}
                ${entry.tags?.length ? `<span class="entry-row__tags">${entry.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
            </span>
            <span class="entry-row__arrow">&rarr;</span>
        </a>
    `;
}

function render(entries) {
    const byYear = new Map();
    entries.forEach((e) => {
        const y = yearOf(e.date);
        if (!byYear.has(y)) byYear.set(y, []);
        byYear.get(y).push(e);
    });

    host.innerHTML = [...byYear.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, list]) => `
            <section class="year">
                <h2 class="year__label" data-reveal>${year}</h2>
                <div class="entries">${list.map(entryRow).join('')}</div>
            </section>
        `).join('');

    const count = document.getElementById('jcount');
    if (count) count.textContent = String(entries.length);

    initReveals(host);
}

async function load() {
    const stamp = document.getElementById('jdate');
    if (stamp) {
        stamp.textContent = new Date().toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
        });
    }

    try {
        const res = await fetch('/posts/index.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const entries = (await res.json())
            .filter((e) => !e.draft)
            .sort((a, b) => parseDate(b.date) - parseDate(a.date));

        if (!entries.length) {
            const count = document.getElementById('jcount');
            if (count) count.textContent = '0';
            host.innerHTML = `
                <div class="empty">
                    <p class="empty__title">No entries yet.</p>
                    <p class="empty__note">
                        This is where notes will go. Check back, or
                        <a href="/" class="link link--ruled">head back to the front page</a>.
                    </p>
                </div>`;
            return;
        }

        render(entries);
    } catch (err) {
        console.warn('[journal]', err.message);
        host.innerHTML = `<p class="agate agate--faint" style="padding-block:4rem">Couldn&rsquo;t load the journal.</p>`;
    }
}

initTheme();
fitLines(document.querySelector('.jhead__title'), { max: 560 });
initScroll();
initReveals(document);
load();
