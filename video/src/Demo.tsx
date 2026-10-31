import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { fade } from "@remotion/transitions/fade";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig, type CalculateMetadataFunction } from "remotion";
import { ColdOpen, Problem, Title } from "./scenes/open";
import { JustTalk, Settles } from "./scenes/talk";
import { Memory } from "./scenes/memory";
import { Ask, Channels, End, Hood } from "./scenes/close";
import { FPS, s } from "./theme";

/** The film, scene by scene, with the voice clip each one carries (public/audio/<vo>.mp3). */
export const SCENES = [
  { id: "cold", vo: "vo_00_cold_open", length: s(9), voAt: s(6.3), Scene: ColdOpen },
  { id: "problem", vo: "vo_01_problem", length: s(8.5), voAt: s(0.4), Scene: Problem },
  { id: "title", vo: "vo_02_title", length: s(6), voAt: s(1.2), Scene: Title },
  { id: "talk", vo: "vo_03_just_talk", length: s(21.5), voAt: s(0.6), Scene: JustTalk },
  { id: "settles", vo: "vo_04_settles", length: s(13), voAt: s(0.4), Scene: Settles },
  { id: "memory", vo: "vo_05_memory", length: s(29), voAt: s(0.4), Scene: Memory },
  { id: "channels", vo: "vo_06_channels", length: s(13.5), voAt: s(0.4), Scene: Channels },
  { id: "ask", vo: "vo_07_ask", length: s(8), voAt: s(0.6), Scene: Ask },
  { id: "hood", vo: "vo_08_under_the_hood", length: s(12), voAt: s(0.6), Scene: Hood },
  { id: "end", vo: "vo_09_end", length: s(9), voAt: s(2.2), Scene: End },
] as const;

const CROSSFADE = 12;

export type DemoProps = {
  /** Frames per scene, after making room for its voice clip. */
  lengths: number[];
  /** Which voice clips and music exist in public/audio. */
  voices: boolean[];
  music: boolean;
};

export const defaultDemoProps: DemoProps = { lengths: SCENES.map((x) => x.length), voices: SCENES.map(() => false), music: false };

const exists = (file: string) =>
  fetch(staticFile(file), { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false);

/** Each scene runs at least its designed length, and long enough for its voice clip with a breath after. */
export const calculateDemoMetadata: CalculateMetadataFunction<DemoProps> = async () => {
  const voices = await Promise.all(SCENES.map((x) => exists(`audio/${x.vo}.mp3`)));
  const lengths = await Promise.all(
    SCENES.map(async (x, i) => {
      if (!voices[i]) return x.length;
      const seconds = await getAudioDurationInSeconds(staticFile(`audio/${x.vo}.mp3`)).catch(() => 0);
      return Math.max(x.length, x.voAt + Math.ceil((seconds + 0.8) * FPS));
    }),
  );
  const music = await exists("audio/music.mp3");
  const total = lengths.reduce((a, b) => a + b, 0) - CROSSFADE * (SCENES.length - 1);
  return { durationInFrames: total, props: { lengths, voices, music } };
};

export function Demo({ lengths, voices, music }: DemoProps) {
  const { durationInFrames } = useVideoConfig();
  // Where each scene starts once the crossfades overlap them, for placing its voice clip.
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0) - CROSSFADE * i);
  return (
    <AbsoluteFill style={{ background: "#06080d" }}>
      <TransitionSeries>
        {SCENES.flatMap(({ id, Scene }, i) => [
          <TransitionSeries.Sequence key={id} durationInFrames={lengths[i]}>
            <Scene />
          </TransitionSeries.Sequence>,
          ...(i < SCENES.length - 1 ? [<TransitionSeries.Transition key={`${id}-x`} presentation={fade()} timing={linearTiming({ durationInFrames: CROSSFADE })} />] : []),
        ])}
      </TransitionSeries>

      {SCENES.map((x, i) =>
        voices[i] ? (
          <Sequence key={x.vo} from={starts[i] + x.voAt} name={x.vo}>
            <Audio src={staticFile(`audio/${x.vo}.mp3`)} />
          </Sequence>
        ) : null,
      )}

      {music && (
        <Audio
          src={staticFile("audio/music.mp3")}
          // Under the voice, up a little where there's none, and out at the end.
          volume={(f) => interpolate(f, [0, 30, durationInFrames - 90, durationInFrames], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
    </AbsoluteFill>
  );
}
