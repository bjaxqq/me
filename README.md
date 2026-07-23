# brooksjackson.site

A personal site: bio, a journal, and live stats pulled from Goodreads,
Letterboxd, Spotify, osu! and MyAnimeList.

No build step. Static HTML/CSS/JS plus Vercel functions.

```
index.html          the home page
journal.html        the journal index    → /journal
entry.html          a single entry       → /journal/<slug>
404.html            not found
css/                broadsheet.css (system) · front.css · journal.css
js/                 motion · theme · front · journal · entry · markdown · dates
api/                serverless functions; api/_lib holds the source adapters
posts/              journal entries (.md) + index.json
scripts/            dev server, setup checker, spotify token, entry scaffolding
```

| Script | What it does |
|---|---|
| `node scripts/dev.mjs` | Serves the site and the API locally. `--mock` for fixture data. |
| `node scripts/check-setup.mjs` | Tests each data source, reports what is missing or broken. |
| `node scripts/spotify-token.mjs` | Mints a Spotify refresh token into `.env`. |
| `node scripts/new-entry.mjs "Title"` | Scaffolds a journal entry. |

## Light and dark

Follows your system by default. The **Dark / Light** button in the top-right
overrides it and remembers the choice in `localStorage` under `edition`.
Clearing that key returns the site to following the system.

## Motion

Animations respect `prefers-reduced-motion`. If Windows has **Settings →
Accessibility → Visual effects → Animation effects** turned *off*, the browser
reports that preference and the site drops all movement, keeping only gentle
cross-fades. Turn that setting on to see the full sequence — the staggered
load, the scroll reveals, the counting numerals and the smooth scroll.

## Running it locally

```bash
node scripts/dev.mjs --mock
```

`--mock` serves `scripts/fixtures/stats.json` so the page is fully populated
without any credentials. Drop the flag to hit the real services (it reads
`.env` automatically). Then open <http://localhost:3000>.

**Restart it after editing anything in `api/_lib/`.** Node's module registry
has no eviction, so the server keeps serving the adapter it loaded at startup
even though the HTML and CSS around it reload fine — the page updates and the
data does not. The server detects this and prints a warning, but restarting is
the fix.

## Wiring up the data

Every source degrades on its own: a panel with no credentials reads
**NOT CONNECTED**, one that errors reads **UNAVAILABLE**, and the rest of the
page carries on. Nothing here is required for the site to work.

```bash
cp .env.example .env        # fill it in, then:
node scripts/check-setup.mjs
```

`check-setup` tests each source and tells you exactly what is missing or
broken, one line each. It never prints secrets. Once a source is working
locally, add the same variables in **Vercel → Settings → Environment
Variables** and redeploy.

### Goodreads

| Variable | Where it comes from |
|---|---|
| `GOODREADS_USER_ID` | The number in your profile URL: `goodreads.com/user/show/`**`12345678`**`-name` |
| `GOODREADS_RSS_KEY` | Optional. Only needed if your shelves are not public — grab the `key=` param from your shelf's RSS link |

Your **read** and **currently-reading** shelves must be visible.

Two things Goodreads will not give you, so the site does not claim them.

**Reading progress** is not in the shelf feed — but the *updates* feed carries
the progress posts themselves ("is on page 13 of 656 of …"), so the page number
keeps itself current every time you log progress on Goodreads. No configuration.
`GOODREADS_CURRENT_PAGE` overrides it by hand if the feed has nothing yet.

**A lifetime shelf total** is not available: the feed caps at 100 books per page
and the HTML shelf pages return 202 to non-browsers. The headline number is
therefore *books finished this year*, accurate as long as you read fewer than
100 a year.

Dates from Goodreads and Letterboxd are calendar days encoded as UTC midnight.
They are carried as `YYYY-MM-DD` rather than timestamps — treat one as an
instant and every timezone west of Greenwich reads it a day early, which puts a
book finished on 1 January into the previous year.

### Letterboxd

| Variable | Where it comes from |
|---|---|
| `LETTERBOXD_USER` | Your username, e.g. `bjaxqq` |

Public RSS, no auth. The all-time and this-year totals are read off your
profile page; if Letterboxd changes that markup the totals fall back to
counting the diary window, and everything else keeps working.

### Spotify

