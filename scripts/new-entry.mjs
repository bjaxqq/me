import { readFile, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const POSTS = join(ROOT, 'posts');
const INDEX = join(POSTS, 'index.json');

const argv = process.argv.slice(2);
const title = argv.find((a) => !a.startsWith('--'));

if (!title) {
    console.error('\n  Give it a title:\n    node scripts/new-entry.mjs "On keeping count"\n');

    process.exit(1);
}

const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : null;
};

const slug = (value('slug') || title)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const today = new Date();
const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
].join('-');

const file = join(POSTS, `${slug}.md`);

try {
    await access(file);

    console.error(`\n  posts/${slug}.md already exists. Pick another title or pass --slug.\n`);

    process.exit(1);
} catch {  }

const tags = (value('tags') || '').split(',').map((t) => t.trim()).filter(Boolean);

const entry = {
    slug,
    title,
    date,
    dek: '',
    ...(tags.length ? { tags } : {}),
    ...(flag('draft') ? { draft: true } : {}),
};

const index = JSON.parse(await readFile(INDEX, 'utf8'));

index.unshift(entry);
index.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

await writeFile(INDEX, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
await writeFile(file, `# ${title}\n\nStart here.\n`, 'utf8');

console.log(`
  Created: posts/${slug}.md
  URL:     /journal/${slug}
  ${flag('draft') ? 'Marked as a draft — it stays hidden until you remove "draft": true.' : 'Add a "dek" in posts/index.json — it is the summary shown on the journal and home page.'}
`);
