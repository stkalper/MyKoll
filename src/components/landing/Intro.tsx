import { IntroControl } from "./IntroControl";

/**
 * The landing's opening, once a session: the pen from the page stands in the middle of the
 * screen, a blot of ink spills from its nib, "MyKoll" is written into the blot, and the view
 * pushes through the word into the site.
 *
 * It's all CSS, so it starts with the first paint, before any JavaScript. The script right after
 * it hides it before that paint for anyone who has seen it this session or asks for reduced
 * motion; IntroControl handles skipping and takes it away at the end.
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
              <circle className="intro-drop d0" cx="300" cy="180" r="112" />
              <circle className="intro-drop d1" cx="210" cy="190" r="92" />
              <circle className="intro-drop d2" cx="392" cy="172" r="96" />
              <circle className="intro-drop d3" cx="140" cy="168" r="58" />
              <circle className="intro-drop d4" cx="462" cy="196" r="62" />
              <circle className="intro-drop d5" cx="250" cy="110" r="52" />
              <circle className="intro-drop d6" cx="350" cy="252" r="56" />
              <circle className="intro-drop d7" cx="86" cy="214" r="16" />
              <circle className="intro-drop d8" cx="526" cy="138" r="14" />
              <circle className="intro-drop d9" cx="418" cy="78" r="11" />
              <circle className="intro-drop d10" cx="176" cy="292" r="12" />
            </g>
            {/* Splatter thrown clear of the blot, and the wet shine on it. */}
            <g fill="#2c4fb5">
              <circle className="intro-drop s0" cx="40" cy="120" r="7" />
              <circle className="intro-drop s1" cx="565" cy="250" r="9" />
              <circle className="intro-drop s2" cx="495" cy="44" r="5" />
              <circle className="intro-drop s3" cx="110" cy="320" r="6" />
              <circle className="intro-drop s4" cx="300" cy="22" r="4" />
              <circle className="intro-drop s5" cx="585" cy="96" r="4" />
              <g transform="rotate(25 70 262)">
                <ellipse className="intro-drop s6" cx="70" cy="262" rx="12" ry="4" />
              </g>
              <g transform="rotate(-30 540 300)">
                <ellipse className="intro-drop s7" cx="540" cy="300" rx="14" ry="4" />
              </g>
            </g>
            <ellipse className="intro-shine" cx="250" cy="120" rx="70" ry="18" fill="#ffffff" transform="rotate(-8 250 120)" />
          </svg>
          <span className="intro-word">MyKoll</span>
          <svg className="intro-pen" width="34" height="120" viewBox="0 0 34 120">
            <rect x="10" y="2" width="14" height="12" rx="4" fill="#1d2433" stroke="#151515" strokeWidth="2" />
            <rect x="8" y="10" width="18" height="72" rx="5" fill="#1d2433" stroke="#151515" strokeWidth="2" />
            <rect x="11" y="16" width="4" height="56" rx="2" fill="#ffffff" opacity="0.18" />
            <rect x="8" y="30" width="18" height="5" fill="#d9b25c" stroke="#151515" strokeWidth="1.5" />
            <path d="M25 14 Q29 14 29 18 L29 50 L25 50" fill="none" stroke="#d9b25c" strokeWidth="3" strokeLinecap="round" />
            <rect x="9" y="80" width="16" height="16" rx="2" fill="#2b3550" stroke="#151515" strokeWidth="2" />
            <path d="M10 96 L24 96 L17 118 Z" fill="#d9b25c" stroke="#151515" strokeWidth="2" strokeLinejoin="round" />
            <path d="M17 100 L17 112" stroke="#151515" strokeWidth="1.5" />
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
