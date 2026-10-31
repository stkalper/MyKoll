// A contact sheet of a clip, to see what's in it without playing it: a frame every `step`
// seconds, stamped with its time, tiled into one PNG next to the clip in out/sheets.
//   node scripts/sheet.mjs public/footage/clip.mp4 [step=1.5] [from=0] [to=end]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = resolve(import.meta.dirname, "..");
const BIN = join(ROOT, "node_modules/@remotion/compositor-win32-x64-msvc");
const CHROME = join(ROOT, "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
const [clip, step = "1.5", from = "0", to] = process.argv.slice(2);

const duration = Number(execFileSync(join(BIN, "ffprobe.exe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip]).toString());
const end = Math.min(duration, to ? Number(to) : duration);
const name = basename(clip).replace(/\.\w+$/, "");
const tmp = join(ROOT, "out/sheets", `${name}-frames`);
mkdirSync(tmp, { recursive: true });

const frames = [];
for (let t = Number(from); t < end; t += Number(step)) {
  const file = join(tmp, `${frames.length}.jpg`);
  execFileSync(join(BIN, "ffmpeg.exe"), ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", clip, "-frames:v", "1", "-vf", "scale=240:-2", "-q:v", "4", file]);
  frames.push({ t, src: `data:image/jpeg;base64,${readFileSync(file).toString("base64")}` });
}

const html = `<body style="margin:0;background:#111;display:flex;flex-wrap:wrap;gap:4px;padding:4px;width:${8 * 244}px">${frames
  .map((f) => `<div style="position:relative"><img src="${f.src}" style="display:block;width:240px"><b style="position:absolute;top:2px;left:2px;background:#000;color:#ff0;font:bold 16px monospace;padding:1px 4px">${f.t.toFixed(1)}s</b></div>`)
  .join("")}</body>`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 8 * 244 + 8, height: 400 });
await page.setContent(html);
const out = join(ROOT, "out/sheets", `${name}${from !== "0" || to ? `-${from}-${to ?? "end"}` : ""}.png`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
rmSync(tmp, { recursive: true });
console.log(out);
