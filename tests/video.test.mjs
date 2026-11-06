import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "app.js"), "utf8");
const loader = source.slice(
  source.indexOf("async function loadLisbonVideo("),
  source.indexOf("function renderNavigator()"),
);
const mockManifest = {
  parts: Array.from({ length: 4 }, (_, index) =>
    `videos/lisbon-pages.part${String(index + 1).padStart(3, "0")}`),
  size: 4,
};

function setup({ native = true, fetchImpl } = {}) {
  const nodes = Object.fromEntries([
    "#video-loading", "#video-loading-label", ".video-progress", "#video-progress-fill",
  ].map((selector) => [selector, {
    hidden: false,
    style: {},
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  const video = new EventTarget();
  Object.assign(video, {
    src: "",
    duration: 202.2,
    currentTime: 0,
    error: null,
    buffered: { length: 1, start: () => 0, end: () => 5 },
    canPlayType: () => native ? "maybe" : "",
    pause() { this.paused = true; },
    removeAttribute() { this.src = ""; },
    load() { this.loadCalled = true; },
  });
  nodes["#lisbon-4k-video"] = video;
  const requests = [];
  const errors = [];
  const revoked = [];
  let blob;
  const context = {
    document: { querySelector: (selector) => nodes[selector] },
    AbortController,
    Blob,
    console: { error: (error) => errors.push(error) },
    URL: {
      createObjectURL(value) { blob = value; return "blob:test"; },
      revokeObjectURL: (url) => revoked.push(url),
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return fetchImpl ? fetchImpl(url, options) : {
        ok: true,
        json: async () => mockManifest,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      };
    },
  };
  runInNewContext(loader, context);
  return {
    context, video, nodes, requests, errors, revoked,
    get blob() { return blob; },
  };
}

test("native HLS avoids fetching chunks or constructing a whole-video blob", async () => {
  const state = setup();
  await state.context.loadLisbonVideo(true);
  assert.equal(state.video.src, "videos/lisbon-pages-hls/playlist.m3u8");
  assert.equal(state.requests.length, 0);
  assert.equal(state.blob, undefined);
  state.video.dispatchEvent(new Event("progress"));
  assert.equal(state.nodes[".video-progress"].attributes["aria-valuenow"], "50");
  state.video.dispatchEvent(new Event("loadeddata"));
  assert.equal(state.nodes["#video-loading"].hidden, true);
  state.video.dispatchEvent(new Event("waiting"));
  assert.equal(state.nodes["#video-loading"].hidden, false);
  state.video.dispatchEvent(new Event("playing"));
  assert.equal(state.nodes["#video-loading"].hidden, true);
  state.context.disposeLisbonVideo();
  assert.equal(state.video.src, "");
  assert.equal(state.video.paused, true);
  assert.equal(state.video.loadCalled, true);
  state.video.dispatchEvent(new Event("error"));
  assert.equal(state.errors.length, 0);
});

test("native playback errors remain visible without restarting playback", async () => {
  const state = setup();
  await state.context.loadLisbonVideo(true);
  state.video.error = { code: 3, message: "Decode error" };
  state.video.dispatchEvent(new Event("error"));
  state.video.dispatchEvent(new Event("canplay"));
  assert.equal(state.nodes["#video-loading"].hidden, false);
  assert.equal(state.nodes[".video-progress"].hidden, true);
  assert.match(state.nodes["#video-loading-label"].textContent, /Unable to load/);
  assert.equal(state.errors[0], state.video.error);
  assert.equal(state.video.src, "videos/lisbon-pages-hls/playlist.m3u8");
  state.context.disposeLisbonVideo();
});

test("non-HLS browsers load manifest chunks and release their object URL", async () => {
  const state = setup({ native: false });
  await state.context.loadLisbonVideo(true);
  assert.equal(state.requests.length, 5);
  assert.equal(state.requests[0].url, "videos/lisbon-pages.json");
  assert.equal(state.requests[1].url, "videos/lisbon-pages.part001");
  assert.equal(state.requests[4].url, "videos/lisbon-pages.part004");
  assert.equal(state.blob.size, 4);
  assert.equal(state.blob.type, "video/mp4");
  assert.equal(state.video.src, "blob:test");
  assert.equal(state.nodes["#video-loading"].hidden, true);
  assert.equal(state.nodes[".video-progress"].attributes["aria-valuenow"], "100");
  state.context.disposeLisbonVideo();
  assert.deepEqual(state.revoked, ["blob:test"]);
  assert.equal(state.requests[0].options.signal.aborted, true);
});

test("the existing watch page keeps chunk playback even when native HLS is available", async () => {
  const state = setup();
  await state.context.loadLisbonVideo();
  assert.equal(state.video.src, "blob:test");
  assert.equal(state.requests.length, 5);
  state.context.disposeLisbonVideo();
});

test("watch and watch1 select distinct modes and dispose the previous video", () => {
  const modes = [];
  let disposed = 0;
  const context = {
    location: { hash: "#/watch" },
    disposeLisbonVideo: () => { disposed++; },
    renderWatch: (safariCompatible = false) => modes.push(safariCompatible),
  };
  runInNewContext(source.slice(
    source.indexOf("function route()"),
    source.indexOf("function portalHeader("),
  ), context);
  context.route();
  assert.equal(context.disposeLisbonVideo, undefined);
  context.disposeLisbonVideo = () => { disposed++; };
  context.location.hash = "#/watch1";
  context.route();
  assert.deepEqual(modes, [false, true]);
  assert.equal(disposed, 2);
});

test("navigation exposes both video pages", () => {
  const context = {};
  runInNewContext(source.slice(
    source.indexOf("function portalHeader("),
    source.indexOf("function renderPortal()"),
  ), context);
  const header = context.portalHeader("watch1");
  assert.match(header, /href="#\/watch">Video</);
  assert.match(header, /class="active" href="#\/watch1">Video \(Safari\)</);
});

test("leaving the video route cancels an in-flight manifest or chunk without an error", async () => {
  for (const stage of ["manifest", "chunk"]) {
    const state = setup({
      native: false,
      fetchImpl: (url, { signal }) => url.endsWith(".json") && stage === "chunk"
        ? { ok: true, json: async () => mockManifest }
        : new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    });
    const loading = state.context.loadLisbonVideo();
    await new Promise((resolve) => setImmediate(resolve));
    state.context.disposeLisbonVideo();
    await loading;
    assert.equal(state.requests.length, stage === "manifest" ? 1 : 2);
    assert.equal(state.errors.length, 0);
    assert.equal(state.blob, undefined);
  }
});

test("chunk HTTP failures produce a visible, logged error", async () => {
  const state = setup({
    native: false,
    fetchImpl: async (url) => url.endsWith(".json")
      ? { ok: true, json: async () => mockManifest }
      : { ok: false },
  });
  await state.context.loadLisbonVideo();
  assert.equal(state.errors.length, 1);
  assert.equal(state.nodes["#video-loading"].hidden, false);
  assert.equal(state.nodes[".video-progress"].hidden, true);
  assert.equal(state.video.src, "");
  state.context.disposeLisbonVideo();
});

test("invalid manifests and truncated downloads fail visibly", async () => {
  for (const manifest of [
    null, { parts: [], size: 1 }, { ...mockManifest, size: 5 },
    { ...mockManifest, size: 3 }, { ...mockManifest, size: 350_000_001 },
  ]) {
    const state = setup({
      native: false,
      fetchImpl: async () => ({
        ok: true,
        json: async () => manifest,
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      }),
    });
    await state.context.loadLisbonVideo();
    assert.equal(state.errors.length, 1);
    assert.equal(state.video.src, "");
    assert.equal(state.nodes["#video-loading"].hidden, false);
    state.context.disposeLisbonVideo();
  }
});

test("HLS VOD contains all segments and stays below GitHub's file limit", () => {
  const directory = join(root, "videos", "lisbon-pages-hls");
  const playlist = readFileSync(join(directory, "playlist.m3u8"), "utf8");
  assert.match(playlist, /#EXT-X-PLAYLIST-TYPE:VOD/);
  assert.match(playlist, /#EXT-X-INDEPENDENT-SEGMENTS/);
  assert.match(playlist, /#EXT-X-ENDLIST/);
  const init = /#EXT-X-MAP:URI="([^"]+)"/.exec(playlist)[1];
  const segments = playlist.split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
  assert.equal(segments.length, 51);
  for (const file of [init, ...segments]) {
    const { size } = statSync(join(directory, file));
    assert.ok(size > 0 && size < 100 * 1024 * 1024, `${file}: ${size} bytes`);
  }
  const durations = [...playlist.matchAll(/#EXTINF:([\d.]+)/g)].map((match) => Number(match[1]));
  assert.ok(Math.abs(durations.reduce((sum, value) => sum + value, 0) - 202.2) < 0.001);
  const target = Number(/#EXT-X-TARGETDURATION:(\d+)/.exec(playlist)[1]);
  assert.ok(durations.every((duration) => Math.round(duration) <= target));
});

test("MP4 chunks match the manifest and the complete site stays below 800 MB", () => {
  const manifest = JSON.parse(readFileSync(join(root, "videos", "lisbon-pages.json"), "utf8"));
  assert.ok(manifest.parts.length > 0);
  let chunkBytes = 0;
  for (const part of manifest.parts) {
    assert.match(part, /^videos\/lisbon-pages\.part\d{3}$/);
    const { size } = statSync(join(root, part.replaceAll("/", sep)));
    assert.ok(size > 0 && size <= 95 * 1024 * 1024);
    chunkBytes += size;
  }
  assert.equal(chunkBytes, manifest.size);
  assert.ok(chunkBytes <= 350_000_000);
  const files = execFileSync("git", [
    "ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z",
  ], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  let siteBytes = 0;
  for (const file of files) {
    const path = join(root, file.replaceAll("/", sep));
    if (!existsSync(path)) continue;
    const { size } = statSync(path);
    assert.ok(size < 100 * 1024 * 1024, `${file} exceeds GitHub's file limit`);
    siteBytes += size;
  }
  assert.ok(siteBytes < 800_000_000, `Complete site is ${siteBytes} bytes`);
  assert.ok(readdirSync(join(root, "videos")).every((name) => name.startsWith("lisbon-pages")));
});

test("local server serves HLS MIME types, HEAD, and media byte ranges", async (t) => {
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server startup timed out")), 10000);
    server.once("error", (error) => { clearTimeout(timeout); reject(error); });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before readiness: ${code}`));
    });
    server.stdout.on("data", (chunk) => {
      const match = /http:\/\/localhost:(\d+)/.exec(String(chunk));
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
  });
  const playlist = await fetch(`${base}/videos/lisbon-pages-hls/playlist.m3u8`);
  assert.equal(playlist.status, 200);
  assert.equal(playlist.headers.get("content-type"), "application/vnd.apple.mpegurl");
  assert.match(await playlist.text(), /#EXTM3U/);
  const media = `${base}/videos/lisbon-pages-hls/init.mp4`;
  const bytes = readFileSync(join(root, "videos", "lisbon-pages-hls", "init.mp4"));
  const head = await fetch(media, { method: "HEAD" });
  assert.equal(head.headers.get("content-length"), String(bytes.length));
  assert.equal(head.headers.get("accept-ranges"), "bytes");
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const [range, start, end] of [
    ["bytes=0-15", 0, 15],
    ["bytes=-16", bytes.length - 16, bytes.length - 1],
    ["bytes=16-", 16, bytes.length - 1],
    ["bytes=0-999999", 0, bytes.length - 1],
  ]) {
    const response = await fetch(media, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), `bytes ${start}-${end}/${bytes.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
  }
  for (const range of ["bytes=999999-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=0-1,4-5"]) {
    const response = await fetch(media, { headers: { Range: range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), `bytes */${bytes.length}`);
    await response.arrayBuffer();
  }
  const segment = await fetch(`${base}/videos/lisbon-pages-hls/segment-000.m4s`, {
    method: "HEAD",
  });
  assert.equal(segment.status, 200);
  assert.equal(segment.headers.get("content-type"), "video/mp4");
});
