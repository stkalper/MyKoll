import { IntroControl } from "./IntroControl";

/**
 * "MyKoll" as one signature stroke, the way a pen writes it without lifting: M, y with its loop,
 * K, o and the two looped l's. The pen's nib follows this same line while the ink is drawn.
 */
const SIGNATURE =
  "M148 222 C156 190 162 140 170 112 C178 135 190 170 197 190 C205 165 218 132 230 112 C228 150 226 190 228 214 " +
  "C232 220 246 198 252 172 C250 190 254 212 268 214 C282 216 288 190 291 172 C290 205 285 250 272 282 " +
  "C264 300 242 300 248 280 C254 262 290 250 318 238 C330 200 336 150 340 110 C336 150 330 190 326 222 " +
  "C334 190 360 140 378 118 C362 138 344 158 334 172 C346 186 358 206 372 220 C384 222 396 196 410 174 " +
  "C392 172 384 204 396 216 C408 226 428 210 424 188 C422 176 412 172 406 176 C422 186 438 184 448 170 " +
  "C462 145 474 112 462 106 C452 102 444 140 444 178 C444 205 450 220 462 218 C474 216 486 190 494 165 " +
  "C504 138 512 112 500 106 C490 102 482 140 482 180 C482 205 488 220 500 218 C510 216 520 208 528 200";

/** When the pen moves (seconds from the first paint); the blot and the push are timed in globals.css. */
const T = { land: 0.5, toStart: 1.15, write: 1.45, writing: 1.7, away: 3.2 };
/** Handwriting pace: a slow start, steady letters, a slow finish. Ink and nib share it, so they stay together. */
const PACE = "0.35 0 0.65 1";

/**
 * The landing's opening, once a session: the pen from the page comes down in the middle of the
 * screen, ink spills from its nib into a blot, the pen writes "MyKoll" into the blot, and the
 * view pushes through the word into the site.
 *
 * The blot and the push are CSS; the pen and the writing are SVG animations on one clock, so the
 * nib stays on the end of the ink. All of it starts with the first paint, before any JavaScript.
 * The script after it hides it before that paint for anyone who has seen it this session or asks
 * for reduced motion; IntroControl handles skipping and takes it away at the end.
 */
export function Intro() {
  return (
    <>
      <div id="mk-intro" className="intro" suppressHydrationWarning>
        <div className="intro-stage" aria-hidden="true">
          <svg className="intro-blot" viewBox="0 0 600 360">
            <defs>
              {/* Blurs the drops together and sharpens the edge again: wet, merging ink. */}
              <filter id="intro-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
                <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
              </filter>
            </defs>
            <g filter="url(#intro-goo)" fill="#2c4fb5">
              <circle className="intro-drop d0" cx="300" cy="180" r="118" />
              <circle className="intro-drop d1" cx="205" cy="192" r="96" />
              <circle className="intro-drop d2" cx="398" cy="174" r="100" />
              <circle className="intro-drop d3" cx="132" cy="168" r="60" />
              <circle className="intro-drop d4" cx="470" cy="198" r="64" />
              <circle className="intro-drop d5" cx="250" cy="106" r="54" />
              <circle className="intro-drop d6" cx="352" cy="256" r="58" />
              <circle className="intro-drop d7" cx="80" cy="214" r="16" />
              <circle className="intro-drop d8" cx="532" cy="136" r="14" />
              <circle className="intro-drop d9" cx="420" cy="74" r="11" />
              <circle className="intro-drop d10" cx="172" cy="296" r="12" />
            </g>
            {/* Splatter thrown clear of the blot, and the wet shine on it. */}
            <g fill="#2c4fb5">
              <circle className="intro-drop s0" cx="36" cy="120" r="7" />
              <circle className="intro-drop s1" cx="570" cy="252" r="9" />
              <circle className="intro-drop s2" cx="498" cy="40" r="5" />
              <circle className="intro-drop s3" cx="106" cy="322" r="6" />
              <circle className="intro-drop s4" cx="300" cy="18" r="4" />
              <circle className="intro-drop s5" cx="588" cy="94" r="4" />
              <g transform="rotate(25 66 262)">
                <ellipse className="intro-drop s6" cx="66" cy="262" rx="12" ry="4" />
              </g>
              <g transform="rotate(-30 544 302)">
                <ellipse className="intro-drop s7" cx="544" cy="302" rx="14" ry="4" />
              </g>
            </g>
            <ellipse className="intro-shine" cx="245" cy="116" rx="70" ry="16" fill="#ffffff" transform="rotate(-8 245 116)" />

            {/* The signature is centred on the blot; the pen moves in the same space. */}
            <g transform="translate(-38 -18)">
              <path
                id="intro-ink"
                d={SIGNATURE}
                pathLength={1}
                fill="none"
                stroke="#f1ede3"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1 1"
                strokeDashoffset="1"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="1"
                  to="0"
                  begin={`${T.write}s`}
                  dur={`${T.writing}s`}
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines={PACE}
                  fill="freeze"
                />
              </path>

              <g className="intro-pen" opacity="0">
                <animate attributeName="opacity" values="0;1" begin="0s" dur="0.3s" fill="freeze" />
                <animate attributeName="opacity" values="1;0" begin={`${T.away + 0.1}s`} dur="0.3s" fill="freeze" />
                {/* Down to the middle of the page, where the ink spills; then to where the word starts. */}
                <animateMotion path="M338 -60 L338 198" begin="0s" dur={`${T.land}s`} calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.2 0.7 0.3 1" fill="freeze" />
                <animateMotion path="M338 198 C300 170 200 200 148 222" begin={`${T.toStart}s`} dur={`${T.write - T.toStart}s`} calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.4 0 0.6 1" fill="freeze" />
                <animateMotion begin={`${T.write}s`} dur={`${T.writing}s`} calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines={PACE} fill="freeze">
                  <mpath href="#intro-ink" />
                </animateMotion>
                <animateMotion path="M528 200 C560 160 600 80 660 0" begin={`${T.away}s`} dur="0.4s" calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.5 0 0.8 0.4" fill="freeze" />
                {/* The pen, nib at the origin, leaning the way a right hand holds it. */}
                <g transform="rotate(26) scale(1.25) translate(-17 -118)">
                  <rect x="10" y="2" width="14" height="12" rx="4" fill="#1d2433" stroke="#151515" strokeWidth="2" />
                  <rect x="8" y="10" width="18" height="72" rx="5" fill="#1d2433" stroke="#151515" strokeWidth="2" />
                  <rect x="11" y="16" width="4" height="56" rx="2" fill="#ffffff" opacity="0.18" />
                  <rect x="8" y="30" width="18" height="5" fill="#d9b25c" stroke="#151515" strokeWidth="1.5" />
                  <path d="M25 14 Q29 14 29 18 L29 50 L25 50" fill="none" stroke="#d9b25c" strokeWidth="3" strokeLinecap="round" />
                  <rect x="9" y="80" width="16" height="16" rx="2" fill="#2b3550" stroke="#151515" strokeWidth="2" />
                  <path d="M10 96 L24 96 L17 118 Z" fill="#d9b25c" stroke="#151515" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M17 100 L17 112" stroke="#151515" strokeWidth="1.5" />
                </g>
              </g>
            </g>
          </svg>
        </div>
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
