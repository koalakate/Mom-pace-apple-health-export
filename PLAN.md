# Motherhood & Sleep — Data Art Project Plan

## Context

Personal data art project visualizing how motherhood affects sleep quality, based on ~4.7 years of Apple Watch data. Two children (born May 7, 2022 and Nov 10, 2025). The goal is a scrollytelling React.js webpage with custom D3.js visualizations, light theme, English only.

Data exploration in Python is partially complete — 6 charts produced, insights written. Now we need to finalize the data pipeline, explore visualization styles, and build the React app.

**Story hook:** "Since becoming a mother, I've accumulated a sleep debt of 2,323 hours — 97 full days. My worst night: November 11, 2025 — 1.3 hours of sleep."

**Name shortlist:** Mom Pace, Night Watch, The Mother Load

---

## Architecture

```
project/
├── data/                    # Python data pipeline
│   ├── 01_sleep_exploration.ipynb  (exists)
│   ├── sleep_data.json             (exists, raw)
│   ├── heartrate_data.json         (exists, raw)
│   ├── resting_hr_data.json        (exists, raw)
│   └── nightly_sleep_processed.json (to generate)
├── web/                     # React scrollytelling app
│   ├── public/data/         # Processed JSON for visualization
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ScrollySection.jsx
│   │   │   ├── SleepTimeline.jsx
│   │   │   ├── PhaseComparison.jsx
│   │   │   ├── Awakenings.jsx
│   │   │   ├── BedtimeDrift.jsx
│   │   │   ├── SleepVsHeartRate.jsx
│   │   │   ├── SleepStages.jsx
│   │   │   ├── Tooltip.jsx
│   │   │   └── FactCard.jsx
│   │   ├── hooks/
│   │   │   └── useScrollProgress.js
│   │   ├── data/
│   │   │   └── insights.js
│   │   └── styles/
│   │       └── theme.js
│   └── package.json
└── charts/                  # Exploration PNGs (existing)
```

---

## Stream A: Data Pipeline (Python)

Finalize and export all processed data as JSON for React.

- [ ] **A1. Finalize nightly sleep data export**
  - Fix night assignment edge cases
  - Export `nightly_sleep_processed.json` with all fields
  - Validate no gaps or anomalies

- [ ] **A2. Export resting heart rate as daily JSON**
  - Aggregate to daily averages
  - Align dates with sleep data
  - Export `resting_hr_processed.json`

- [ ] **A3. Export sleep stages as nightly breakdown**
  - Nightly Core/Deep/REM hours (from Sep 2022+)
  - Export `sleep_stages_processed.json`

- [ ] **A4. Calculate derived metrics for the story**
  - Cumulative sleep debt over time
  - Rolling averages (7d, 30d)
  - Phase-level summary statistics
  - Export `story_metrics.json`

---

## Stream B: React App Scaffolding

Set up the project and scrollytelling infrastructure.

- [ ] **B1. Initialize React project**
  - Vite + React
  - Install: d3, framer-motion
  - Set up project structure

- [ ] **B2. Scrollytelling engine**
  - `useScrollProgress` hook (Intersection Observer)
  - `ScrollySection` component: text panel + chart panel
  - Scroll-triggered animations

- [ ] **B3. Theme & typography**
  - Light theme: off-white background, dark text
  - Phase color palette:
    - Pre-pregnancy: teal `#2A9D8F`
    - Pregnancy: amber `#FF9F1C`
    - Postpartum: red `#E63946`
  - Typography: clean sans-serif (Inter or similar)

---

## Stream C: Visualization Design & Development

### C-explore: Visualization Ideation & Prototyping

Before committing to final chart types, explore different visual approaches for each data story. Prototype in Python (matplotlib/D3 sketches) to compare options.

- [ ] **C-explore-1. Sleep timeline — visual style exploration**
  - Option A: Scatter + rolling line (current)
  - Option B: Area chart with gradient fill (density feel)
  - Option C: Horizon chart (compact, shows deviation from baseline)
  - Option D: Stream/river metaphor (width = sleep hours)
  - Option E: Heatmap calendar (each cell = one night, color = hours)

- [ ] **C-explore-2. Phase comparison — visual style exploration**
  - Option A: Boxplots (current)
  - Option B: Beeswarm / strip plot (shows every data point)
  - Option C: Violin plot (distribution shape)
  - Option D: Ridgeline / joy plot (overlapping density curves)

