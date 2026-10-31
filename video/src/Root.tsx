import { Composition, Folder } from "remotion";
import { calculateDemoMetadata, defaultDemoProps, Demo, SCENES } from "./Demo";
import { FPS } from "./theme";

export function Root() {
  return (
    <>
      <Composition
        id="Demo"
        component={Demo}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={defaultDemoProps.lengths.reduce((a, b) => a + b, 0)}
        defaultProps={defaultDemoProps}
        calculateMetadata={calculateDemoMetadata}
      />
      {/* Each scene on its own, for working on one at a time. */}
      <Folder name="Scenes">
        {SCENES.map(({ id, Scene, length }) => (
          <Composition key={id} id={`scene-${id}`} component={Scene} width={1920} height={1080} fps={FPS} durationInFrames={length} />
        ))}
      </Folder>
    </>
  );
}
