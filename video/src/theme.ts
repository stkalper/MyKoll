import { loadFont as caveat } from "@remotion/google-fonts/Caveat";
import { loadFont as plexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as manrope } from "@remotion/google-fonts/Manrope";
import { loadFont as montserrat } from "@remotion/google-fonts/Montserrat";

/** The site's tokens (src/app/globals.css), so the video looks like the product. */
export const C = {
  bg: "#0b0e15",
  bgDeep: "#06080d",
  text: "#eceae4",
  muted: "#8c93a3",
  line: "rgba(255,255,255,0.1)",
  paper: "#f1ede3",
  paperShade: "#e6e0d2",
  folder: "#c99d62",
  ink: "#1d2433",
  inkMuted: "#5d6475",
  rule: "#b9b2a2",
  outline: "#151515",
  hl: "#8fe3a6",
  hlPink: "#f4a7c8",
  win: "#1f7a45",
  loss: "#b8352a",
  open: "#3d4a63",
  // Telegram's dark theme, for the chat.
  tgBg: "#0e1621",
  tgIn: "#182533",
  tgOut: "#2b5278",
  tgText: "#f5f5f5",
  tgMeta: "#6d7f8f",
  tgButton: "rgba(255,255,255,0.08)",
  tgLink: "#6ab3f3",
};

const subsets: ("latin" | "cyrillic")[] = ["latin", "cyrillic"];
export const F = {
  form: montserrat("normal", { weights: ["600", "700", "800"], subsets }).fontFamily,
  sans: manrope("normal", { weights: ["400", "500", "600", "700"], subsets }).fontFamily,
  mono: plexMono("normal", { weights: ["400", "500", "600"], subsets }).fontFamily,
  hand: caveat("normal", { weights: ["500", "700"], subsets }).fontFamily,
};

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);
