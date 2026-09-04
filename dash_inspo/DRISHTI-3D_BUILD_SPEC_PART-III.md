# DRISHTI 3D — Build Specification, PART III

## The Landing Dashboard Shell

**Extends Parts I and II. Give your coding agent all three.**

Part I defined the design system, data generator, block model and widgets. Part II defined the
globe, the region drill-down and the five terrain sites. Part III defines **what the user sees
in the first three seconds** — the dashboard chrome that wraps the globe at state G0, modelled
on the reference imagery.

---

## 1. THE TRANSLATION PROBLEM, AND THE RULE THAT SOLVES IT

The reference dashboard is a **satellite collision-avoidance console**. It tracks a live LEO
constellation, predicts conjunctions, and shows ground-station health. It looks superb.

You do not have a satellite constellation. You have a manganese belt.

If you copy the reference literally — orbiting dots, "chance of collision 89%", a Starlink
render — you will have built a beautiful lie, and the first judge who asks *"what satellite is
that and where is the telemetry from?"* ends your round.

**The rule: every element of the reference gets a mining-honest replacement that does real work.
Nothing is kept for looks alone.**

There is a genuine, defensible version of almost every panel, because your project really does
depend on Earth-observation satellites — just as data sources rather than as tracked assets.
The honest analogue of "collision prediction" is **acquisition planning**: which sensors pass
over the Sausar belt, when the next usable scene lands, what the cloud cover will be, and how
stale each input layer currently is.

That is a real operational problem in remote-sensing work, it is unmistakably Space Technology
theme, and it maps onto the reference layout almost panel for panel.

---

## 2. THE TRANSLATION TABLE

Implement exactly this mapping. Do not invent additions.

| Reference element | DRISHTI replacement | Why it's real |
|---|---|---|
| Live satellite constellation orbiting the globe | **EO satellites whose ground tracks cross India** — Sentinel-1, Sentinel-2, Landsat 8/9, Resourcesat-2A, EOS-04, EOS-06, Cartosat-3, NISAR | These are the actual sources in your data table |
| Orbit paths as thin arcs | **Ground tracks and swath footprints** over the Indian subcontinent | A swath footprint is what determines whether you get a scene |
| "Chance of collision: 89%" | **"Next usable acquisition: Sentinel-2B, 04:41 UTC, cloud 18%"** | Acquisition planning is a real task |
| Ground-station tower table | **The 11 MOIL mines table** — ID, district, type, status, current risk, last update | Your actual assets |
| "Top severity errors" alert cards | **Shortfall risk alerts** — mine, severity, driver, horizon | Module B output |
| "Chance of failure" waveform chart | **Production forecast bands** — P10/P50/P90 vs committed plan, all mines overlaid | Module B output |
| Satellite detail card with 3D render | **Sensor detail card** — bands used, native resolution, revisit period, current data latency, which of your 18 features it feeds | Ties the pretty card to the model |
| Corner thumbnail + "SAT-Error" | **Latest scene thumbnail** over the selected mine, with acquisition timestamp and freshness | Shows the pipeline is alive |
| "SIMULATE: Clean path / Space trash" | **SIMULATE: Monsoon event / Equipment loss / Cutoff change** | Your what-if engine |
| "FILTERS: Satellites / Towers" | **LAYERS: Mines / Prospectivity / Lineaments / Swaths / Risk** | Real layer control |
| Tabs: Overview / Firewall / Alerts / Attacks | **Tabs: Overview / Exploration / Operations / Acquisitions** | Your two halves, plus the space layer |
| Rotate dial, zoom ± | Keep both, unchanged | Genuinely useful for globe and terrain azimuth |

**Cut entirely, no replacement:** the 3D satellite model render, the "space trash" toggle, the
speed gauge, anything implying you command a spacecraft.

---

## 3. AESTHETIC RECONCILIATION — THIS SUPERSEDES PART I §2.4

