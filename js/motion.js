export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis = null;

export function initScroll() {
    const Lenis = window.Lenis;
    if (reduced || typeof Lenis !== 'function') {
        document.documentElement.style.scrollBehavior = reduced ? 'auto' : 'smooth';
        bindAnchors(null);
        return null;
    }

    lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.8,
    });

    const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    bindAnchors(lenis);
    return lenis;
}

function bindAnchors(instance) {
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute('href');
        if (id === '#' || id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;

        e.preventDefault();
        if (instance) {
            instance.scrollTo(target, { offset: -72, duration: 1.4 });
        } else {
            target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        }
        history.replaceState(null, '', id);

        window.setTimeout(sweep, 1500);
    });
}

let revealObserver = null;

export function reveal(el) {
    el.classList.add('is-in');
    if (!el.classList.contains('rise')) return;

    const open = () => { el.style.overflow = 'visible'; };
    const inner = el.firstElementChild;

    if (reduced || !inner) { open(); return; }

    inner.addEventListener('transitionend', open, { once: true });
    window.setTimeout(open, 2200);
}

export function initReveals(root = document) {
    const targets = root.querySelectorAll('[data-reveal]:not(.is-in), .rise:not(.is-in)');
    if (!targets.length) return;

    if (reduced) {
        targets.forEach(reveal);
        return;
    }

    if (!revealObserver) {
        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                reveal(entry.target);
                revealObserver.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    }

    targets.forEach((el) => revealObserver.observe(el));
    startSweep();
}

let sweeping = false;

export function sweep() {
    const fold = window.innerHeight * 1.05;
    const pending = document.querySelectorAll('[data-reveal]:not(.is-in), .rise:not(.is-in)');
    let left = 0;

    pending.forEach((el) => {
        if (el.getBoundingClientRect().top < fold) reveal(el);
        else left += 1;
    });

    return left;
}

function startSweep() {
    if (sweeping) return;
    sweeping = true;

    let timer = null;
    const onScroll = () => {
        if (timer) return;
        timer = window.setTimeout(() => {
            timer = null;
            if (sweep() === 0) stop();
        }, 60);
    };

    const stop = () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.setTimeout(sweep, 2600);
}

const nf = new Intl.NumberFormat('en-US');

export function countUp(el, value, { decimals = 0, prefix = '', suffix = '' } = {}) {
    const target = Number(value);
    if (!Number.isFinite(target)) {
        el.textContent = '—';
        return;
    }

    const render = (n) => {
        el.textContent = prefix + nf.format(
            decimals ? Number(n.toFixed(decimals)) : Math.round(n)
        ) + suffix;
    };

    if (reduced || target === 0) {
        render(target);
        return;
    }

    const run = () => {
        const duration = 1500;
        const start = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 4);
            render(target * eased);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    let counted = false;
    const once = () => {
        if (counted) return;
        counted = true;
        io.disconnect();
        run();
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => { if (entry.isIntersecting) once(); });
    }, { threshold: 0.2 });

    io.observe(el);
    window.setTimeout(() => {
        if (counted) return;

        counted = true;
        io.disconnect();
        render(target);
    }, 2600);
}

export function initChrome() {
    const bar = document.getElementById('sectionbar');
    const masthead = document.getElementById('top');

    if (bar && masthead) {
        const sentinel = new IntersectionObserver(([entry]) => {
            bar.classList.toggle('is-in', !entry.isIntersecting);
        }, { rootMargin: '-40% 0px 0px 0px' });
        sentinel.observe(masthead);
    }

    const links = [...document.querySelectorAll('.sectionbar__nav a[href^="#"]')];
    if (!links.length) return;

    const sections = links
        .map((a) => document.querySelector(a.getAttribute('href')))
        .filter(Boolean);

    const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((a) => {
                a.setAttribute('aria-current', a.getAttribute('href') === `#${entry.target.id}` ? 'true' : 'false');
            });
        });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach((s) => spy.observe(s));
}

