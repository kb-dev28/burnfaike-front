# Burn fAIke

A rumor-tracing engine. You submit a claim; the system researches it across
several rounds and returns a **provenance trail rather than a verdict**.

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
| §4 Dither — 8×8 Bayer, 1-bit, density as data | `src/lib/dither.js` |
| §5 Marker — highlight / strike / redaction | `src/components/Marker.jsx` |
| §6 Components | `src/components/` |
| §7 Motion — one orchestrated moment | `DitherCanvas.jsx` |
| §9 Accessibility floor | throughout; see below |

Notes on the parts that needed a decision:

- **The dither is genuinely 1-bit.** A grayscale field is built off-screen, then
  hard-thresholded through the Bayer matrix into exactly two colors and upscaled
  nearest-neighbour. Midtones exist only in the source buffer, never on screen.
- **Density is capped below 1 in the hero**, so the accent always reads as a
  screen and never becomes a large flat lime fill (§10).
- **The paranoia score sits in a solid ink slab** cutting into the band's left
  edge. Paper-on-signal would not clear 4.5:1, and the score must not depend on
  the dither underneath to be readable (§9).
- **The score is a consequence of the trail**, so the meter renders after the
  evidence board in reading order (§10).
- **Redactions are buttons.** They open on hover, on focus and on click, and the
  explanation is in the accessibility tree at all times, not only when revealed.
- **Three headline lines at every width.** The grouping changes under 520px so
  the headline never needs a fourth. Before Anton loads, a condensed system
  fallback stands in; on a device with no condensed face the headline can run
  long for that first paint.

## Structure

```
src/
├── lib/dither.js          # Bayer matrix, band and chronophotographic strip
├── data/trace.js          # sample trail (invented sources)
├── styles/
│   ├── tokens.css         # §1–§3, the whole palette and type scale
│   └── app.css            # layout and components
└── components/
    ├── Hero.jsx           ClaimBar.jsx      ResearchTrail.jsx
    ├── EvidenceBoard.jsx  ParanoiaMeter.jsx Synthesis.jsx
    ├── Marker.jsx         # the three annotation states
    └── DitherCanvas.jsx   # canvas wrappers, resize and motion handling
```

## Next

Wire the research engine behind `trace()` in `src/App.jsx`. It needs to return
the shape in `src/data/trace.js`: rounds with queries and the gap that triggered
the next round, evidence items with marker-annotated segments, a score, and a
synthesis with citations.