Part I specified a survey-plan aesthetic: 2px radius, hairline rules, no shadows. The reference
is soft rounded glass with glow. These conflict. Resolve it as follows, and apply consistently:

```css
/* Chrome — floating panels, cards, the shell. Reference-style. */
--radius-panel:  12px;
--panel-glass:   rgba(20, 25, 32, 0.72);
--panel-blur:    backdrop-filter: blur(18px) saturate(1.1);
--panel-border:  1px solid rgba(201, 211, 221, 0.10);
--panel-shadow:  0 8px 32px rgba(0, 0, 0, 0.45);

/* Data — tables, readouts, chart interiors. Part I's instrument aesthetic. */
--radius-data:   0;
/* no shadow, no blur, hairline rules only */
```

**The principle: the chrome is glass, the data is paper.** Panels float and glow; the numbers
inside them are flat, sharp and monospaced. This is exactly what the reference does — look at
the towers table in image 4, it is a plain sharp-edged data grid sitting inside a soft glass
panel. Do not let the glow leak onto the data.

### Alert glow

The reference's anomaly card has a warm gradient bleeding from its lower edge. Reproduce it,
but **only on cards at `ACT` severity**:

```css
background:
  linear-gradient(180deg, transparent 55%, rgba(226, 98, 42, 0.22) 100%),
  var(--panel-glass);
```

`WATCH` severity gets the ochre `--ore-60` at half that opacity. `LOW` gets nothing. Severity
must be readable from across a room without reading a word — but if every card glows, none of
them do.

### Palette