| Variable | Where it comes from |
|---|---|
| `SPOTIFY_CLIENT_ID` | [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → create an app |
| `SPOTIFY_CLIENT_SECRET` | Same app |
| `SPOTIFY_REFRESH_TOKEN` | One-time authorisation, below |

On the app, add this **exact** redirect URI and click **Add** before saving:

```
http://127.0.0.1:8888/callback
```

Spotify rejects `localhost` — it requires the loopback IP `127.0.0.1`. Put the
client ID and secret in `.env`, then:

```bash
node scripts/spotify-token.mjs
```

**Leave it running.** It opens `http://127.0.0.1:8888` — click *Authorise with
Spotify* there. It exchanges the code and writes `SPOTIFY_REFRESH_TOKEN` into
`.env` without printing it. The token does not expire.

Start from that address, not from an older Spotify tab: the authorisation link
is generated by the running process, so a stale tab can carry a link that no
longer matches.

If you registered a different redirect URI, point the script at it rather than
re-registering — it must match byte for byte:

```bash
node scripts/spotify-token.mjs --redirect http://127.0.0.1:3000/callback
```

**`ERR_CONNECTION_REFUSED` on the callback** means nothing was listening when
the redirect arrived — either the script had already exited, or the redirect URI
points at a different port than it binds. The script must be running for the
whole round trip.

**`client_id: Invalid`** means the authorisation URL carried a client ID that
Spotify does not recognise, usually a stale tab or a mis-copied link. Always
start at `http://127.0.0.1:8888`.

Scopes requested: `user-top-read`, `user-read-currently-playing`,
`user-read-recently-played`.

### osu!

| Variable | Where it comes from |
|---|---|
| `OSU_CLIENT_ID` | [osu.ppy.sh/home/account/edit](https://osu.ppy.sh/home/account/edit) → OAuth → New application |
| `OSU_CLIENT_SECRET` | Same application |
| `OSU_USER` | Your username |

Client-credentials grant, public scope. No user authorisation needed.

### MyAnimeList

| Variable | Where it comes from |
|---|---|
| `MAL_CLIENT_ID` | [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) → Create ID |
| `MAL_USER` | Your username |

Only the client ID is used — reading a *public* list needs no user OAuth, so
there is no token to mint and nothing to refresh.

**Your anime and manga lists must be public.** MyAnimeList → Settings →
Privacy. A private list answers `403 not_permitted`, and both panels will say
so rather than looking broken.

The adapter requests `nsfw=true`. That is not a content preference — MyAnimeList
applies the flag to anything rated R+ or above, which covers plenty of ordinary
shows, and the default filter silently drops those entries and understates every
total. Set it to `false` in `api/_lib/mal.js` if you would rather those titles
never appear.

## Endpoints

| Route | Cache | Notes |
|---|---|---|
| `/api/stats` | 5 min | Everything at once — this is what the front page calls |
| `/api/spotify?now=1` | 30 s | Just the now-playing ticker; polled every 45 s |
| `/api/goodreads` `/api/letterboxd` `/api/osu` `/api/spotify` `/api/mal` | 10–60 min | Individual sources, useful for debugging |

All responses use `stale-while-revalidate`, so a slow upstream never makes a
visitor wait.

## Writing in the journal

`posts/` starts empty. To add the first entry:

```bash
node scripts/new-entry.mjs "First entry" --tags notes
```

That writes `posts/<slug>.md` and registers it in `posts/index.json`. Fill in
the `dek` — it's the one-line summary shown on the journal and home page. Add
`"draft": true` to keep an entry out of both listings.

Entries are plain Markdown: `##`–`####` headings, `-`/`1.` lists, `>` quotes,
fenced code, links, images, and `---` for a section break. Straight quotes and
`--` are converted to proper typography on render. The first paragraph gets the
drop cap automatically, so lead with prose rather than a heading.

## What to edit by hand

Two things, both in the **About** section of `index.html`:

- the **bio** paragraph
- the **Details** sidebar next to it

Everything else on the page comes from the APIs.

## Deploying

Push to the connected Vercel project. `vercel.json` handles clean URLs, the
`/journal/<slug>` rewrite, cache headers and security headers. There is no
build command — the root is served statically and `api/` becomes functions
(Node 20+, ESM).
