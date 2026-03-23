# Data-Art Visualization Concepts — Design Spec

**Project:** Motherhood & Sleep Data Art
**Date:** 2026-03-23
**Status:** Brainstorming — shortlisted 4 concepts for prototyping

## Context

Personal data art project visualizing ~4.7 years of Apple Watch sleep data across two pregnancies and postpartum periods. These data-art concepts are **in addition to** the existing 6 analytical charts (sleep timeline, phase comparison, awakenings, bedtime drift, sleep vs HR, sleep stages). They serve as:

- **Additional sections** in the scrollytelling React page (hero visuals, interstitials, finale)
- **Standalone printable posters** for exhibition / social media

**Primary data encoding:** Sleep duration + awakenings per night (~1,700 nights)
**Format:** Each concept picks its natural shape (panorama, vertical, square)

---

## Concept A: "The Blanket"

### Metaphor
A knitted blanket unrolled horizontally. Smooth yarn = unbroken sleep. Knots/bumps = awakenings. The blanket deteriorates visually when sleep collapses.

### Natural shape
Horizontal panorama (~3:1 ratio). ~120cm wide at A1 landscape.

### Visual structure
~1,700 vertical columns, one per night. Each column is a set of parallel vertical lines (like knit stitches) with knot interruptions.

### Data mapping

| Visual property | Data field | Encoding |
|----------------|-----------|----------|
| Column height | Sleep hours | 9h = full height, 0h = flat |
| Knots per column | Awakenings | Each awakening = a small loop/bulge interrupting the vertical lines, spaced proportionally within the column |
| Color | Life phase | Teal (pre-pregnancy) / Amber (pregnancy) / Red (postpartum) |
| Gap between columns | — | Subtle spacing, like space between knit stitches |

### Key visual moments
- **Pre-baby:** Tall, smooth, even columns — a well-made blanket
- **First pregnancy:** Height dips, color shifts to amber
- **First postpartum:** Dramatic — short columns, dense knots, red. The blanket looks *damaged*
- **Recovery:** Gradual return to taller, smoother columns
- **Second cycle:** Pattern repeats

### Scrollytelling behavior
Horizontal scroll/pan. Text captions appear above or below at phase transitions. The blanket *unfurls* as you scroll.

### Poster version
Full panorama with phase labels and key stats below. Could literally be printed on fabric.

### Technical approach
SVG or Canvas. Each column rendered as a set of bezier curves with knot deformations. Relatively straightforward — the main challenge is making the knot shapes look tactile and textile-like.

---

## Concept B: "The Thread"

### Metaphor
A single continuous thread that traces the entire ~4.7 years. Smooth and flowing when sleep is good. Tangles, loops, and knots when sleep fragments. Like a spool of thread that got tangled — the tangles ARE the postpartum periods.

### Natural shape
Vertical poster (~2:3 ratio) or square. The thread winds downward through time.

### Visual structure
One continuous SVG path, no breaks. The path's behavior changes based on data.

### Data mapping

| Visual property | Data field | Encoding |
|----------------|-----------|----------|
| Amplitude (horizontal spread) | Sleep duration | Good nights = wide, lazy curves. Bad nights = narrow, compressed |
| Frequency (oscillation rate) | Awakenings | 0 awakenings = one smooth arc per night. 5 awakenings = 5 tight loops within that night's segment |
| Self-crossing / tangling | Awakenings > 3 AND sleep < 5h | The path loops back on itself, creating visible knots |
| Color gradient | Life phase | Teal → Amber → Red → Amber → Red along the thread |
| Thickness (optional) | Sleep efficiency | Thicker = more efficient sleep |

### Tangling logic
When awakenings are high AND sleep is low, the path crosses itself, creating visible knots. Specifically: if awakenings > 3 and sleep < 5h, the path loops back on itself. This is what creates the "tangle ball" effect at postpartum periods.

