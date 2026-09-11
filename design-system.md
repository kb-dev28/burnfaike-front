# Burn fAIke — Design System

Spec for implementation. Written to be handed to a coding agent as-is.
Everything below is normative. Where a rule says "never", it is a hard constraint.

---

## 0. What this product is

A rumor-tracing engine. The user submits a claim, the system researches the
web across several rounds, and returns a provenance trail rather than a verdict.

The visual identity must communicate three things, in this order:

1. The process is visible. Nothing is hidden behind a single AI answer.
2. It is an investigation instrument, not an oracle.
3. It is internet-native and has a sense of humour about the claims it traces.

Governing metaphor: **chronophotography**. Muybridge decomposed motion into
frames to see what actually happened. This product decomposes a rumor into
frames to see where it came from. Every visual device below descends from that.

---

## 1. Color

Three values. There is no fourth.

```css
--ink:    #0D0D0D;  /* page background, and fills on light surfaces */
--paper:  #EDEDE5;  /* primary text, borders, inverted surfaces */
--signal: #C6F031;  /* single accent: dither, highlight, active state */
```

Derived, for text hierarchy only:

```css
--paper-dim:  #8C8C85;  /* secondary text */
--paper-mute: #545450;  /* metadata, timestamps, token counts */
--rule:       #2A2A28;  /* hairline dividers on ink */
```

Rules:

- No gradients anywhere. No shadows. No blur. No glow.
- `--signal` is never used as a decorative fill for large areas. It appears as
  dither, as a highlight bar, as an active border, or as a 1px rule. Treat it as
  ink from a marker, not as paint.
- Never introduce green-means-true / red-means-false. There is no second hue.
  The product does not issue verdicts, so the palette must not be able to
  express one.
- A light surface exists only for the inverted result card. When inverted,
  `--paper` is the background and `--ink` is the text. The accent stays the same.

---

## 2. Type

Two families. Load from Google Fonts.

```css
--display: "Anton", "Arial Narrow", sans-serif;  /* 400 only */
--mono: "Space Mono", ui-monospace, monospace;   /* 400 and 700 */
```

If a licensed condensed grotesque is available (Druk Condensed, Vanguard CF,
Monument Extended), substitute it for Anton. Do not substitute anything else.

Scale:

| Role | Family | Size | Case | Tracking | Leading |
|---|---|---|---|---|---|
| Hero | display | clamp(56px, 9vw, 132px) | UPPERCASE | -0.02em | 0.88 |
| Section head | display | 40px | UPPERCASE | -0.01em | 0.95 |
| Claim under trace | mono 700 | 22px | sentence | 0 | 1.35 |
| Body / synthesis | mono 400 | 15px | sentence | 0 | 1.65 |
| Label / nav | mono 400 | 12px | UPPERCASE | 0.14em | 1 |
| Metadata | mono 400 | 11px | UPPERCASE | 0.1em | 1 |

Rules:

- Display type is a graphic element. It sets to the edge of its container, it
  wraps to multiple lines, and it is never centered in a narrow column.
- Body copy never exceeds 72 characters per line.
- Uppercase is reserved for display type and for the label/metadata tier. Body
  copy and claim text are always sentence case.
- Never accent a single word inside a headline with color or weight. The
  headline is one block.

---

## 3. Geometry and space

```css
--radius: 0;        /* everywhere, no exceptions */
--border: 2px solid var(--paper);
--hairline: 1px solid var(--rule);
```

Spacing scale, in px: `4 8 12 16 24 32 48 64 96 128`. Nothing between.

Layout is a 12-column grid, 24px gutter, 1440px max width, 32px page margin
(16px under 768px). Content is left-aligned by default. Centered text appears
nowhere except the hero headline.

---

## 4. The dither system

This is the signature device and the thing that must be executed well.

All imagery is reduced to two colors, `--ink` and `--signal`, using
Floyd–Steinberg error diffusion. No midtones, no anti-aliasing, no third value.

```bash
magick input.png \
  -colorspace Gray \
  -resize 900x \
  -dither FloydSteinberg \
  -remap <(magick -size 1x2 xc:'#0D0D0D' xc:'#C6F031' +append png:-) \
  output.png
```

For animated sources, extract frames, apply per frame, reassemble as a looping
GIF or WebP at 12fps. Low frame rates are correct. Smoothness is wrong here.

### Dither as data

Dither density encodes uncertainty. This replaces any color-coded score.

| Traceability | Pattern | Meaning |
|---|---|---|
| Well-sourced, single origin found | sparse, ~10% coverage | the image is nearly clear |
| Partial, some contradictions | ~40% coverage | the image is breaking up |
| Unsourced, mutated, contradictory | ~85% coverage, saturated noise | the image is nearly illegible |

