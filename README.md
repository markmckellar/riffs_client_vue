# 🎸 Riff Rivals

**Hangman for your ears. One player writes a short riff, the other hears it and has to write it down. Every wrong
guess snaps a guitar string.**

Play it on your phone: **https://riffs.mckcode.com/** (sign in as a guest, then challenge a friend or one of 15 bots).

This repo is the web client (Vue 3 + TypeScript), and it does most of the work. The server is
[riffs_server](https://github.com/markmckellar/riffs_server).

## How a round goes

1. **Write a riff.** Four to eight notes, plus up to two rests. Tap them onto staff paper, play them on piano keys or a
   guitar or bass fretboard, or play them into the phone's microphone and let it write them down for you.
2. **Send it.** Your opponent hears the riff as often as they like, but can't see it.
3. **Guess.** They write down what they hear. Each note comes back marked: **exact**, **right note in the wrong
   octave**, **close** (with an arrow for higher or lower), or **miss**. Notes you get right stay locked in green.
4. **Snap!** Each player has a guitar with 6 strings for the whole game. Every wrong guess breaks one, with a crack
   and a twang. Lose your last string and you lose the game.
5. Then you swap: the listener writes the next riff.

Write a riff that sounds musical (it fits a key, it moves mostly by steps, it ends somewhere that sounds like an
ending) and you earn points and tokens: 💡 **Hints** that reveal a note, and 🎸 **Extra Strings** that put a broken
string back.

## Why I built it

I had the idea a few years ago, and planned out what I wanted it to do. Part of it was just that it sounded fun.
The bigger reason was **ear training**. I wanted to get better at *hearing* notes: picking a song out by ear, or
getting a tune that's stuck in my head out onto an instrument. A game against friends seemed like a better way to
practice that than drills on my own.

So the game has a 🎓 **Learner mode**, built on how ear training is usually taught:

- **Shape before notes.** People remember a melody's ups and downs before its exact intervals, so arrows show the
  riff's shape.
- **Anchor on a known note.** The first note is always given, and every note you get right becomes a new anchor.
- **Narrow the choices.** Green bars on the staff show where the note you're working on can still be, worked out
  from your earlier guesses.
- **Don't let anyone drown.** A free note after every two wrong guesses.
- **Fade the help.** Learners earn half points, so there's a reason to turn it off as your ear improves.

## Second time around: a thin server

My first version, back then, did a lot of the game on the server. It never made it into git, and none of it is used
here; this is a fresh start. When I wrote the plan for this one, the line I cared about most was *"hopefully all
the server will need to do is send notes."*

That's close to how it turned out. The phone makes the music:

| On the phone (this repo) | On the server |
| --- | --- |
| Instruments made with Web Audio: piano, Karplus–Strong plucked guitar and bass, flute, organ, 8-bit, FM bells | Players, sign-in, games and turns |
| Staff paper drawn in SVG, piano keys, guitar and bass fretboards | Checking guesses, points and tokens |
| Microphone pitch detection (autocorrelation) that turns playing into notes | 15 bots in three levels |
| Moving a riff into the range of the instrument you picked | A score for how musical a riff is |
| The guitar that snaps, and its sound | A small library of public-domain tunes the bots write riffs from |

A riff travels as a short list of numbers (MIDI pitches), and the server keeps everything in plain JSON files, so it
runs happily on the smallest cloud server I could rent.

## The hard part: instruments don't agree

Letting people enter notes on the instrument they know sounded simple. It wasn't, because **instruments don't cover
the same notes**:

- I first made the guitar's first five frets (E3 to A5) the game's range. A mandolin starts at G3, so it couldn't
  play the lowest three notes, and I dropped it while I worked out what to do.
- A piano keyboard covering that whole range fit on a phone only with keys about 16 px wide: too small to tap with
  confidence. Twelve white keys (C4 to G5) are comfortable, but cover less than the guitar does.
- A bass sits lower than a guitar. To cover the guitar's notes it needed 15 frets, far too narrow to tap.

What fixed it:

1. **Smaller fretboards.** Guitar and bass show frets 0–4 only, so each fret is big enough for a thumb.
2. **A limit on how wide a riff can be.** A riff can span at most 19 half steps, so it always fits on the smallest
   instrument.
3. **Move the riff, not the player.** When you pick an instrument, the riff on screen moves to fit it: not at all if
   it already fits, else by whole octaves (so it's still the same tune), else by the fewest half steps. Your guesses
   are moved back before they're sent, so both players are always talking about the same notes.

Adding a mandolin is now one line (its open strings and how many frets) plus a sound. The whole back-and-forth is in
the commit history.

## Built with

Vue 3, TypeScript and Vite, with no other runtime libraries. The server is Spring Boot (Java 17) with JSON files. The
live site runs on a small Linode behind Caddy (HTTPS), with a one-command deploy.

Made with a lot of help from **[Claude Code](https://claude.com/claude-code)**. I wrote the plan and play-tested on
my phone; Claude did much of the research (music structure, ear training, pitch detection, public-domain tunes) and
a lot of the typing, and we went back and forth on everything. Most of the commits are small changes that came from
me playing the game and saying "that's awkward".

And thanks to a friend who gave me a leg up when I was getting started. You know who you are.

## Run it yourself

Start the server first ([riffs_server](https://github.com/markmckellar/riffs_server): `./run_dev.bash`), then:

```bash
nvm use            # Node 22 (.nvmrc)
npm install
npm run dev        # http://localhost:5175/ ; /api is passed on to the server on :9095
npm run build      # type-check, then dist/
```

To try it on a phone on the same network, open `http://<your-computer's-ip>:5175/`. The microphone only works on
https or localhost, so try "Play it in" on an https site.

The game's name is `VITE_GAME_NAME` in `.env`; the server's `riffs.game-name` setting replaces it once the page loads.

## What's where

- `components/StaffEditor.vue`: the staff paper (SVG treble staff) for writing, guessing (locked green notes,
  feedback dots, question marks) and viewing.
- `components/RiffComposer.vue`: writing a riff. `components/RiffGuesser.vue`: hearing and guessing one, Learner
  mode, hints and extra strings.
- `components/NoteKeys.vue`, `components/Fretboard.vue`: piano keys and fretboards for entering notes.
- `components/HomeView.vue`: new game, challenges, your games, who's online, past opponents, find a player.
- `components/GuitarStrings.vue`: the guitar whose strings snap.
- `ts/synth.ts`: the Web Audio instruments and the snap sound.
- `ts/instrument.ts`: each instrument's range, and moving a riff to fit it.
- `ts/pitch.ts`: microphone pitch detection, and splitting what it hears into notes.
- `ts/api.ts`: the server API and its types.

## Still to do

- Try "Play it in" with a real instrument on a phone. It's built, but hasn't met a real guitar yet.
- Google sign-in (guest sign-in for now), and push notifications when the page is closed.
- The listener's phone is sent the riff so it can play it, so someone could cheat with the browser's developer
  tools. Don't be that person.

## License

MIT. See [LICENSE](LICENSE).