### Key visual moments
- **Pre-baby:** Beautiful, rhythmic wave — almost meditative
- **First pregnancy:** Wave compresses slightly, becomes irregular
- **First birth:** Thread *explodes* into tangles — a knot ball. The most dramatic visual moment
- **Recovery:** Tangles slowly loosen, thread finds rhythm again (but never quite as smooth as before)
- **Second birth:** Another tangle ball, possibly denser

### Scrollytelling behavior
Vertical scroll. The thread draws itself as you scroll down — like watching someone knit in real time. Text annotations at calm/chaos transitions. Birth events could have a brief pause/zoom into the tangle.

### Poster version
Full thread on one sheet. From a distance reads as a landscape — calm seas, storm, calm, storm. Up close you can trace individual nights.

### What makes it different from The Blanket
The Blanket is a *grid* (1,700 discrete columns). The Thread is a *single continuous gesture*. The Blanket says "every night is a stitch." The Thread says "this is one unbroken life."

### Technical approach
Single SVG `<path>` element generated from data. The path equation takes sleep + awakenings as parameters controlling amplitude and frequency of a parametric curve. The tangling logic requires careful path generation to avoid visual artifacts. D3 custom path generator or procedural bezier curves.

---

## Concept D: "Coral Growth"

### Metaphor
A branching organism (coral colony / tree) growing upward through time. Healthy sleep = tall, clean trunk growth. Fragmented sleep = dense, fractured branching — like storm-damaged coral. The overall silhouette tells the story without reading any data points.

### Natural shape
Vertical poster (~2:3 or square). Grows upward from a base.

### Visual structure
Time flows upward. Each **week** is a horizontal slice of growth. The organism branches based on sleep disruption.

### Data mapping

| Visual property | Data field | Encoding |
|----------------|-----------|----------|
| Vertical growth per week | Average sleep hours | Good sleep = tall growth. Poor sleep = stunted, compressed |
| Branching / splits | Awakenings | 0-1 avg = single trunk. 2-3 = fork into 2-3 branches. 4+ = dense fractal splitting |
| Branch thickness | Sleep duration (per night) | Thicker = longer sleep |
| Color | Life phase | Teal trunk → Amber → Red branches |
| Branch angle (optional) | Bedtime drift | Regular bedtime = straight up. Erratic = branches splay outward |

### Key visual moments
- **Pre-baby:** Clean, elegant trunk with occasional small branches. Healthy, strong
- **First pregnancy:** Trunk starts splitting more, growth slows
- **First postpartum:** **The explosion.** Dense, fractured, chaotic branching — like coral after a bleaching event. Wide silhouette, short height. Visual climax
- **Recovery:** Branches consolidate. Fewer splits, taller growth. But the scar tissue remains visible below
- **Second cycle:** Another burst of branching. The organism is already wider/more complex

### What makes it unique
The **overall silhouette tells the story.** Narrow trunk → explosion → narrowing → explosion. It looks like a living thing that survived two storms.

### Scrollytelling behavior
Coral grows upward as you scroll. Each week of data adds a slice of growth. Annotations at phase transitions. Subtle "breathing" animation — branches gently swaying.

### Poster version
Centered on page, dark background (deep ocean blue or black), coral in phase colors. Timeline with key dates below. Reads like a scientific illustration of a specimen.

### Technical approach
**Most algorithmically complex concept.** Requires recursive tree / L-system algorithm with data-driven parameters. Options:
- L-systems with data-parameterized rules
- Fractal tree recursion in Canvas/WebGL
- D3 force-directed tree with constrained vertical growth
Branch geometry needs to look organic, not mechanical — noise/jitter on angles and lengths.

---

## Concept E: "The Night Grid"

### Metaphor
A grid of circles — one per night — where each circle's size and fragmentation reflect that night's sleep. Bad nights merge into connected blobs (inspired by the Hebrew newspaper circle-grid reference). The grid's orderly geometry breaks down when sleep collapses.

### Natural shape
Vertical poster or square. 7 columns (days of week) x ~245 rows (weeks).

### Visual structure
Each cell contains one circle. Circles react to data — growing, shrinking, fragmenting, and merging with neighbors.

