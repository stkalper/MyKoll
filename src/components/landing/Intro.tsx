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

/** Seconds: squares pop in at random over this span, then pop out at random over the next. */
const IN = { from: 0.1, span: 1.5, steps: 30 };
const OUT = { from: 2.7, span: 0.35, steps: 8 };

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
const SQUARES = WORD.flatMap((row, y) =>
  [...row].flatMap((c, x) =>
    c === "#" ? [{ x, y, a: Math.floor(next() * IN.steps), b: Math.floor(next() * OUT.steps), accent: next() < 0.07 }] : [],
  ),
);

/** One class per delay, so 600 squares don't each carry a style. */
const DELAYS_CSS =
  Array.from({ length: IN.steps }, (_, i) => `.sq.a${i}{--a:${(IN.from + (i * IN.span) / IN.steps).toFixed(2)}s}`).join("") +
  Array.from({ length: OUT.steps }, (_, i) => `.sq.b${i}{--b:${(OUT.from + (i * OUT.span) / OUT.steps).toFixed(2)}s}`).join("");

/**
 * The landing's opening, once a session: "MyKoll" builds itself out of small squares that pop in
 * at random, seen from close up, while the view pulls back until the whole word shows; then the
 * squares pop out and the page is there.
 *
 * All of it is CSS, so it starts with the first paint, before any JavaScript. The script after it
 * hides it before that paint for anyone who has seen it this session or asks for reduced motion;
 * IntroControl handles skipping and takes it away when its fade ends.
 */
export function Intro() {
  return (
    <>
      <div id="mk-intro" className="intro" suppressHydrationWarning>
        <div className="intro-stage" aria-hidden="true">
          <svg className="intro-word" viewBox={`-1 -1 ${COLS + 2} ${ROWS + 2}`}>
            {SQUARES.map((s) => (
              <rect key={`${s.x}-${s.y}`} className={`sq a${s.a} b${s.b}${s.accent ? " hl" : ""}`} x={s.x + 0.08} y={s.y + 0.08} width="0.84" height="0.84" rx="0.14" />
            ))}
          </svg>
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
