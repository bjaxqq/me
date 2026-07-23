const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function typography(text) {
    return text
        .replace(/---/g, '—')
        .replace(/(\s)--(\s)/g, '$1–$2')
        .replace(/\.\.\./g, '…')
        .replace(/(^|[\s(\[{"])&#39;/g, '$1‘')
        .replace(/&#39;/g, '’')
        .replace(/(^|[\s(\[{])&quot;/g, '$1“')
        .replace(/&quot;/g, '”');
}

function inline(text) {
    return typography(text)
        .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
            '<img src="$2" alt="$1" loading="lazy" decoding="async">')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
            const external = /^https?:\/\//.test(href);
            return `<a class="link" href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
        .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>');
}

export function render(markdown = '') {
    const code = [];
    let src = String(markdown).replace(/\r\n?/g, '\n');

    src = src.replace(/```([a-z0-9-]*)\n([\s\S]*?)```/gi, (_, lang, body) => {
        code.push(`<pre class="code"${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(body.replace(/\n$/, ''))}</code></pre>`);
        return `[[BLOCK${code.length - 1}]]`;
    });

    src = src.replace(/`([^`\n]+)`/g, (_, body) => {
        code.push(`<code class="code-inline">${esc(body)}</code>`);
        return `[[BLOCK${code.length - 1}]]`;
    });

    const blocks = esc(src).split(/\n{2,}/);
    const html = [];
    let lead = true;

    for (const raw of blocks) {
        const block = raw.trim();
        if (!block) continue;

        if (/^\[\[BLOCK\d+\]\]$/.test(block)) { html.push(block); continue; }

        if (/^(---|\*\*\*|___)$/.test(block)) {
            html.push('<hr class="ornament">');
            continue;
        }

        const heading = block.match(/^(#{2,4})\s+(.*)$/);
        if (heading) {
            const level = heading[1].length;
            html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            continue;
        }

        if (/^&gt;\s?/.test(block)) {
            const body = block.split('\n').map((l) => l.replace(/^&gt;\s?/, '')).join(' ');
            html.push(`<blockquote>${inline(body)}</blockquote>`);
            continue;
        }

        if (/^[-*]\s+/.test(block)) {
            const li = block.split('\n')
                .filter((l) => /^[-*]\s+/.test(l))
                .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`)
                .join('');
            html.push(`<ul class="list">${li}</ul>`);
            continue;
        }

        if (/^\d+\.\s+/.test(block)) {
            const li = block.split('\n')
                .filter((l) => /^\d+\.\s+/.test(l))
                .map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`)
                .join('');
            html.push(`<ol class="list list--ordered">${li}</ol>`);
            continue;
        }

        const body = inline(block.split('\n').join(' '));
        html.push(`<p${lead ? ' class="dropcap"' : ''}>${body}</p>`);
        lead = false;
    }

    return html.join('\n').replace(/\[\[BLOCK(\d+)\]\]/g, (_, i) => code[Number(i)]);
}

export function excerpt(markdown = '', length = 180) {
    const text = String(markdown)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/^#{1,6}\s+.*$/gm, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`>#-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return text.length > length ? `${text.slice(0, length).replace(/\s\S*$/, '')}…` : text;
}
