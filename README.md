# Burn fAIke

An AI agent that traces rumors, built for trading desks. You submit a claim — or
your own agent calls it as a tool — and it researches across several rounds and
returns a **provenance trail rather than a verdict**.

Live: https://gauthierdewilliencourt.github.io/burnfaike-front/

This repository is the front end, built to `design-system.md` — that file is
normative, and the code references its sections in comments.

## What is real and what is not

The interface is complete. The research engine is not wired up: submitting a
claim runs the sample trail in `src/data/trace.js` against whatever you typed,
and the app says so on screen when the claim differs from the example.

Everything named in that sample — companies, accounts, publications, dates — is
invented, so nothing in this repository asserts anything about a real
organisation.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173/burnfaike-front/
npm run build      # writes docs/
npm run preview    # serves the built output
```

## Deploy

GitHub Pages is branch-based, no Actions workflow. `vite.config.js` sets
`base: '/burnfaike-front/'` and builds into `docs/`, which is committed. Settings →
Pages → Source: `main`, folder `/docs`.

Every deploy is `npm run build` then commit `docs/` and push. Renaming the repo
changes the public URL and breaks `base`.

## How the design system is implemented

| Spec | Where |
|---|---|
| §1 Color, §2 Type, §3 Geometry | `src/styles/tokens.css` |
| §4 Dither — 1-bit, density as data | `src/lib/dither.js`, `tools/footage-to-strip.mjs` |
| §5 Marker — highlight / strike / redaction | `src/components/Marker.jsx` |
| §6 Components | `src/components/` |
| §8 Copy — four result states, never a verdict | `AgentInterface.jsx`, `data/trace.js` |
| §7 Motion — one orchestrated moment | `DitherCanvas.jsx` |
| §9 Accessibility floor | throughout; see below |

Notes on the parts that needed a decision:

- **The dither is genuinely 1-bit.** A grayscale field is built off-screen, then
  hard-thresholded into exactly two colors and upscaled nearest-neighbour.
  Midtones exist only in the source buffer, never on screen.
- **Two dithers, for two jobs.** The hero uses Floyd–Steinberg error diffusion,
  which is what §4 specifies for imagery: it keeps the tonal structure of a
  photographic source at one bit. The paranoia meter uses the ordered 8×8 Bayer
  matrix, because there the density *is* the message and coverage has to track
  the score exactly.
- **The hero's highlights are pulled down by a curve**, not a clamp, so the
  brightest part of the footage still reads as a screen rather than a flat lime
  fill (§10) while keeping the shading inside it.
- **The paranoia score sits in a solid ink slab** cutting into the band's left
  edge. Paper-on-signal would not clear 4.5:1, and the score must not depend on
  the dither underneath to be readable (§9).
- **The score is a consequence of the trail**, so the meter renders after the
  evidence board in reading order (§10).
- **"Agent-compatible" is shown, not claimed.** The agent interface section
  renders the tool definition and a response payload derived from the sample
  trail itself, so the documented shape cannot drift from the data. It is always
  on the page, before anything has been traced.
- **Redactions are buttons.** They open on hover, on focus and on click, and the
  explanation is in the accessibility tree at all times, not only when revealed.
- **Three headline lines at every width.** The grouping changes under 520px so
  the headline never needs a fourth. Before Anton loads, a condensed system
  fallback stands in; on a device with no condensed face the headline can run
  long for that first paint.
- **The hero strip is in the layout flow**, not absolutely positioned. Content
  above it can then never push it past the fold, whatever the viewport height.

## The hero footage

The hero is a chronophotographic strip: the band is divided into cells, each
holding the same subject at a different moment of the loop, all advancing
together. The source is `source/eye.mp4`.

`tools/footage-to-strip.mjs` converts footage into `public/hero-strip.png`, a
grayscale sprite sheet, plus a manifest with the frame count and playback rate.
It takes a GIF, a video (needs ffmpeg on `PATH` or in `$FFMPEG` — `pip install
imageio-ffmpeg` is the easiest way to get one), or a directory of PNG frames.

```bash
node tools/footage-to-strip.mjs source/eye.mp4 --frames 16 --width 180 --fps 8
npm run build
```

It prints the written sheet's luminance range, which is what to check first if
the hero comes out flat or crushed: `--levels`, `--gamma` and `--invert` grade
it, `--pingpong` fixes footage that does not loop cleanly.

The sheet ships **grayscale, not dithered**. The 1-bit threshold happens at
runtime, because the loading state mixes static into the source field *before*
the error diffusion runs — pre-dithered frames would leave nothing to mix into.

To swap the footage: drop a file in `source/`, rerun the tool, rebuild. Keep it
short, high-contrast and loopable; anything with a clear silhouette survives the
reduction best.

## Structure

```
source/eye.mp4             # hero footage, kept so the conversion is repeatable
tools/
└── footage-to-strip.mjs   # footage -> grayscale sprite sheet + manifest
src/
├── lib/dither.js          # Bayer matrix, error diffusion, band and strip
├── data/trace.js          # sample trail (invented sources)
├── styles/
│   ├── tokens.css         # §1–§3, the whole palette and type scale
│   └── app.css            # layout and components
└── components/
    ├── Hero.jsx           ClaimBar.jsx      ResearchTrail.jsx
    ├── EvidenceBoard.jsx  ParanoiaMeter.jsx Synthesis.jsx
    ├── Marker.jsx         # the three annotation states
    └── DitherCanvas.jsx   # canvas wrappers, footage loading, motion handling
```

## Next

Wire the research engine behind `trace()` in `src/App.jsx`. It needs to return
the shape in `src/data/trace.js`: rounds with queries and the gap that triggered
the next round, evidence items with marker-annotated segments, a score, and a
synthesis with citations.