Part I's tokens hold. The reference's cyan-and-orange pairing maps directly onto
`--ore-40` (#2E7D8C) and `--ore-80` (#E2622A), which is fortunate — you already have the
reference's colour relationship in a palette derived from manganese mineralogy. Use
`--rhodonite` for selection only, as before.

---

## 4. LAYOUT

Match the reference structure at 1920 × 1080.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ◆ DRISHTI   [Overview][Exploration][Operations][Acquisitions]    ⟳ ⚙ 🔔  │  64px
├──────────┬─────────────────────────────────────────────────┬───────────────┤
│          │                                                 │               │
│ SCENE    │                                                 │  SENSOR CARD  │
│ THUMB    │                                                 │  (on select)  │
│ + STATUS │                                                 │               │
│          │              GLOBE / TERRAIN                    │               │
│ ──────── │           (full-bleed, no panel)                │      ＋       │
│ SIMULATE │                                                 │      －       │
│  ▸ ▸ ▸   │        floating callouts anchored to            │               │
│          │        pins, connected by leader lines          │   ROTATE      │
│ ──────── │                                                 │    DIAL       │
│ LAYERS   │                                                 │               │
│  ▸ ▸ ▸ ▸ │                                                 │               │
├──────────┴──────────────┬──────────────────┬───────────────┴───────────────┤
│  RISK ALERTS            │  MINES TABLE     │  PRODUCTION FORECAST          │  260px
│  (6 cards, 2 rows)      │  (paginated)     │  (multi-series band chart)    │
└─────────────────────────┴──────────────────┴───────────────────────────────┘
```

Left rail 260px, right rail 220px, bottom dock 260px. **The globe is full-bleed behind the
rails** — panels float over it with blur, they do not sit in a reserved column. This is what
makes the reference feel like an instrument rather than a web page, and it is the single most
important layout decision here.

---

## 5. PANEL SPECIFICATIONS

### 5.1 Top bar

Left: a small mark plus `DRISHTI` in Space Grotesk 600, and beneath it in Plex Mono 9px,
`PS 26009 · MOIL · TEAM SSG`.

Centre: four tab pills. Active pill gets `--panel-glass` fill, a `--rhodonite` 2px underline,
and a small status dot. Inactive pills are text only at `--text-dim`.

Right: three icon buttons — history, settings, notifications — with a count badge on
notifications. The settings panel needs to exist but can contain only the honesty disclosure
from Part I §11.2 and a reduced-motion toggle. Do not build a preferences system.

Far right, mono 10px, `--text-mute`: `PROTOTYPE · SYNTHETIC DATA`. Always visible.

### 5.2 Scene thumbnail + status (top-left)

A 240 × 130 image tile showing the most recent satellite scene over the selected mine, with a
timestamp chip bottom-right in mono. Beneath it, a status strip:

```
● SAUSAR BELT · 11 MINES ACTIVE
⛏ 2 AT RISK    🛰 4 SENSORS    ⏱ LATENCY 3d
```

At the prototype stage the thumbnail is a static PNG per site. Ten static images beat one tile
pipeline that stalls on stage.

### 5.3 SIMULATE cluster (left rail)

Three icon-and-label rows, styled like the reference's simulate block:

- **Monsoon event** — injects a rainfall shock into the forecast; the P90 band drops visibly
- **Equipment loss** — removes a HEMM unit from a chosen mine
- **Cutoff change** — jumps to the block model with the probability threshold raised

Each is a toggle that visibly changes something in the bottom dock within 400ms. If a control
does not visibly change data, delete it. The reference's simulate block is the most
imitated-and-hollowed element in this style of dashboard; yours must actually simulate.

### 5.4 LAYERS cluster (left rail)

Five checkbox rows with icons: Mines, Prospectivity, Lineaments, Satellite swaths, Risk. Each
toggles a real scene layer. `Satellite swaths` draws the footprint polygons of upcoming passes
over India — this is the one that earns the space theme.

### 5.5 Sensor detail card (right, on selection)

Appears when a satellite swath or sensor chip is clicked. Contents, all real:

```
SENTINEL-2B                          [ESA · Copernicus]
─────────────────────────────────────────────────────
Bands used          B2 B3 B4 B8 B11 B12
Native resolution   10 m (VNIR) / 20 m (SWIR)
Revisit             5 days combined constellation
Next pass           04:41 UTC · cloud forecast 18%
Data latency        2.1 days
Feeds features      ferric-iron index, NDVI stress,
                    LST residual proxy
─────────────────────────────────────────────────────
```

That last line is the whole point. **Every sensor card must name which of the 18 predictor
features it feeds.** It converts a decorative panel into an argument about your model.

Do not put a 3D spacecraft render here. Use a small wireframe sensor glyph or the agency logo.

### 5.6 Risk alert cards (bottom-left)

Six cards, two rows of three, matching the reference's "top severity errors" block.

```
┌────────────────────────────────┐
│ Shortfall Predicted       ▮▮▮  │   severity bars
│ ⛏ Balaghat (Bharveli)          │
│ 2026-09-14 · 90d horizon       │
│              ◇ P90 −6,400 t    │
└────────────────────────────────┘
```

Severity bar glyph in the top-right, exactly as the reference does it. Card glow per §3.
Clicking a card flies the camera to that mine and loads its forecast into the chart.

Alert types: Shortfall Predicted, Equipment Degradation, Rainfall Disruption, Blast Schedule
Slip, Grade Variance, Data Staleness. That last one — a layer being too old to trust — is a
real operational alert in remote sensing and nobody else in the room will have thought of it.

### 5.7 Mines table (bottom-centre)

Sharp-edged data grid inside a glass panel. Columns: ID, Mine, District, Type, Status, Risk,
Last update. Sortable by clicking a header. Paginated at 5 rows with the reference's
`1–5 of 11 items · Page 01 of 3` footer.

Status dots: green `--risk-low` active, ochre watch, red act. Risk column shows a small
horizontal bar plus a mono percentage — the reference's load-bar pattern, reused.

### 5.8 Production forecast chart (bottom-right)

The reference's flowing multi-line waveform, translated into something honest: all 11 mines'
forecast P50 lines overlaid, with the selected mine's P10–P90 band filled and the others
dimmed to 20% opacity. Committed plan as a horizontal dashed reference line. Shade the region
where P90 crosses below plan.

Anchor labels along the bottom edge in the reference's style, mono, with dates:

```
BALAGHAT              KANDRI               DONGRI BUZURG
PEAK RISK             STABLE               WATCH
2026-09-14            —                    2026-10-02
```

---

## 6. THE OPENING SEQUENCE

First load, scripted, 3200ms total. This is the first impression and it should be built once
and never touched again.

```
0ms      Black. Mark fades in centre screen.
300ms    Globe fades up, already rotating, far out.
900ms    Camera eases inward. Star field parallaxes.
1200ms   Panels slide in staggered: top bar, then left rail,
         then bottom dock, then right rail. 80ms apart.
1800ms   Satellite ground tracks draw themselves across the globe,
         stroke-dashoffset animation, 900ms.
2400ms   India highlights. Five site pins rise.
2900ms   Risk alert cards populate one by one, 60ms apart.
3200ms   Settled. Rotation continues. Nothing else moves.
```

After settling, **the only motion is the globe rotation**. No pulsing, no breathing panels, no
ambient particle drift. The reference is calm; that calm is why it reads as professional
rather than as a screensaver. Respect `prefers-reduced-motion` by cutting straight to settled.

---

## 7. WHAT WILL GO WRONG

Predictable failure modes for this specific aesthetic. Guard against each.

**Glass everywhere.** Blur is expensive and, applied to every surface, makes text illegible on
a projector. Use `backdrop-filter` on floating panels only — at most six elements on screen.
Never on table rows.

**Contrast collapse.** Dark glass over a dark globe over a dark background can drop text to
2:1. Every panel needs a solid tint floor beneath the blur, not blur alone. Check the mines
table against the globe's bright limb specifically.

**Fake density.** The reference is dense because it has a real fleet to monitor. You have 11
mines. Do not pad the interface with invented rows to match the reference's visual weight.
Eleven real mines presented cleanly beats forty fake ones.

**The glow arms race.** If everything glows, nothing reads as urgent. Glow is reserved for
`ACT` severity, full stop.

**Leader-line spaghetti.** The floating callouts connected by thin lines look wonderful in a
still and become unreadable when four overlap. Cap simultaneous callouts at **two**, and
implement simple collision avoidance that nudges the second one clear.

---

## 8. BUILD ORDER FOR PART III

Slot these into Part I §14 as milestones 3a to 3f, before Part I's milestone 3.

| # | Milestone | Done when |
|---|---|---|
| 3a | Shell layout: top bar, rails, dock, all empty | Panels sit correctly at 1920×1080 and 1440×900 |
| 3b | Glass token system, contrast-checked against a bright globe limb | Text passes 4.5:1 everywhere |
| 3c | Globe drops in behind the shell, full-bleed | Rotation at 60fps with all panels blurred |
| 3d | Bottom dock: alert cards, mines table, forecast chart, wired to real generated data | Clicking an alert flies the camera |
| 3e | Left rail: SIMULATE and LAYERS, each visibly changing something | No dead controls |
| 3f | Ground tracks, swath footprints, sensor cards | Every sensor card names its features |
| 3g | The opening sequence | Runs identically twice in a row |

---

## 9. ADDITIONAL ACCEPTANCE CRITERIA

- [ ] No element implies DRISHTI commands, owns or tracks a spacecraft.
- [ ] Every sensor card names the predictor features that sensor feeds.
- [ ] Every SIMULATE control visibly changes the bottom dock within 400ms.
- [ ] Glow appears only on `ACT` severity cards.
- [ ] At most two floating callouts on screen at once, never overlapping.
- [ ] Table text passes 4.5:1 contrast over the brightest part of the globe.
- [ ] `backdrop-filter` is applied to six elements or fewer.
- [ ] The opening sequence completes in under 3.5s and settles into stillness.
- [ ] The mines table contains exactly 11 rows. No padding.
- [ ] `PROTOTYPE · SYNTHETIC DATA` visible in the top bar at all times.
