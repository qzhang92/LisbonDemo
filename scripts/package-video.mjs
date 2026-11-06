import { spawnSync } from "node:child_process";
import {
  closeSync, mkdirSync, openSync, readFileSync, readdirSync, readSync,
  statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts\\package-video.mjs <compressed MP4>");
const source = resolve(input);
const size = statSync(source).size;
if (size <= 0 || size > 350_000_000) {
  throw new Error(`Compressed MP4 must be between 1 and 350 MB; got ${size} bytes.`);
}
const directory = join(root, "videos", "lisbon-pages-hls");
mkdirSync(directory, { recursive: true });
const result = spawnSync("ffmpeg", [
  "-hide_banner", "-nostdin", "-y", "-i", source,
  "-map", "0:v:0", "-map", "0:a:0", "-c", "copy",
  "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod",
  "-hls_segment_type", "fmp4", "-hls_flags", "independent_segments",
  "-hls_fmp4_init_filename", "init.mp4",
  "-hls_segment_filename", "segment-%03d.m4s", "playlist.m3u8",
], { cwd: directory, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`FFmpeg exited with code ${result.status}.`);
const segments = new Set(readFileSync(join(directory, "playlist.m3u8"), "utf8")
  .split(/\r?\n/).filter((line) => /^segment-\d+\.m4s$/.test(line)));
for (const name of readdirSync(directory)) {
  if (/^segment-\d+\.m4s$/.test(name) && !segments.has(name)) {
    unlinkSync(join(directory, name));
  }
}

const chunkSize = 95 * 1024 * 1024;
const buffer = Buffer.allocUnsafe(chunkSize);
const parts = [];
const descriptor = openSync(source, "r");
try {
  let offset = 0;
  while (offset < size) {
    const length = Math.min(chunkSize, size - offset);
    let read = 0;
    while (read < length) {
      const count = readSync(descriptor, buffer, read, length - read, offset + read);
      if (count === 0) throw new Error(`Unexpected end of MP4 at byte ${offset + read}.`);
      read += count;
    }
    const name = `lisbon-pages.part${String(parts.length + 1).padStart(3, "0")}`;
    writeFileSync(join(root, "videos", name), buffer.subarray(0, length));
    parts.push(`videos/${name}`);
    offset += length;
  }
} finally {
  closeSync(descriptor);
}
const partNames = new Set(parts.map((part) => part.slice("videos/".length)));
for (const name of readdirSync(join(root, "videos"))) {
  if (/^lisbon-pages\.part\d{3}$/.test(name) && !partNames.has(name)) {
    unlinkSync(join(root, "videos", name));
  }
}
writeFileSync(
  join(root, "videos", "lisbon-pages.json"),
  `${JSON.stringify({ parts, size }, null, 2)}\n`,
);
console.log(`Packaged ${size} bytes into ${parts.length} MP4 chunks and native HLS.`);
