// Records the live site for the demo video: the landing page, the Mini App and a Suiscan proof.
//   node scripts/capture.mjs [landing|miniapp|suiscan ...]
// Frames come from Chrome's screencast with their timestamps, then ffmpeg (bundled with Remotion)
// lays them out at a constant 30 fps, so the clips play at the speed they were recorded.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = resolve(import.meta.dirname, "..");
const CHROME = join(ROOT, "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
const FFMPEG = join(ROOT, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const OUT = join(ROOT, "public/captures");
const SITE = "https://mykoll.vercel.app";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Scrolls the page smoothly to `to` (px, or "bottom") over `ms`, eased, inside the page so it's frame-smooth. */
const scroll = (page, to, ms) =>
  page.evaluate(
    (to, ms) =>
      new Promise((done) => {
        const from = scrollY;
        const end = to === "bottom" ? document.documentElement.scrollHeight - innerHeight : to;
        const start = performance.now();
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms);
          scrollTo(0, from + (end - from) * ease(t));
          t < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    to,
    ms,
  );

async function record(browser, name, { url, width, height, scale = 1, act }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60_000 });
  await wait(2500);

  const cdp = await page.createCDPSession();
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ data: f.data, at: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width * scale, maxHeight: height * scale, everyNthFrame: 1 });
  await wait(600);
  await act(page);
  await wait(800);
  await cdp.send("Page.stopScreencast");
  await page.close();

  // Each frame lasts until the next one arrived; ffmpeg's concat demuxer takes those durations.
  const dir = join(OUT, `${name}-frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const list = [];
  frames.forEach((f, i) => {
    const file = `f${String(i).padStart(5, "0")}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.at ?? f.at + 1 / 30;
    list.push(`file '${file}'`, `duration ${Math.max(1 / 60, next - f.at).toFixed(4)}`);
  });
  list.push(`file 'f${String(frames.length - 1).padStart(5, "0")}.jpg'`);
  writeFileSync(join(dir, "list.txt"), list.join("\n"));
  const out = join(OUT, `${name}.mp4`);
  execFileSync(
    FFMPEG,
    // Remotion's ffmpeg is a slim build without the fps filter, so -r sets the constant rate.
    ["-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", out],
    { cwd: dir, stdio: "ignore" },
  );
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}: ${frames.length} frames, ${(frames.at(-1).at - frames[0].at).toFixed(1)} s → ${out}`);
}

const takes = {
  // The whole landing page, pen and all, in one slow scroll.
  landing: {
    url: SITE,
    width: 1920,
    height: 1080,
    act: async (page) => {
      await wait(1500);
      await scroll(page, "bottom", 48_000);
      await wait(1500);
    },
  },
  // The Mini App's demo board in a phone-sized window: board, calls, my file.
  miniapp: {
    url: `${SITE}/app`,
    width: 400,
    height: 860,
    scale: 2.5,
    act: async (page) => {
      const tab = (label) =>
        page.evaluate((label) => [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === label)?.click(), label);
      await wait(1200);
      await scroll(page, 900, 3500);
      await wait(700);
      await scroll(page, 0, 1500);
      await tab("Calls");
      await wait(1500);
      await scroll(page, 1400, 4500);
      await wait(700);
      await tab("My file");
      await page.evaluate(() => scrollTo(0, 0));
      await wait(1500);
      await scroll(page, 1000, 3500);
      await wait(1200);
    },
  },
  // The Sui transaction that set the SUI price a receipt was judged by.
  suiscan: {
    url: process.env.PROOF_URL ?? "https://suiscan.xyz/mainnet/tx/ArKcHAKBUK3QaBvvkgSPJYhLFYFYYNP77AAQgzox172m",
    width: 1920,
    height: 1080,
    act: async (page) => {
      await wait(2500);
      await scroll(page, 700, 3500);
      await wait(2000);
    },
  },
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(takes);
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb", "--lang=en-US"] });
try {
  for (const name of wanted) await record(browser, name, takes[name]);
} finally {
  await browser.close();
}
