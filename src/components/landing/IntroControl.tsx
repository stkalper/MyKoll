"use client";

import { useEffect } from "react";

/** A backstop, in ms after the page's scripts run, in case the closing fade never reports its end. */
const LONGEST = 6000;

/**
 * Takes the opening away once its CSS has faded it out, or at once on a click, a tap, Escape or
 * "Skip". The end is read from the animation itself rather than timed from here, because the
 * animation starts with the first paint and this only runs once the page's scripts load.
 */
export function IntroControl() {
  useEffect(() => {
    const el = document.getElementById("mk-intro");
    if (!el || el.dataset.done) return;
    const done = () => (el.dataset.done = "1");
    const skip = () => {
      if (el.dataset.done) return;
      el.dataset.skipping = "1";
      window.setTimeout(done, 220);
      cleanup();
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el && e.animationName === "intro-fade") {
        done();
        cleanup();
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    const backstop = window.setTimeout(done, LONGEST);
    el.addEventListener("animationend", onEnd);
    el.addEventListener("click", skip);
    window.addEventListener("keydown", onKey);
    function cleanup() {
      window.clearTimeout(backstop);
      el!.removeEventListener("animationend", onEnd);
      el!.removeEventListener("click", skip);
      window.removeEventListener("keydown", onKey);
    }
    // Already over by the time the scripts ran.
    if (el.getAnimations().some((a) => (a as CSSAnimation).animationName === "intro-fade" && a.playState === "finished")) done();
    return cleanup;
  }, []);
  return null;
}
