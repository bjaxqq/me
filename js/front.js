import { initScroll, initReveals, initChrome, countUp, stampDateline, fitLines } from './motion.js';
import { parseDate, longDate, shortDate, monthYear, year as yearOf } from './dates.js';
import { initTheme } from './theme.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const nf = new Intl.NumberFormat('en-US');
const get = (obj, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
const slot = (root, name) => root.querySelector(`[data-slot="${name}"]`);

function stars(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n <= 0) return '';
    const full = Math.floor(n);
    return '★'.repeat(full) + (n - full >= 0.5 ? '½' : '');
}

function metaDate(label, value) {
    if (!value) return '';
    return `<span class="row__label">${esc(label)}</span> ${esc(value)}`;
}

function emptyNotice(el) {
    el.innerHTML = `<p class="row__sub" style="padding-block:1.25rem">${esc(el.dataset.empty || 'Nothing to report.')}</p>`;
}

function rows(el, items, build) {
    if (!el) return;
    if (!items || !items.length) return emptyNotice(el);
    el.innerHTML = items.map(build).join('');
}

const WIRE = {
    live:         { text: 'Live', cls: 'wire--live' },
    unconfigured: { text: 'Not connected', cls: 'wire--down' },
    error:        { text: 'Unavailable', cls: 'wire--down' },
};

function setState(section, state) {
    if (!section) return;
    const key = WIRE[state] ? state : 'error';
    section.dataset.state = key;
    const wire = section.querySelector('[data-wire]');
    if (wire) {
        wire.textContent = WIRE[key].text;
        wire.className = `wire ${WIRE[key].cls}`.trim();
        wire.removeAttribute('data-state');
    }
}

function applyBindings(data) {
    document.querySelectorAll('[data-bind]').forEach((el) => {
        const value = get(data, el.dataset.bind);
        const prefix = el.dataset.prefix || '';

        if (value === null || value === undefined || value === '') {
            el.textContent = '—';
            return;
        }

        if (typeof value === 'number') {
            if (el.hasAttribute('data-count')) countUp(el, value, { prefix });
            else el.textContent = prefix + nf.format(value);
        } else {
            el.textContent = prefix + value;
        }
    });
}

function bookSpec(book, pages) {
    const page = Number(book.page);
    const total = Number.isFinite(pages) && pages > 0 ? pages : null;

    if (Number.isFinite(page) && page > 0) {
        return `<span class="agate agate--faint">Page</span>
                <span class="agate">${nf.format(page)}${total ? ` <span class="agate--faint">of ${nf.format(total)}</span>` : ''}</span>`;
    }

    if (total) {
        return `<span class="agate agate--faint">Pages</span><span class="agate">${nf.format(total)}</span>`;
    }

    return `<span class="agate agate--faint">Started</span><span class="agate">${esc(shortDate(book.started) || '—')}</span>`;
}

function renderBooks(section, d) {
    const reading = slot(section, 'reading');
    const book = d?.reading?.[0];

    if (reading) {
        if (book) {
            const pages = Number(book.pages);
            reading.innerHTML = `
                ${book.cover ? `<img class="feature__art" src="${esc(book.cover)}" alt="" loading="lazy" decoding="async">` : ''}
                <h3 class="feature__title">${book.url ? `<a class="link" href="${esc(book.url)}" target="_blank" rel="noopener">${esc(book.title)}</a>` : esc(book.title)}</h3>
                <p class="feature__by">${esc(book.author || '')}</p>
                <div class="spec">${bookSpec(book, pages)}</div>
            `;
        } else {
            reading.innerHTML = `<h3 class="feature__title" style="color:var(--ink-3)">Nothing right now</h3>
                <p class="feature__by">The currently-reading shelf is empty.</p>`;
        }
    }

    rows(slot(section, 'read'), d?.read?.slice(0, 6), (b, i) => `
        <a class="row row--art row-link" ${b.url ? `href="${esc(b.url)}" target="_blank" rel="noopener"` : ''}>
            ${b.cover
                ? `<img class="row__art" src="${esc(b.cover)}" alt="" loading="lazy" decoding="async">`
                : `<span class="row__no">${String(i + 1).padStart(2, '0')}</span>`}
            <span class="row__main">
                <span class="row__title">${esc(b.title)}</span>
                <span class="row__sub">${esc(b.author || '')}</span>
            </span>
            <span class="row__meta">
                ${b.rating ? `<span class="stars">${stars(b.rating)}</span><br>` : ''}
                ${metaDate('Finished', yearOf(b.date) ?? '')}
            </span>
        </a>
    `);
}

