# Lisbon Atlas

Lisbon Atlas is a portable static Microsoft Edge/Copilot travel corpus for planning a trip to Lisbon, Portugal. It contains 30 independent travel websites, a quick navigation hub, a cross-source relationship matrix, standards/source documentation, and a full-bleed looping aerial video page.

## Note
This is a duplicate version of `https://github.com/guneetsingh097/LisbonDemo`. If you have any questions, please contact Guneet.  
This duplicate is created due to repo auth issues.   
This is on personal repo due to auth issues too.

## What is included

- 30 travel websites with bespoke layouts, type systems, colors, voices, and navigation patterns.
- 210 core site pages: home, about, offerings, resources, detail guide, FAQ, and contact for every property.
- A quick navigator at `#/navigate`.
- A relationship matrix at `#/matrix`.
- A full-bleed Lisbon Aerial Loop page at `#/watch` that autoplays muted, loops continuously, provides native playback and seek controls, and shows loading progress while the original 4K Pexels MP4 chunks download.
- Bundled media and attribution files:
  - `IMAGE-ATTRIBUTION.md`
  - `IMAGE-ATTRIBUTION.csv`
- Public URL inventory: `PUBLIC-URLS.csv`.
- CELA-aligned approved company/domain/contact data.

## CELA alignment notes

- Company names and domains use the approved company/domain list.
- Portuguese personal names use the approved Portuguese-name list.
- Contact emails use a first-name-only username on an approved domain, for example `raquel@contososuites.com`.
- International phone numbers are sequential numbers: `+351 210 000 001` through `+351 210 000 030`.
- No street addresses are currently used. If addresses are added later, use sequential numbers, common street names, and intentionally incorrect postal codes.
- Logos are stylized logotypes of the approved company name or non-descript functional marks.
- All commercial properties, people, schedules, prices, comments, policies, and services are travel-planning content.

## Run locally

This is a static site. No build step is required.

```powershell
node server.mjs
```

Then open:

```text
http://localhost:4173
```

ES modules should be served over HTTP; do not open `index.html` directly with a `file://` URL.

## Deploy anywhere

Upload the repository contents to any static host that can serve files with normal MIME types:

- GitHub Pages
- Azure Static Web Apps
- Azure Blob static website hosting
- Netlify
- Vercel static output
- IIS, Nginx, Apache, or any CDN-backed file host

The app uses hash routing (`#/site/1`, `#/watch`, `#/navigate`), so it does not require server-side rewrite rules and works under any domain or subpath.

Required MIME types:

- `.html` -> `text/html`
- `.js` -> `text/javascript` or `application/javascript`
- `.css` -> `text/css`
- `.jpg` -> `image/jpeg`
- video chunks -> `application/octet-stream` or `video/mp4`
- `.csv` -> `text/csv`
- `.md` -> `text/markdown` or `text/plain`

## GitHub Pages

For GitHub Pages, publish the `main` branch from the repository root (`/`). After Pages is enabled, open:

```text
https://<owner>.github.io/<repo>/
```

Because all app navigation uses hash routes, deep links such as `https://<owner>.github.io/<repo>/#/watch` work without extra configuration.

## Key files

- `index.html` — static shell
- `app.js` — router, portal, navigator, matrix, docs, and video page
- `styles.css` — shared portal/docs/video styles
- `sites-a.js`, `sites-b.js` — structured data for all 30 sites
- `sites/` — 30 bespoke site renderers and scoped CSS files
- `images/`, `images-pexels/` — bundled referenced image assets only
- `videos/lisbon-aerial-4823566-4k.part001` through `.part007` — original 4K Pexels MP4 split into GitHub-safe chunks and reassembled in-browser
- `PUBLIC-URLS.csv` — public URL inventory
- `server.mjs` — tiny local static server

## Licensing and attribution

Written content is original travel content. Bundled external media is documented in `IMAGE-ATTRIBUTION.md` and `IMAGE-ATTRIBUTION.csv`. Pexels media is included under the Pexels License; Wikimedia Commons media retains the individual license noted in the attribution ledger.