### Data mapping

| Visual property | Data field | Encoding |
|----------------|-----------|----------|
| Circle diameter | Sleep hours | 9h = fills cell. 3h = tiny dot |
| Circle fragmentation | Awakenings | 0 = solid ●, 1 = hairline cut ◉, 2-3 = visibly split ◑, 4+ = disintegrated into scattered dots ◔ |
| Color fill | Life phase | Teal / Amber / Red |
| Blob-merging | Consecutive bad nights | Adjacent circles connect with bridge/neck when both nights are bad (< 5h AND > 3 awakenings) |

### The merge mechanic
Adjacent bad-night circles grow a connecting neck between them:
- **Horizontal merge:** consecutive days (Mon-Tue, Tue-Wed...)
- **Vertical merge:** same weekday across weeks
- Neck thickness scales with severity — the worse both nights are, the thicker the connection
- Creates organic blob-shapes during postpartum periods — the grid *loses its structure*
- During good periods, the grid is clean and orderly

### Key visual moments
- **Pre-baby:** Beautiful, orderly grid of large solid teal circles. Almost like a fabric pattern
- **First pregnancy:** Circles shrink slightly, some show hairline cuts. Grid still orderly
- **First postpartum:** Grid breaks down. Small, fragmented, red circles merge into chaotic blobs. The clean geometry is violated
- **Recovery:** Grid restores order. Circles grow, cuts heal, blobs separate back into individuals
- **Second postpartum:** Another collapse — two disruption zones visible for direct comparison

### Scrollytelling behavior
Grid builds row by row (week by week) as you scroll. Text annotations at phase transitions. On hover/tap, individual circles expand to show that night's stats. Could do zoom transition — start showing full grid as texture, then zoom into a specific week.

### Poster version
Full grid, annotated. Phase labels on left. Key stats on right. From 2m away: texture pattern (dense/sparse/blobby). From 30cm: individual nights. Most Feltron/Posavec of the four concepts.

### Technical approach
SVG preferred (each circle is an element, enables hover interaction). The merge mechanic uses metaball/blob algorithms or SVG path unions. D3 grid layout + custom circle generators. The fragmentation effect can use clip-paths or custom SVG shapes.

---

## Comparison Matrix

| Aspect | A: Blanket | B: Thread | D: Coral | E: Night Grid |
|--------|-----------|----------|---------|--------------|
| **Time granularity** | 1 night | 1 night | 1 week | 1 night |
| **Primary metaphor** | Textile craft | Continuous life | Living organism | Order vs chaos |
| **Emotional register** | Warmth, domesticity | Flow, continuity | Resilience, growth | Pattern, disruption |
| **Data precision** | High | Medium | Low (aggregated) | High |
| **Poster impact** | High | High | Very high | Very high |
| **Scroll animation** | Horizontal pan | Vertical draw | Grow upward | Build row by row |
| **Technical complexity** | Medium | Medium-High | High (L-systems) | Medium |
| **Closest reference** | Textile data art | Giorgia Lupi line work | Scientific illustration | Hebrew newspaper grid |
| **Interactivity potential** | Low | Medium | Low | High (hover per night) |

## Recommendation for prototyping order

1. **E: Night Grid** — fastest to prototype, highest data fidelity, strong poster + scroll potential
2. **A: Blanket** — your original idea, clear metaphor, medium complexity
3. **B: Thread** — beautiful concept, needs careful tuning of the tangle algorithm
4. **D: Coral** — most visually stunning but most complex; prototype after the others validate the data pipeline

---

## Decisions

- [x] **Poster annotations:** Include stats and legend on poster versions (not pure art)
- [x] **Scrollytelling layout:** Data-art pieces sit alongside analytical charts (not full-screen hero)
- [x] **Color palette:** Keep existing phase colors (teal `#2A9D8F` / amber `#FF9F1C` / red `#E63946`)
- [x] **Prototyping tool:** Go straight to D3.js / Canvas in the React app (no Python prototypes)
