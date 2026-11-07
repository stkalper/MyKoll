import { IntroControl } from "./IntroControl";

/**
 * "MyKoll" in the logo's face (Montserrat ExtraBold), rasterised to a grid: each # is one square.
 * Made once from the font on a canvas, so the page doesn't have to.
 */
const WORD = [
  "..............................................................####...####",
  "####..........###................####......####...............####...####",
  "####.........####................####.....####................####...####",
  "#####.......#####................####....####.................####...####",
  "######......#####..###......####.####...####........####......####...####",
  "######.....######..####.....###..####..####.......########....####...####",
  "#######....######..####....####..##########......##########...####...####",
  "########..#######...####...####..#########......#####..#####..####...####",
  "########.########...####...###...#########......####....####..####...####",
  "####.#######.####....####.####...##########.....####....####..####...####",
  "####.#######.####....####.###....###########....####....####..####...####",
  "####..#####..####.....#######....#####..#####...####....####..####...####",
  "####...####..####.....#######....####....####...#####..#####..####...####",
  "####...###...####.....######.....####....#####...##########...####...####",
  "####.........####......#####.....####.....#####...########....####...####",
  "####..........###......####......####......####.....#####......###...####",
  "....................#..####..............................................",
  "...................#######...............................................",
  "...................#######...............................................",
  "....................####.................................................",
];
const COLS = WORD[0].length;
const ROWS = WORD.length;

/**
 * Timing, in seconds. A first handful of squares pops in one by one in random order, close up
 * (like motion.dev's random stagger); then the rest of the word unfolds outward from them while
 * the view pulls back; then they all pop out.
 */
const SEED = { count: 26, from: 0.15, step: 0.045 };
const UNFOLD = { from: 1.3, span: 1.1, jitter: 0.14 };
const OUT = { from: 3.25, span: 0.35 };

/** A fixed random sequence, so the page is the same on every build and render. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const next = random(7);
const cells = WORD.flatMap((row, y) => [...row].flatMap((c, x) => (c === "#" ? [{ x, y }] : [])));
/** The middle of the word, where the first squares appear and the view starts. */
const MID = { x: COLS / 2, y: ROWS * 0.42 };
const away = (c: { x: number; y: number }) => Math.hypot(c.x - MID.x, (c.y - MID.y) * 1.2);
const byDistance = [...cells].sort((a, b) => away(a) - away(b));
const farthest = away(byDistance[byDistance.length - 1]);
const seedOrder = Array.from({ length: SEED.count }, (_, i) => i).sort(() => next() - 0.5);
/** A delay rounded to a 50th of a second, so they share a few dozen classes. */
const tick = (sec: number) => Math.round(sec * 50);

const SQUARES = byDistance.map((c, i) => ({
  ...c,
  a: tick(i < SEED.count ? SEED.from + seedOrder[i] * SEED.step : UNFOLD.from + (away(c) / farthest) * UNFOLD.span + next() * UNFOLD.jitter),
  b: tick(OUT.from + next() * OUT.span),
  accent: next() < 0.07,
}));

/** One class per delay, so 600 squares don't each carry a style. */
const DELAYS_CSS =
  [...new Set(SQUARES.map((s) => s.a))].map((t) => `.sq.a${t}{--a:${t / 50}s}`).join("") +
  [...new Set(SQUARES.map((s) => s.b))].map((t) => `.sq.b${t}{--b:${t / 50}s}`).join("");

/** Where the view zooms from: the middle of the word, as a share of the stage. */
const ORIGIN = `${((MID.x / COLS) * 100).toFixed(1)}% ${((MID.y / ROWS) * 100).toFixed(1)}%`;

/**
 * The landing's opening, once a session: a few big squares pop in one by one, close up, in the
 * middle of "MyKoll"; then the rest of the word unfolds out of them in small squares while the view
 * pulls back until the whole word shows; then the squares pop out and the page is there.
 *
 * All of it is CSS on HTML elements, so it starts with the first paint and runs on the compositor,
 * unaffected by the page's own JavaScript. The script after it
 * hides it before that paint for anyone who has seen it this session or asks for reduced motion;
 * IntroControl handles skipping and takes it away when its fade ends.
 */
export function Intro() {
  return (
    <>
      <div id="mk-intro" className="intro" suppressHydrationWarning>
        <div className="intro-stage" aria-hidden="true" style={{ transformOrigin: ORIGIN }}>
          {/* HTML, not SVG: transform and opacity on HTML elements run on the compositor, so the squares keep
              moving while the page's scripts load and hydrate. */}
          <div className="intro-word" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, aspectRatio: `${COLS} / ${ROWS}` }}>
            {SQUARES.map((s) => (
              <i key={`${s.x}-${s.y}`} className={`sq a${s.a} b${s.b}${s.accent ? " hl" : ""}`} style={{ gridArea: `${s.y + 1} / ${s.x + 1}` }} />
            ))}
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: DELAYS_CSS }} />
        <button id="mk-intro-skip" type="button" className="intro-skip">
          Skip ›
        </button>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("mk-intro")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.getElementById("mk-intro").dataset.done="1";else sessionStorage.setItem("mk-intro","1")}catch(e){}`,
        }}
      />
      <IntroControl />
    </>
  );
}
