# MyKoll demo video

The demo film, made with [Remotion](https://www.remotion.dev): every scene is a React component, rendered frame by frame to MP4. It lives apart from the app (its own `package.json`, ignored by the app's typecheck, lint and Vercel deploy).

```bash
cd video
npm install
npx remotion browser ensure      # headless Chrome for rendering, once
npm run studio                   # scrub through it in the browser
npm run render                   # out/mykoll-demo.mp4 (1920×1080, 30 fps)
node scripts/preview.mjs talk    # a few PNG frames of one scene, quicker than a render
```

## Scenes

`src/Demo.tsx` lists them in order: cold open, the problem, title, *just talk*, *it settles itself*, *memory*, *channels too*, *ask*, *under the hood*, end card. Each has a designed length and stretches to fit its voice clip.

## Sound

Put the voice clips in `public/audio/`, named as in `SCENES` (`vo_00_cold_open.mp3` … `vo_09_end.mp3`), and optionally `public/audio/music.mp3`. The render picks up whatever is there: each clip plays from its scene's `voAt`, the scene grows to fit it, and the music sits under the voice and fades out at the end.

## Footage

`scripts/stills.mjs` takes full-page screenshots of the live Mini App (and the landing page) into `public/captures/`. `scripts/capture.mjs` records pages as video through Chrome's screencast. Explorers like Suiscan turn headless browsers away, so the on-chain proof is best recorded on a phone. Phone recordings go in `public/footage/`. Audio, footage and captures stay out of git.
