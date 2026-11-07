"use client";

import { useEffect } from "react";

/** How long the opening runs, in ms; it matches the last keyframes in globals.css. */
const LENGTH = 4400;

/** Ends the opening when it's over, or at once on a click, a tap, Escape or "Skip". */
export function IntroControl() {
  useEffect(() => {
    const el = document.getElementById("mk-intro");
    if (!el || el.dataset.done) return;
    const end = () => {
      if (el.dataset.done) return;
      // A skip fades out quickly; the natural end has already faded.
      el.dataset.skipping = "1";
      window.setTimeout(() => (el.dataset.done = "1"), 220);
      cleanup();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    const timer = window.setTimeout(() => (el.dataset.done = "1"), LENGTH);
    el.addEventListener("click", end);
    window.addEventListener("keydown", onKey);
    function cleanup() {
      window.clearTimeout(timer);
      el!.removeEventListener("click", end);
      window.removeEventListener("keydown", onKey);
    }
    return cleanup;
  }, []);
  return null;
}