- [ ] **C-explore-3. Awakenings — visual style exploration**
  - Option A: Timeline scatter + rolling line (current)
  - Option B: Dot matrix / waffle chart (each dot = one awakening)
  - Option C: Bar code / stripe pattern (each night as a vertical line, height = awakenings)

- [ ] **C-explore-4. Bedtime drift — visual style exploration**
  - Option A: Scatter + rolling line (current)
  - Option B: Polar / clock chart (24h clock, dots placed by time)
  - Option C: Gradient strip (horizontal timeline, color = bedtime hour)

- [ ] **C-explore-5. Sleep vs Heart Rate — visual style exploration**
  - Option A: Dual panel aligned (current)
  - Option B: Connected scatterplot (sleep on X, HR on Y, path over time)
  - Option C: Overlaid area chart with dual Y axes

- [ ] **C-explore-6. Sleep stages — visual style exploration**
  - Option A: Stacked bar monthly (current)
  - Option B: Stacked area (smooth, shows flow over time)
  - Option C: Marimekko / mosaic (width = total sleep, color bands = stages)
  - Option D: Small multiples (one mini chart per stage)

- [ ] **C-explore-7. Review prototypes, pick final style for each chart**

### C-build: Chart Component Development (depends on A + B + C-explore)

Build each final D3.js visualization as a React component.

- [ ] **C-build-1. SleepTimeline** — the hero chart
  - Chosen visual style from C-explore-1
  - Vertical event markers (pregnancies, births)
  - Horizontal reference line at 7h
  - Scroll-triggered animation

- [ ] **C-build-2. PhaseComparison**
  - Chosen visual style from C-explore-2
  - Color-coded by life phase

- [ ] **C-build-3. Awakenings**
  - Chosen visual style from C-explore-3
  - Emphasis on the jump from 0 → 7

- [ ] **C-build-4. BedtimeDrift**
  - Chosen visual style from C-explore-4
  - Y-axis: time of day (9PM → 2AM)

- [ ] **C-build-5. SleepVsHeartRate**
  - Chosen visual style from C-explore-5
  - Visual correlation between sleep and health

- [ ] **C-build-6. SleepStages**
  - Chosen visual style from C-explore-6
  - Data available from Sep 2022 onward

---

## Stream D: Content & Copy

- [ ] **D1. Write section copy**
  - Hook / intro paragraph
  - Narrative text for each of the 6 chart sections
  - Closing / reflection

- [ ] **D2. Tooltip content & fact cards**
  - Insight text per chart
  - Research facts with sources:
    - Mothers average 4.4h/night first week postpartum (SLEEP 2025)
    - Parents sleep-deprived for 6 years after first child (Warwick University)
    - Before baby 68% got 7+h, after — only 10% (Sleep Junkie)
    - Women lose 42min more sleep/night than men (ScienceDirect)
    - 17–19h awake ≈ BAC 0.05% impairment (Williamson & Feyer, 2000)
    - Sleep deprivation → 48% increased heart disease risk (PMC)
    - ≤5h sleep doubles type 2 diabetes risk (Johns Hopkins)
    - Postpartum sleep loss linked to accelerated biological aging (UCLA)

---

## Execution Order

```
Phase 1 (parallel):
  Stream A: Data pipeline    ─────────────►
  Stream B: React scaffold   ─────────────►
  Stream D: Content & copy   ─────────────►

Phase 2 (parallel, after Phase 1):
  C-explore: Viz prototyping ─────────────►

Phase 3 (after C-explore decisions):
  C-build: Chart components  ─────────────►

Phase 4:
  Integration, polish, deploy
```

- Streams A, B, D are fully independent → run in parallel
- C-explore needs data from A to prototype with real data
- C-build needs A + B + C-explore decisions
- Phase 4 is integration and final polish

---

## Verification

1. Run Python data export → check JSON files are valid and complete
2. `npm run dev` → app loads with scroll sections
3. Each chart renders with real data
4. Tooltips show insights + facts on hover
5. Scroll animations trigger correctly
6. Responsive on desktop (mobile is secondary)
7. Deploy to Vercel/Netlify for sharing
