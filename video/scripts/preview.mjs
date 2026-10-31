// Renders a few frames of each scene as PNGs, to look at the film without rendering all of it.
//   node scripts/preview.mjs [sceneId ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "out/preview");
const AT = {
  cold: [1.5, 5.4, 7.6],
  problem: [3, 10.5],
  title: [3.8],
  talk: [3.7, 12, 21],
  settles: [1.4, 6.5, 13.5, 16.5],
  memory: [5, 16.5, 28, 36],
  channels: [5, 9, 15],
  ask: [7.5],
  hood: [8],
  end: [5],
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(AT);
mkdirSync(OUT, { recursive: true });
const serveUrl = await bundle({ entryPoint: join(ROOT, "src/index.ts") });
for (const id of wanted) {
  const composition = await selectComposition({ serveUrl, id: `scene-${id}` });
  for (const sec of AT[id]) {
    const output = join(OUT, `${id}-${sec}.png`);
    await renderStill({ composition, serveUrl, output, frame: Math.min(composition.durationInFrames - 1, Math.round(sec * 30)), scale: 0.5 });
    console.log(output);
  }
}
