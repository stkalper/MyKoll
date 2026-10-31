// Cuts one voice-over take into the ten clips the scenes play (public/audio/vo_00…vo_09.mp3).
// The script is read with a ~2.5 s pause between scenes and shorter ones inside them, so the nine
// longest silences are the cuts.
//   node scripts/split-voice.mjs [public/audio/voiceover.mp3]
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const FFMPEG = join(ROOT, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const AUDIO = join(ROOT, "public/audio");
const input = resolve(process.argv[2] ?? join(AUDIO, "voiceover.mp3"));
const NAMES = [
  "vo_00_cold_open",
  "vo_01_problem",
  "vo_02_title",
  "vo_03_just_talk",
  "vo_04_settles",
  "vo_05_memory",
  "vo_06_channels",
  "vo_07_ask",
  "vo_08_under_the_hood",
  "vo_09_end",
];

// silencedetect prints each quiet stretch to stderr.
const probe = spawnSync(FFMPEG, ["-hide_banner", "-i", input, "-af", "silencedetect=noise=-40dB:d=0.9", "-f", "null", "-"], { encoding: "utf8" });
const log = probe.stderr;
const total = Number(log.match(/Duration: (\d+):(\d+):([\d.]+)/)?.slice(1).reduce((t, v, i) => t + Number(v) * [3600, 60, 1][i], 0));
const silences = [...log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => ({ start: Number(m[1]), end: Number(m[2]) }));
// A pause at the very start or end isn't a cut.
const inner = silences.filter((g) => g.start > 0.3 && g.end < total - 0.3);
if (inner.length < NAMES.length - 1) {
  console.error(`Found ${inner.length} pauses, need ${NAMES.length - 1}. Make the pauses between scenes longer (2.5 s) and try again.`);
  process.exit(1);
}
const cuts = [...inner]
  .sort((a, b) => b.end - b.start - (a.end - a.start))
  .slice(0, NAMES.length - 1)
  .sort((a, b) => a.start - b.start);

// Each clip keeps a breath on either side of the speech.
const bounds = [0, ...cuts.flatMap((g) => [g.start + 0.2, g.end - 0.12]), total];
NAMES.forEach((name, i) => {
  const from = Math.max(0, bounds[i * 2]);
  const to = bounds[i * 2 + 1];
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", input, "-ss", from.toFixed(3), "-to", to.toFixed(3), "-c:a", "libmp3lame", "-b:a", "192k", join(AUDIO, `${name}.mp3`)]);
  console.log(`${name}.mp3  ${from.toFixed(2)}–${to.toFixed(2)} s  (${(to - from).toFixed(1)} s)`);
});
console.log(`cuts at the ${cuts.length} longest pauses: ${cuts.map((g) => `${(g.end - g.start).toFixed(1)} s`).join(", ")}`);