const REVIEW_LIMIT = 260;

function review(film) {
    const text = (film.review || '').trim();
    if (!text) return '';

    const long = text.length > REVIEW_LIMIT;
    const shown = long
        ? `${text
            .slice(0, REVIEW_LIMIT)
            .replace(/\s+\S*$/, '')
            .replace(/\s+\S{1,2}$/, '')
            .replace(/[\s,;:—–-]+$/, '')
          }…`
        : text;

    const more = long && film.url
        ? ` <a class="feature__more link" href="${esc(film.url)}" target="_blank" rel="noopener">See&nbsp;more</a>`
        : '';

    return `<blockquote class="feature__review">${esc(shown)}${more}</blockquote>`;
}

function renderFilms(section, d) {
    const latest = slot(section, 'latest');
    const film = d?.recent?.[0];

    if (latest) {
        if (film) {
            latest.innerHTML = `
                <div class="feature__split">
                    ${film.poster ? `<img class="feature__art" src="${esc(film.poster)}" alt="" loading="lazy" decoding="async">` : ''}
                    <div class="feature__lede">
                        <h3 class="feature__title">${film.url ? `<a class="link" href="${esc(film.url)}" target="_blank" rel="noopener">${esc(film.title)}</a>` : esc(film.title)}</h3>
                        <p class="feature__by">${esc(film.year || '')}${film.rating ? ` &middot; <span class="stars">${stars(film.rating)}</span>` : ''}</p>
                        ${review(film)}
                    </div>
                </div>
                <div class="spec">
                    <span class="agate agate--faint">Watched</span>
                    <span class="agate">${esc(shortDate(film.watched) || '—')}${film.rewatch ? ' &middot; Rewatch' : ''}</span>
                </div>
            `;
        } else {
            latest.innerHTML = `<h3 class="feature__title" style="color:var(--ink-3)">Nothing yet</h3>
                <p class="feature__by">No films logged.</p>`;
        }
    }

    rows(slot(section, 'recent'), d?.recent?.slice(0, 7), (f) => `
        <a class="row row--art row-link" ${f.url ? `href="${esc(f.url)}" target="_blank" rel="noopener"` : ''}>
            ${f.poster
                ? `<img class="row__art" src="${esc(f.poster)}" alt="" loading="lazy" decoding="async">`
                : `<span class="row__no">—</span>`}
            <span class="row__main">
                <span class="row__title">${esc(f.title)}</span>
                <span class="row__sub">${esc(f.year || '')}${f.rewatch ? ' &middot; Rewatch' : ''}</span>
            </span>
            <span class="row__meta">
                ${f.rating ? `<span class="stars">${stars(f.rating)}</span><br>` : ''}
                ${metaDate('Watched', shortDate(f.watched))}
            </span>
        </a>
    `);
}

function renderNowPlaying(section, now) {
    const dot = slot(section, 'np-dot');
    const label = slot(section, 'np-label');
    const track = slot(section, 'np-track');
    if (!track) return;

    const live = Boolean(now?.playing && now?.title);
    if (dot) dot.classList.toggle('is-live', live);
    if (label) {
        label.textContent = live ? 'Now playing' : (now?.title ? 'Last played' : 'Not playing');
        label.className = live ? 'agate agate--accent' : 'agate agate--faint';
    }

    const line = now?.title
        ? `${esc(now.title)}<i> — ${esc(now.artist || '')}</i>`
        : 'Nothing playing right now';

    track.innerHTML = `<span>${line}</span><span aria-hidden="true">${line}</span>`;

    const fit = () => {
        const viewport = track.parentElement;
        const first = track.firstElementChild;
        if (!viewport || !first) return;
        track.classList.toggle('is-static', first.getBoundingClientRect().width <= viewport.clientWidth);
    };

    requestAnimationFrame(fit);
    window.setTimeout(fit, 400);
}