Implement as a repeating 8x8 Bayer matrix rendered to canvas, with a single
`density` parameter from 0 to 1. The Paranoia Meter is this and nothing else:
a horizontal band whose noise density corresponds to the score, with the
numeric value set in display type beside it. Do not build a gauge, a needle,
an arc, or a colored progress bar.

---

## 5. The marker system

The second device, used on text rather than image.

- **Highlight**: a `--signal` block behind a run of text, no padding above or
  below, text switches to `--ink`. Marks a claim that the research supports.
  Rendered as `background: var(--signal); color: var(--ink); box-decoration-break: clone;`
- **Strike**: a 3px `--paper` rule through a run of text at 55% height. Marks a
  claim the research contradicts.
- **Redaction**: a solid `--paper` block replacing the text entirely, same width
  as the text it covers. Marks a claim with no retrievable source. On hover or
  focus, the block lifts to reveal the text underneath with a note explaining
  why nothing was found.

These three states are the entire vocabulary for annotating a claim. They are
mutually exclusive per run of text.

---

## 6. Components

### Hero

Full viewport height. Headline set to the left edge in display type, three lines
maximum. A dithered looping animation sits behind or below it, cropped by the
fold so it continues off-screen. The input field is a single bare line: a 2px
bottom rule, mono 400 at 18px, placeholder is a real example claim, and a button
labeled `Trace` in mono uppercase. No card, no container, no shadow.

### Claim bar

Persistent across the result view. The claim in mono 700 at 22px, with the
source domain count and elapsed time in metadata type on the right. 2px bottom
border.

### Research trail

A vertical sequence of rounds, V1 to V3. Each round is a row: the round label in
display type at 40px in `--rule` color (large, quiet, structural), the queries
issued in mono 12px uppercase, and the gap that triggered the next round in body
type. Rounds are separated by hairlines, not cards. The sequence is real, so
numbering it is correct here.

### Evidence board

A two-column list, not a grid of cards. Each item: source domain in label type,
the extracted claim in body type with marker annotation applied, and the
publication date in metadata type. Hairline between items. Contradictory pairs
are bracketed together with a 2px left rule spanning both.

### Paranoia meter

Section 4. A dither band at 160px height full width, the score in display type
at 132px overlapping the band's left edge, and a one-line label in mono
uppercase beneath. No other content in this section.

### Synthesis

Body type, max 72 characters per line, in a single column. Inline citation
markers are mono 11px superscript in `--signal`, linking to the evidence board
item.

---

## 7. Motion

One orchestrated moment only: when a trace runs, the dither band resolves from
fully saturated noise down to its final density over about 900ms. Everything
else is static.

Loading states use the dither, not a spinner: the hero animation runs at full
noise while research is in flight and clears when results land.

`prefers-reduced-motion: reduce` disables the dither animation and renders the
final state directly.

---

## 8. Copy

Voice: plain, declarative, dry. The product is confident about its method and
honest about its limits. It is never breathless and never apologetic.

- The verb is always **trace**, never analyze, verify, detect, or fact-check.
- Never output "true", "false", "real", or "fake" as a result state. The result
  states are: traced to a source, mutated, contradicted, no source found.
- Empty state: name what goes in the box, with a real example claim.
- Failure state: say what the system could not find and why. Never apologize,
  never use the first person.
- The intentional over-confidence failure case is surfaced, not hidden. Label it
  plainly and explain what evidence was insufficient.

Positioning line for the hero and the submission:

> Trace a rumor before it moves a price.

Supporting line:

> Where the story started, how it mutated, and what still holds. Not a verdict.

---

## 9. Accessibility floor

- `--signal` on `--ink` and `--paper` on `--ink` both clear 4.5:1. `--paper-mute`
  is metadata only and must never carry meaning alone.
- Every dither state has a text equivalent adjacent to it. Density is never the
  sole carrier of the score.
- Visible keyboard focus: 2px `--signal` outline, 2px offset. Never removed.
- Redaction blocks are reachable and revealable by keyboard.
- Full layout down to 360px. The hero headline drops to 56px and the evidence
  board collapses to one column.

---

## 10. Things that will ruin this

Listed because they are the likely failure modes, not as generic advice.

- Adding a second accent color. The system dies immediately.
- Rounding any corner.
- Using the accent as a large background fill. It becomes a lime landing page.
- Smoothing the dither, or using a soft grain texture instead of true 1-bit
  error diffusion. The hard threshold is the whole point.
- Making the Paranoia Meter a gauge or a red-to-green bar.
- Putting the score above the evidence. The score is a consequence of the trail
  and must appear after it in reading order.
- Centering body copy.
- Adding a card, a border radius, and a shadow to anything in order to "group"
  it. Grouping is done with hairlines and whitespace.
