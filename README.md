# riffs_wf_client_vue

Phone-first web client for the riff guessing game **Riff Rivals**. Vue 3 + TypeScript + Vite,
no other runtime libraries. Server: `../riffs_wf_server`. Goals and research: `mm_home/goals/riff_goals/`.

```bash
nvm use            # Node 22 (.nvmrc)
npm install
npm run dev        # http://localhost:5175/ ; /api is passed to the server on :9095
npm run build      # type-check + dist/
```
For a phone on the home network, open `http://<desktop-ip>:5175/`. The microphone ("Play it in") only works
on https or localhost, so test the mic on the deployed https site.

## What's where
- `components/StaffEditor.vue`: the "staff paper" (SVG treble staff). Tap to place or move notes. Modes:
  compose, guess (fixed slots, known notes locked green, feedback dots) and view.
- `components/RiffComposer.vue`: write a riff: lengths, rests, ▲▼, play back, live musical-sense score and reward,
  "Play it in" (microphone), "Famous tunes" (public-domain library).
- `components/RiffGuesser.vue`: play the hidden riff (as often as you like), guess, hints, extra strings.
- `components/GuitarStrings.vue`: guesses left, drawn as guitar strings that snap; `EncoreMeter.vue`: lives (🎤).
- `ts/synth.ts`: Web Audio instruments (piano, Karplus–Strong guitar, flute, organ, 8-bit, FM bells).
- `ts/pitch.ts`: microphone pitch detection (autocorrelation) and note segmentation.
- `ts/api.ts`: the server API and its types.