function renderSound(section, d) {
    renderNowPlaying(section, d?.now);

    rows(slot(section, 'artists'), d?.artists?.slice(0, 5), (a, i) => `
        <a class="row row--art row-link" ${a.url ? `href="${esc(a.url)}" target="_blank" rel="noopener"` : ''}>
            ${a.art
                ? `<img class="row__art row__art--square" src="${esc(a.art)}" alt="" loading="lazy" decoding="async">`
                : `<span class="row__no">${String(i + 1).padStart(2, '0')}</span>`}
            <span class="row__main">
                <span class="row__title">${esc(a.name)}</span>
                <span class="row__sub">${esc(a.genre || 'Artist')}</span>
            </span>
            <span class="row__meta">${String(i + 1).padStart(2, '0')}</span>
        </a>
    `);

    rows(slot(section, 'tracks'), d?.tracks?.slice(0, 5), (t, i) => `
        <a class="row row--art row-link" ${t.url ? `href="${esc(t.url)}" target="_blank" rel="noopener"` : ''}>
            ${t.art
                ? `<img class="row__art row__art--square" src="${esc(t.art)}" alt="" loading="lazy" decoding="async">`
                : `<span class="row__no">${String(i + 1).padStart(2, '0')}</span>`}
            <span class="row__main">
                <span class="row__title">${esc(t.title)}</span>
                <span class="row__sub">${esc(t.artist || '')}</span>
            </span>
            <span class="row__meta">${String(i + 1).padStart(2, '0')}</span>
        </a>
    `);
}

function renderOsu(section, d) {
    const strip = slot(section, 'strip');
    const s = d?.stats || {};

    const cells = [
        ['Global',     s.globalRank,  { prefix: '#' }],
        ['Country',    s.countryRank, { prefix: '#', sup: d?.user?.country }],
        ['Accuracy',   s.accuracy,    { decimals: 2, suffix: '%' }],
        ['Play count', s.playCount,   {}],
        ['Level',      s.level,       {}],
        ['Hours',      s.hoursPlayed, {}],
    ];

    if (strip) {
        strip.innerHTML = cells.map(([label, , opts]) => `
            <div class="strip__cell">
                <span class="agate">${esc(label)}${opts.sup ? ` <span class="agate--faint">${esc(opts.sup)}</span>` : ''}</span>
                <span class="strip__v" data-cell>—</span>
            </div>
        `).join('');

        strip.querySelectorAll('[data-cell]').forEach((el, i) => {
            const [, value, opts] = cells[i];
            if (Number.isFinite(Number(value)) && value !== null) {
                countUp(el, value, { prefix: opts.prefix || '', suffix: opts.suffix || '', decimals: opts.decimals || 0 });
            }
        });
    }

    rows(slot(section, 'top'), d?.top?.slice(0, 6), (p, i) => `
        <a class="row row-link" ${p.url ? `href="${esc(p.url)}" target="_blank" rel="noopener"` : ''}>
            <span class="row__no">${String(i + 1).padStart(2, '0')}</span>
            <span class="row__main">
                <span class="row__title">${esc(p.title)}</span>
                <span class="row__sub">${esc(p.difficulty || '')}${p.mods?.length ? ` &middot; ${esc(p.mods.join(' '))}` : ''}</span>
            </span>
            <span class="row__meta">${p.pp ? `${nf.format(Math.round(p.pp))}pp<br>` : ''}${p.accuracy ? `${Number(p.accuracy).toFixed(2)}%` : ''}</span>
        </a>
    `);
}

function progressLabel(entry) {
    const { done, total, unit } = entry;
    if (Number.isFinite(done) && done > 0 && total) return `${nf.format(done)} of ${nf.format(total)} ${unit}`;
    if (total) return `${nf.format(total)} ${unit}`;
    if (Number.isFinite(done) && done > 0) return `${nf.format(done)} ${unit}`;
    return 'Ongoing';
}

const malRow = (dateField) => (e, i) => {
    const score = e.score ? `<span class="stars">★</span> ${e.score}` : '';
    const label = dateField === 'started' ? 'Started' : 'Finished';
    const dated = metaDate(label, monthYear(e[dateField]));
    const when = dated ? `${score ? '<br>' : ''}${dated}` : '';

    return `
    <a class="row row--art row-link" ${e.url ? `href="${esc(e.url)}" target="_blank" rel="noopener"` : ''}>
        ${e.art
            ? `<img class="row__art" src="${esc(e.art)}" alt="" loading="lazy" decoding="async">`
            : `<span class="row__no">${String(i + 1).padStart(2, '0')}</span>`}
        <span class="row__main">
            <span class="row__title">${esc(e.title)}</span>
            <span class="row__sub">${esc(progressLabel(e))}</span>
        </span>
        <span class="row__meta">${score}${when}</span>
    </a>`;
};

