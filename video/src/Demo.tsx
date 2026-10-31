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
  /** How long each voice clip runs, in frames (0 without one), so the music can duck under it. */
  voiceFrames: number[];
  music: boolean;
};

export const defaultDemoProps: DemoProps = {
  lengths: SCENES.map((x) => x.length),
  voices: SCENES.map(() => false),
  voiceFrames: SCENES.map(() => 0),
  music: false,
};

/** Music level under the voice, and where nobody is speaking. */
const MUSIC_UNDER = 0.12;
const MUSIC_ALONE = 0.32;
/** Frames the music takes to dip before the voice and come back after it. */
const DUCK = 12;

const exists = (file: string) =>
  fetch(staticFile(file), { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false);

/** Each scene runs at least its designed length, and long enough for its voice clip with a breath after. */
export const calculateDemoMetadata: CalculateMetadataFunction<DemoProps> = async () => {
  const voices = await Promise.all(SCENES.map((x) => exists(`audio/${x.vo}.mp3`)));
  const voiceFrames = await Promise.all(
    SCENES.map(async (x, i) =>
      voices[i] ? Math.ceil(((await getAudioDurationInSeconds(staticFile(`audio/${x.vo}.mp3`)).catch(() => 0)) || 0) * FPS) : 0,
    ),
  );
  const lengths = SCENES.map((x, i) => (voices[i] ? Math.max(x.length, x.voAt + voiceFrames[i] + Math.ceil(0.8 * FPS)) : x.length));
  const music = await exists("audio/music.mp3");
  const total = lengths.reduce((a, b) => a + b, 0) - CROSSFADE * (SCENES.length - 1);
  return { durationInFrames: total, props: { lengths, voices, voiceFrames, music } };
};

export function Demo({ lengths, voices, voiceFrames, music }: DemoProps) {
  const { durationInFrames } = useVideoConfig();
  // Where each scene starts once the crossfades overlap them, for placing its voice clip.
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0) - CROSSFADE * i);
  const speaking = SCENES.map((x, i) => [starts[i] + x.voAt, starts[i] + x.voAt + voiceFrames[i]] as const).filter((_, i) => voices[i]);

  /** The music dips under each voice clip and rises in the gaps, fading in at the start and out at the end. */
  const musicVolume = (f: number) => {
    const duck = Math.max(
      0,
      ...speaking.map(([from, to]) =>
        interpolate(f, [from - DUCK, from, to, to + DUCK], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      ),
    );
    const level = MUSIC_ALONE + (MUSIC_UNDER - MUSIC_ALONE) * duck;
    const edges = interpolate(f, [0, 20, durationInFrames - 75, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return level * edges;
  };
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
          volume={musicVolume}
        />
      )}
    </AbsoluteFill>
  );
}
