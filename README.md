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
- A full-bleed Lisbon Aerial Loop page at `#/watch` that retains MP4 chunk playback, audio, seek controls, looping after the user presses Play, and download progress.
- A separate Safari-compatible video page at `#/watch1`: Safari streams 4K HLS segments with buffering feedback; browsers without native HLS support fall back to the MP4 chunk loader. Both pages share the same compressed video assets.
- A separate GettyImages video page at `#/watch2`, using the same full-bleed layout, native audio/seek controls, and looping after Play. The supplied MOV is converted to a browser-compatible 4K MP4.
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

Upload the tracked repository contents (excluding git-ignored source MP4s and MOVs) to any static host that can serve files with normal MIME types:

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
- `.m3u8` -> `application/vnd.apple.mpegurl`
- `.m4s`, `.mp4` -> `video/mp4`
- `.csv` -> `text/csv`
- `.md` -> `text/markdown` or `text/plain`

## GitHub Pages

For GitHub Pages, publish the `main` branch from the repository root (`/`). After Pages is enabled, open:

```text
https://<owner>.github.io/<repo>/
```

Because all app navigation uses hash routes, deep links such as `https://<owner>.github.io/<repo>/#/watch`, `#/watch1`, and `#/watch2` work without extra configuration.

## Key files

- `index.html` — static shell
- `app.js` — router, portal, navigator, matrix, docs, and video page
- `styles.css` — shared portal/docs/video styles
- `sites-a.js`, `sites-b.js` — structured data for all 30 sites
- `sites/` — 30 bespoke site renderers and scoped CSS files
- `images/`, `images-pexels/` — bundled referenced image assets only
- `videos/lisbon-pages.json`, `videos/lisbon-pages.part*` — compressed 4K MP4 with audio, split into GitHub-safe chunks and reassembled in browsers without native HLS
- `videos/lisbon-pages-hls/` — the same compressed 4K H.264/AAC video packaged as native HLS for Safari, without assembling a whole-video blob in JavaScript memory
- `videos/getty-images.mp4`, `videos/getty-images-poster.jpg` — browser-compatible GettyImages video and a poster extracted from that video for `#/watch2`
- `PUBLIC-URLS.csv` — public URL inventory
- `server.mjs` — tiny local static server

### Safari video delivery

Deploy the entire `videos/` directory, including the MP4 chunk manifest and parts, HLS playlist, initialization MP4, and all media segments. The existing `#/watch` page always uses the MP4 chunk loader. The new `#/watch1` page enables native HLS when supported, detected with `canPlayType`, not a browser-name check; other browsers fall back to the same MP4 chunks. A "Video (Safari)" navigation link opens the new page. Navigating between routes cancels downloads and releases the previous video source; playback errors are shown without automatic reloads.

The video retains 3840 × 2160 resolution and audio but uses lossy compression to fit GitHub Pages. Its two delivery formats together with the rest of the site must remain below 800 MB, leaving room under Pages' 1 GB published-site limit. Splitting files only addresses GitHub's per-file limit; it does not reduce total deployment size. Superseded video assets are not included in the published tree.

The local server supports byte-range requests and HEAD responses for native media playback. Static hosts should also support byte ranges and the MIME types above.

To regenerate the compressed video and both delivery formats from the locally available (git-ignored) source, install FFmpeg and run:

```powershell
ffmpeg -hide_banner -nostdin -i Lisbon-new.mp4 -map 0:v:0 -map 0:a:0 -c:v libx264 -preset veryfast -threads 4 -profile:v main -level:v 5.1 -pix_fmt yuv420p -b:v 12M -maxrate 12M -bufsize 24M -g 120 -keyint_min 120 -sc_threshold 0 -c:a aac -b:a 128k -movflags +faststart lisbon-pages.mp4
node scripts\package-video.mjs lisbon-pages.mp4
Remove-Item -LiteralPath lisbon-pages.mp4
```

HLS segments end on four-second keyframes. MP4 chunks are at most 95 MiB. The packaging script rejects compressed inputs over 350 MB. Video regression tests verify all generated files, the reconstructed MP4 size, and the total deployable tree size. Root MP4 source files remain git-ignored.

Commit both the replacement assets and deletion of superseded assets in the same change. Use Git to upload these files; browser-based uploads have a lower per-file limit. Removing old assets reduces the deployed site size, but does not remove them from Git history.

Run the video regression tests with `node --test tests\video.test.mjs`.

### GettyImages video delivery

The supplied `GettyImages.mov` uses ProRes video and PCM audio and is over 1 GB. It remains local and git-ignored. The `#/watch2` page serves a smaller H.264/AAC MP4 directly, without downloading and assembling video chunks in JavaScript. The existing `#/watch` and `#/watch1` playback paths are unchanged.

To regenerate the MP4 and poster with FFmpeg:

```powershell
ffmpeg -hide_banner -nostdin -i GettyImages.mov -map 0:v:0 -map 0:a:0 -c:v libx264 -preset slow -threads 4 -profile:v high -level:v 5.1 -pix_fmt yuv420p -crf 14 -maxrate 60M -bufsize 60M -c:a aac -b:a 320k -movflags +faststart videos\getty-images.mp4
ffmpeg -hide_banner -nostdin -ss 0.5 -i videos\getty-images.mp4 -frames:v 1 -vf "scale=1280:-2" -q:v 3 -update 1 videos\getty-images-poster.jpg
```

The higher-quality version uses CRF 14, the slow H.264 preset, and 320 kbps AAC instead of the earlier 12 Mbps video encode. Its bitrate ceiling keeps the short clip within GitHub's per-file limit and the site's size budget. It retains the full 11.52-second duration, 3840 × 2160 resolution, and 25 fps. This is still a lossy, browser-compatible 8-bit 4:2:0 conversion of the 10-bit 4:2:2 ProRes original, not an identical-quality copy. The player versions its media URLs so browsers do not reuse the previous lower-quality encode from cache.

Deploy both generated files. The regression tests include them in the complete site's 800 MB size budget. Confirm that your GettyImages license permits the intended public web use before publishing; the supplied file's license details were not provided.

## Licensing and attribution

Written content is original travel content. Bundled external media is documented in `IMAGE-ATTRIBUTION.md` and `IMAGE-ATTRIBUTION.csv`. Pexels media is included under the Pexels License; Wikimedia Commons media retains the individual license noted in the attribution ledger.
The user-supplied GettyImages video and its extracted poster have unverified license details and are not represented as Pexels or Creative Commons assets.