function renderList(section, d) {
    const inProgress = section.dataset.source === 'anime' ? d.watching : d.reading;
    rows(slot(section, 'current'), inProgress?.slice(0, 5), malRow('started'));
    rows(slot(section, 'completed'), d.completed?.slice(0, 5), malRow('finished'));
}

const RENDERERS = {
    books: renderBooks,
    films: renderFilms,
    sound: renderSound,
    osu: renderOsu,
    anime: renderList,
    manga: renderList,
};

async function loadStats() {
    const status = document.getElementById('wire-status');
    let payload = null;

    try {
        const res = await fetch('/api/stats', { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        payload = await res.json();
    } catch (err) {
        console.warn('[stats] unavailable:', err.message);
        if (status) {
            status.textContent = 'Unavailable';
            status.className = 'wire wire--down';
            status.removeAttribute('data-state');
        }
        document.querySelectorAll('[data-source]').forEach((s) => setState(s, 'error'));
        return;
    }

    const sections = [...document.querySelectorAll('[data-source]')];
    const live = sections.filter((s) => payload[s.dataset.source]?.ok).length;

    if (status) {
        status.removeAttribute('data-state');
        if (live === sections.length) {
            status.textContent = 'Live';
            status.className = 'wire wire--live';
        } else if (live > 0) {
            status.textContent = `${live} of ${sections.length} connected`;
            status.className = 'wire wire--live';
        } else {
            status.textContent = 'Not connected';
            status.className = 'wire wire--down';
        }
    }

    applyBindings(payload);

    const musicNote = document.querySelector('[data-slot="music-note"]');
    if (musicNote && payload.sound?.ok) {
        musicNote.textContent = payload.sound.totals?.capped
            ? 'Minutes, last 50 plays'
            : 'Minutes listened this week';
    }

    sections.forEach((section) => {
        const key = section.dataset.source;
        const data = payload[key];
        setState(section, data?.state || (data?.ok ? 'live' : 'error'));
        if (data?.ok) RENDERERS[key]?.(section, data);
        else section.querySelectorAll('[data-empty]').forEach(emptyNotice);
    });

    const generated = document.getElementById('generated');
    if (generated && payload.generated) {
        const d = new Date(payload.generated);
        generated.textContent = d.toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
    }

    initReveals(document);
}

function pollNowPlaying() {
    const section = document.querySelector('[data-source="sound"]');
    if (!section) return;

    const tick = async () => {
        if (document.hidden) return;
        try {
            const res = await fetch('/api/spotify?now=1', { headers: { accept: 'application/json' } });
            if (!res.ok) return;
            const data = await res.json();
            if (data?.ok) renderNowPlaying(section, data.now);
        } catch {  }
    };

    window.setInterval(tick, 45000);
}

async function loadJournal() {
    const host = document.querySelector('[data-slot="journal"]');
    if (!host) return;

    try {
        const res = await fetch('/posts/index.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const entries = (await res.json())
            .filter((e) => !e.draft)
            .sort((a, b) => parseDate(b.date) - parseDate(a.date))
            .slice(0, 3);

        if (!entries.length) {
            host.innerHTML = `<p class="brief__dek" style="padding:1.75rem 0">No entries yet.</p>`;
            return;
        }

        host.innerHTML = entries.map((e, i) => `
            <a class="brief" href="/journal/${esc(e.slug)}" data-reveal style="--delay:${i * 90}ms">
                <span class="agate agate--faint">${esc(longDate(e.date))}</span>
                <h3 class="brief__title">${esc(e.title)}</h3>
                <p class="brief__dek">${esc(e.dek || '')}</p>
                <span class="brief__more">Read &rarr;</span>
            </a>
        `).join('');

        initReveals(host);
    } catch (err) {
        console.warn('[journal] index unavailable:', err.message);
        host.innerHTML = `<p class="brief__dek" style="padding:1.75rem 0">Couldn&rsquo;t load the journal.</p>`;
    }
}

initTheme();
stampDateline();
fitLines(document.querySelector('.masthead__name'));
initScroll();
initChrome();
initReveals(document);
loadStats();
loadJournal();
pollNowPlaying();
