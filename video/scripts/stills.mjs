// Full-page screenshots for the parts of the video that scroll inside Remotion, where the scroll
// can be eased frame by frame: the Mini App's three tabs and a Suiscan proof.
//   node scripts/stills.mjs
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = resolve(import.meta.dirname, "..");
const CHROME = join(ROOT, "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");
const OUT = join(ROOT, "public/captures");
const SITE = "https://mykoll.vercel.app";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb", "--lang=en-US"] });
try {
  // Mini App, phone-sized at 3x, one tall image per tab. The bottom nav is fixed, so it's taken
  // once on its own and laid over the scrolling page in the video.
  const app = await browser.newPage();
  await app.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
  await app.goto(`${SITE}/app`, { waitUntil: "networkidle2", timeout: 60_000 });
  await wait(2500);
  await app.screenshot({ path: join(OUT, "miniapp-screen.png") });
  for (const [label, file] of [["Board", "miniapp-board"], ["Calls", "miniapp-calls"], ["My file", "miniapp-me"]]) {
    await app.evaluate((label) => [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === label)?.click(), label);
    await app.evaluate(() => scrollTo(0, 0));
    await wait(1500);
    await app.evaluate(() => (document.querySelector("nav").style.visibility = "hidden"));
    await app.screenshot({ path: join(OUT, `${file}.png`), fullPage: true });
    await app.evaluate(() => (document.querySelector("nav").style.visibility = ""));
    console.log(file);
  }
  const nav = await app.$("nav");
  await nav.screenshot({ path: join(OUT, "miniapp-nav.png"), omitBackground: true });

  // The Sui transaction behind a SUI price, as a desktop page. Suiscan turns headless browsers
  // away (Cloudflare), so the still comes from SuiVision, which shows the same transaction.
  const scan = await browser.newPage();
  await scan.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1.5 });
  await scan.goto(process.env.PROOF_URL ?? "https://suivision.xyz/txblock/ArKcHAKBUK3QaBvvkgSPJYhLFYFYYNP77AAQgzox172m", { waitUntil: "networkidle2", timeout: 60_000 });
  await wait(4000);
  await scan.screenshot({ path: join(OUT, "suiscan.png"), fullPage: true });
  console.log("suiscan");

  // The landing page top to bottom, for stills of its sections.
  const land = await browser.newPage();
  await land.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await land.goto(SITE, { waitUntil: "networkidle2", timeout: 60_000 });
  await wait(3000);
  await land.screenshot({ path: join(OUT, "landing-full.png"), fullPage: true });
  console.log("landing-full");
} finally {
  await browser.close();
}