export function fitLines(container, { max = 400, min = 28 } = {}) {
    if (!container) return;
    const lines = [...container.querySelectorAll('[data-fit]')];
    if (!lines.length) return;

    const TARGET = 0.995;
    const PASSES = 4;

    const apply = () => {
        const width = container.clientWidth;
        if (!width) return;

        lines.forEach((line) => {
            const target = line.firstElementChild || line;
            const range = document.createRange();
            const advance = () => {
                range.selectNodeContents(target);
                return range.getBoundingClientRect().width;
            };

            let size = 200;
            let bleed = { left: 0, right: 0 };

            for (let pass = 0; pass < PASSES; pass += 1) {
                line.style.fontSize = `${size}px`;
                line.style.textIndent = '0px';

                const natural = advance();
                if (!natural) { line.style.fontSize = ''; return; }

                bleed = inkBleed(target);
                const total = natural + bleed.left + bleed.right;

                const next = Math.max(min, Math.min(max, size * ((width * TARGET) / total)));
                if (Math.abs(next - size) < 0.25) { size = next; break; }
                size = next;
            }

            line.style.fontSize = `${size.toFixed(2)}px`;
            line.style.textIndent = '0px';
            bleed = inkBleed(target);

            line.style.textIndent = `${bleed.left.toFixed(2)}px`;
            line.style.paddingBottom = '0px';
            line.style.paddingBottom = `${descenderOverflow(target)}px`;
        });
    };

    let lastWidth = 0;
    let frame = null;

    const refit = (force = false) => {
        const width = container.clientWidth;
        if (!force && width === lastWidth) return;
        lastWidth = width;
        apply();
    };

    const schedule = (force = false) => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => refit(force));
    };

    refit(true);

    if (document.fonts?.ready) document.fonts.ready.then(() => refit(true));

    window.addEventListener('resize', () => schedule(), { passive: true });
    window.addEventListener('orientationchange', () => schedule(true));

    if ('ResizeObserver' in window) {
        new ResizeObserver(() => schedule()).observe(container.parentElement || container);
    }
}

let scratch = null;

function inkBelowBaseline(root) {
    if (!scratch) scratch = document.createElement('canvas').getContext('2d');

    let deepest = 0;
    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            const parent = node.parentElement;
            if (!text.trim() || !parent) return;

            const cs = getComputedStyle(parent);
            scratch.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
            const d = scratch.measureText(text).actualBoundingBoxDescent;
            if (Number.isFinite(d)) deepest = Math.max(deepest, d);
            return;
        }
        node.childNodes.forEach(walk);
    };

    walk(root);
    return deepest;
}

function textRuns(root) {
    const runs = [];
    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.trim() && node.parentElement) runs.push(node);
            return;
        }
        node.childNodes.forEach(walk);
    };
    walk(root);
    return runs;
}

function runFont(node) {
    const cs = getComputedStyle(node.parentElement);
    return `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;
}

function inkBleed(target) {
    const runs = textRuns(target);
    if (!runs.length) return { left: 0, right: 0 };

    if (!scratch) scratch = document.createElement('canvas').getContext('2d');

    scratch.font = runFont(runs[0]);
    const first = scratch.measureText(runs[0].textContent);

    const lastRun = runs[runs.length - 1];
    scratch.font = runFont(lastRun);
    const last = scratch.measureText(lastRun.textContent);

    return {
        left: Math.max(0, first.actualBoundingBoxLeft) || 0,
        right: Math.max(0, last.actualBoundingBoxRight - last.width) || 0,
    };
}

function descenderOverflow(target) {
    if (!(target.textContent || '').trim()) return 0;

    const size = parseFloat(getComputedStyle(target).fontSize);
    const below = inkBelowBaseline(target);
    if (!below) return Math.ceil(size * 0.26);

    const marker = document.createElement('span');
    marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
    target.insertBefore(marker, target.firstChild);
    const baselineY = marker.getBoundingClientRect().top;
    const boxBottom = target.getBoundingClientRect().bottom;
    target.removeChild(marker);

    return Math.max(0, Math.ceil(baselineY + below - boxBottom) + 2);
}

export function stampDateline() {
    const el = document.getElementById('dateline-date');
    const edition = document.getElementById('edition');
    const now = new Date();

    if (el) {
        el.textContent = now.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
    }

    if (edition) {
        const founded = Date.UTC(2026, 0, 1);
        const days = Math.max(1, Math.floor((now.getTime() - founded) / 864e5));
        edition.textContent = String(days).padStart(3, '0');
    }
}
