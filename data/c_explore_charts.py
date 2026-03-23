"""
C-explore: Visual style prototyping for all 6 charts.
Generates multiple style options per chart as PNGs in charts/explore/.
"""

import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.colors as mcolors
from matplotlib.collections import LineCollection
from scipy.ndimage import gaussian_filter1d
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "charts" / "explore"
OUT.mkdir(parents=True, exist_ok=True)

# Load processed data
nightly = pd.DataFrame(json.loads((ROOT / "data" / "nightly_sleep_processed.json").read_text()))
nightly["night_date"] = pd.to_datetime(nightly["night_date"])
nightly = nightly.sort_values("night_date")

rhr = pd.DataFrame(json.loads((ROOT / "data" / "resting_hr_processed.json").read_text()))
rhr["date"] = pd.to_datetime(rhr["date"])

stages = pd.DataFrame(json.loads((ROOT / "data" / "sleep_stages_processed.json").read_text()))
stages["night_date"] = pd.to_datetime(stages["night_date"])

metrics = json.loads((ROOT / "data" / "story_metrics.json").read_text())

# Theme
PHASE_COLORS = {
    "Pre-pregnancy": "#2A9D8F",
    "Pregnancy 1": "#FF9F1C",
    "Postpartum 1": "#E63946",
    "Pregnancy 2": "#FF9F1C",
    "Postpartum 2": "#E63946",
}
BG = "#FAFAF8"
TEXT = "#2B2B2B"
GRID = "#E0E0E0"
ACCENT = "#E63946"
CALM = "#2A9D8F"

EVENTS = [
    (pd.Timestamp("2021-10-03"), "Pregnancy 1", "#FF9F1C"),
    (pd.Timestamp("2022-05-07"), "Child 1 born", "#E63946"),
    (pd.Timestamp("2025-02-17"), "Pregnancy 2", "#FF9F1C"),
    (pd.Timestamp("2025-11-10"), "Child 2 born", "#E63946"),
]

PHASE_ORDER = ["Pre-pregnancy", "Pregnancy 1", "Postpartum 1", "Pregnancy 2", "Postpartum 2"]

plt.rcParams.update({
    "figure.facecolor": BG,
    "axes.facecolor": BG,
    "axes.edgecolor": GRID,
    "axes.grid": True,
    "grid.color": GRID,
    "grid.alpha": 0.5,
    "text.color": TEXT,
    "axes.labelcolor": TEXT,
    "xtick.color": TEXT,
    "ytick.color": TEXT,
    "font.family": "sans-serif",
    "figure.dpi": 150,
})


def add_events(ax, y_pos=None):
    for date, label, color in EVENTS:
        ax.axvline(x=date, color=color, linestyle="--", alpha=0.5, linewidth=1)


def save(fig, name):
    fig.savefig(OUT / name, bbox_inches="tight", facecolor=BG)
    plt.close(fig)
    print(f"  -> {name}")


# =========================================================================
# C-explore-1: Sleep Timeline
# =========================================================================
print("=== C-explore-1: Sleep Timeline ===")

# Option A: Scatter + rolling line (baseline)
fig, ax = plt.subplots(figsize=(18, 6))
ax.scatter(nightly["night_date"], nightly["sleep_hours"], alpha=0.12, s=6, color=CALM)
r30 = nightly["sleep_hours"].rolling(30, min_periods=10).mean()
ax.plot(nightly["night_date"], r30, color=ACCENT, linewidth=2)
ax.axhline(y=7, color="gray", linestyle=":", alpha=0.4)
add_events(ax)
ax.set_ylabel("Sleep (hours)")
ax.set_title("A: Scatter + Rolling Average", fontweight="bold")
save(fig, "1A_scatter_rolling.png")

# Option B: Area chart with gradient fill
fig, ax = plt.subplots(figsize=(18, 6))
r7 = nightly["sleep_hours"].rolling(7, min_periods=3).mean()
ax.fill_between(nightly["night_date"], 0, r7, alpha=0.3, color=CALM)
ax.plot(nightly["night_date"], r7, color=CALM, linewidth=1.5)
ax.axhline(y=7, color="gray", linestyle=":", alpha=0.4)
add_events(ax)
ax.set_ylabel("Sleep (hours)")
ax.set_ylim(0, 11)
ax.set_title("B: Area Chart with Gradient Fill", fontweight="bold")
save(fig, "1B_area_gradient.png")

# Option C: Horizon chart (3-band)
fig, ax = plt.subplots(figsize=(18, 4))
smooth = gaussian_filter1d(nightly["sleep_hours"].values, sigma=7)
baseline = 7.0
diff = smooth - baseline
pos = np.clip(diff, 0, None)
neg = np.clip(-diff, 0, None)
ax.fill_between(nightly["night_date"], 0, pos, color=CALM, alpha=0.6, label="Above 7h")
ax.fill_between(nightly["night_date"], 0, neg, color=ACCENT, alpha=0.6, label="Below 7h")
add_events(ax)
ax.set_ylabel("Deviation from 7h")
ax.legend(loc="upper right", framealpha=0.8)
ax.set_title("C: Horizon Chart (deviation from 7h)", fontweight="bold")
save(fig, "1C_horizon.png")

# Option D: Stream/river (width = sleep hours)
fig, ax = plt.subplots(figsize=(18, 5))
smooth = gaussian_filter1d(nightly["sleep_hours"].values, sigma=14)
ax.fill_between(nightly["night_date"], -smooth / 2, smooth / 2, color=CALM, alpha=0.5)
ax.plot(nightly["night_date"], smooth / 2, color=CALM, linewidth=0.8)
ax.plot(nightly["night_date"], -smooth / 2, color=CALM, linewidth=0.8)
add_events(ax)
ax.set_ylabel("Sleep hours (symmetric)")
ax.set_title("D: Stream / River (width = sleep hours)", fontweight="bold")
save(fig, "1D_stream_river.png")

# Option E: Heatmap calendar
fig, ax = plt.subplots(figsize=(18, 8))
cal = nightly[["night_date", "sleep_hours"]].copy()
cal["week"] = cal["night_date"].dt.isocalendar().week.astype(int)
cal["year"] = cal["night_date"].dt.year
cal["dow"] = cal["night_date"].dt.dayofweek
cal["year_week"] = cal["year"] * 100 + cal["week"]
# Pivot to matrix
pivot = cal.pivot_table(index="dow", columns="year_week", values="sleep_hours", aggfunc="first")
cmap = plt.cm.RdYlGn
norm = mcolors.Normalize(vmin=2, vmax=9)
im = ax.imshow(pivot.values, aspect="auto", cmap=cmap, norm=norm, interpolation="nearest")
ax.set_yticks(range(7))
ax.set_yticklabels(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
# Simplify x-axis: show year boundaries
cols = pivot.columns.tolist()
year_starts = [i for i, c in enumerate(cols) if c % 100 <= 2]
ax.set_xticks(year_starts)
ax.set_xticklabels([str(cols[i] // 100) for i in year_starts])
plt.colorbar(im, ax=ax, label="Sleep hours", shrink=0.6)
ax.set_title("E: Heatmap Calendar", fontweight="bold")
save(fig, "1E_heatmap_calendar.png")

# =========================================================================
# C-explore-2: Phase Comparison
# =========================================================================
print("\n=== C-explore-2: Phase Comparison ===")

phase_data = [nightly[nightly["phase"] == p]["sleep_hours"].dropna().values for p in PHASE_ORDER]
colors_list = [PHASE_COLORS[p] for p in PHASE_ORDER]
labels = [p.replace(" ", "\n") for p in PHASE_ORDER]

# Option A: Boxplots
fig, ax = plt.subplots(figsize=(12, 6))
bp = ax.boxplot(phase_data, labels=labels, patch_artist=True, widths=0.6)
for patch, color in zip(bp["boxes"], colors_list):
    patch.set_facecolor(color)
    patch.set_alpha(0.6)
ax.set_ylabel("Sleep (hours)")
ax.set_title("A: Box Plots", fontweight="bold")
save(fig, "2A_boxplots.png")

# Option B: Beeswarm / strip plot
fig, ax = plt.subplots(figsize=(12, 6))
for i, (data, color, label) in enumerate(zip(phase_data, colors_list, PHASE_ORDER)):
    jitter = np.random.normal(0, 0.12, len(data))
    ax.scatter(np.full_like(data, i) + jitter, data, alpha=0.15, s=10, color=color)
    ax.scatter(i, np.mean(data), color=color, s=120, zorder=5, edgecolors="white", linewidth=1.5)
ax.set_xticks(range(len(PHASE_ORDER)))
ax.set_xticklabels(labels)
ax.set_ylabel("Sleep (hours)")
ax.set_title("B: Strip Plot (dot = mean)", fontweight="bold")
save(fig, "2B_strip.png")

# Option C: Violin plot
fig, ax = plt.subplots(figsize=(12, 6))
parts = ax.violinplot(phase_data, positions=range(len(PHASE_ORDER)), showmedians=True, widths=0.7)
for i, pc in enumerate(parts["bodies"]):
    pc.set_facecolor(colors_list[i])
    pc.set_alpha(0.6)
ax.set_xticks(range(len(PHASE_ORDER)))
ax.set_xticklabels(labels)
ax.set_ylabel("Sleep (hours)")
ax.set_title("C: Violin Plot", fontweight="bold")
save(fig, "2C_violin.png")

# Option D: Ridgeline / joy plot
fig, axes = plt.subplots(len(PHASE_ORDER), 1, figsize=(12, 8), sharex=True)
fig.subplots_adjust(hspace=-0.3)
x_range = np.linspace(0, 12, 200)
for i, (phase, color) in enumerate(zip(PHASE_ORDER, colors_list)):
    ax = axes[i]
    data = nightly[nightly["phase"] == phase]["sleep_hours"].dropna().values
    from scipy.stats import gaussian_kde
    if len(data) > 5:
        kde = gaussian_kde(data, bw_method=0.3)
        density = kde(x_range)
        ax.fill_between(x_range, density, alpha=0.6, color=color)
        ax.plot(x_range, density, color=color, linewidth=1)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, None)
    ax.set_yticks([])
    ax.patch.set_alpha(0)
    ax.spines["left"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["top"].set_visible(False)
    if i < len(PHASE_ORDER) - 1:
        ax.spines["bottom"].set_visible(False)
        ax.tick_params(bottom=False)
    ax.text(-0.01, 0.5, phase, transform=ax.transAxes, ha="right", va="center", fontsize=9)
axes[-1].set_xlabel("Sleep (hours)")
fig.suptitle("D: Ridgeline / Joy Plot", fontweight="bold", y=0.98)
save(fig, "2D_ridgeline.png")

# =========================================================================
# C-explore-3: Awakenings
# =========================================================================
print("\n=== C-explore-3: Awakenings ===")

# Option A: Timeline scatter + rolling
fig, ax = plt.subplots(figsize=(18, 5))
r30_awk = nightly["awakenings"].rolling(30, min_periods=10).mean()
ax.scatter(nightly["night_date"], nightly["awakenings"], alpha=0.1, s=6, color=CALM)
ax.plot(nightly["night_date"], r30_awk, color=ACCENT, linewidth=2)
add_events(ax)
ax.set_ylabel("Awakenings per night")
ax.set_title("A: Scatter + Rolling Average", fontweight="bold")
save(fig, "3A_scatter_rolling.png")

# Option B: Dot matrix / waffle-style (monthly aggregated)
fig, ax = plt.subplots(figsize=(18, 6))
monthly_awk = nightly.set_index("night_date")["awakenings"].resample("M").mean()
months = monthly_awk.index
vals = monthly_awk.values
cmap = plt.cm.YlOrRd
norm = mcolors.Normalize(vmin=0, vmax=10)
for i, (m, v) in enumerate(zip(months, vals)):
    row = i // 12
    col = i % 12
    ax.scatter(col, -row, c=[cmap(norm(v))], s=300, edgecolors="white", linewidth=0.5)
    if not np.isnan(v):
        ax.text(col, -row, f"{v:.0f}", ha="center", va="center", fontsize=7, color="white" if v > 5 else TEXT)
# Year labels
years_seen = set()
for i, m in enumerate(months):
    row = i // 12
    if row not in years_seen:
        ax.text(-1.5, -row, str(m.year), ha="center", va="center", fontsize=9)
        years_seen.add(row)
ax.set_xlim(-2.5, 12.5)
ax.axis("off")
ax.set_title("B: Dot Matrix (monthly avg awakenings, color intensity)", fontweight="bold")
save(fig, "3B_dot_matrix.png")

# Option C: Barcode / stripe
fig, ax = plt.subplots(figsize=(18, 3))
dates_num = mdates.date2num(nightly["night_date"])
for d, a in zip(dates_num, nightly["awakenings"]):
    c = plt.cm.YlOrRd(min(a / 12, 1.0))
    ax.axvline(x=d, color=c, alpha=0.7, linewidth=0.5)
ax.xaxis.set_major_locator(mdates.MonthLocator(interval=6))
ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
ax.set_yticks([])
ax.set_title("C: Barcode Stripe (color = awakenings count)", fontweight="bold")
plt.xticks(rotation=45)
save(fig, "3C_barcode.png")

# =========================================================================
# C-explore-4: Bedtime Drift
# =========================================================================
print("\n=== C-explore-4: Bedtime Drift ===")

bedtime_display = nightly["bedtime_hour"].apply(lambda h: h if h >= 18 else h + 24)
bedtime_30d = bedtime_display.rolling(30, min_periods=10).mean()

# Option A: Scatter + rolling
fig, ax = plt.subplots(figsize=(18, 5))
ax.scatter(nightly["night_date"], bedtime_display, alpha=0.1, s=6, color=CALM)
ax.plot(nightly["night_date"], bedtime_30d, color=ACCENT, linewidth=2)
add_events(ax)
ax.set_yticks([20, 21, 22, 23, 24, 25, 26, 27])
ax.set_yticklabels(["8 PM", "9 PM", "10 PM", "11 PM", "12 AM", "1 AM", "2 AM", "3 AM"])
ax.invert_yaxis()
ax.set_title("A: Scatter + Rolling Average", fontweight="bold")
save(fig, "4A_scatter_rolling.png")

# Option B: Polar / clock chart
fig, ax = plt.subplots(figsize=(10, 10), subplot_kw={"projection": "polar"})
# Convert bedtime hour to angle (24h clock, 0h at top)
angles = (bedtime_display.values / 24) * 2 * np.pi
phase_colors_mapped = [PHASE_COLORS.get(p, "gray") for p in nightly["phase"]]
ax.scatter(angles, np.ones(len(angles)) + np.random.uniform(0, 0.3, len(angles)),
           c=phase_colors_mapped, alpha=0.3, s=8)
# Mark hours
hour_angles = np.array([20, 21, 22, 23, 0, 1, 2, 3]) / 24 * 2 * np.pi
hour_labels = ["8 PM", "9 PM", "10 PM", "11 PM", "12 AM", "1 AM", "2 AM", "3 AM"]
ax.set_xticks(hour_angles)
ax.set_xticklabels(hour_labels)
ax.set_rticks([])
ax.set_title("B: Polar / Clock Chart", fontweight="bold", pad=20)
save(fig, "4B_polar_clock.png")

# Option C: Gradient strip
fig, ax = plt.subplots(figsize=(18, 2.5))
dates_num = mdates.date2num(nightly["night_date"])
cmap = plt.cm.cool
norm = mcolors.Normalize(vmin=20, vmax=27)
for d, bt in zip(dates_num, bedtime_display):
    ax.axvline(x=d, color=cmap(norm(bt)), alpha=0.8, linewidth=0.5)
ax.xaxis.set_major_locator(mdates.MonthLocator(interval=6))
ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
ax.set_yticks([])
sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
cbar = plt.colorbar(sm, ax=ax, orientation="horizontal", pad=0.3, shrink=0.5)
cbar.set_ticks([20, 21, 22, 23, 24, 25, 26, 27])
cbar.set_ticklabels(["8PM", "9PM", "10PM", "11PM", "12AM", "1AM", "2AM", "3AM"])
ax.set_title("C: Gradient Strip (color = bedtime)", fontweight="bold")
plt.xticks(rotation=45)
save(fig, "4C_gradient_strip.png")

# =========================================================================
# C-explore-5: Sleep vs Heart Rate
# =========================================================================
print("\n=== C-explore-5: Sleep vs Heart Rate ===")

# Option A: Dual panel aligned
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(18, 8), sharex=True)
sleep_30d = nightly["sleep_hours"].rolling(30, min_periods=10).mean()
ax1.plot(nightly["night_date"], sleep_30d, color=CALM, linewidth=2)
ax1.set_ylabel("Sleep (hours)")
ax1.set_title("A: Dual Panel Aligned", fontweight="bold")
add_events(ax1)

ax2.plot(rhr["date"], rhr["bpm_30d"], color=ACCENT, linewidth=2)
ax2.set_ylabel("Resting HR (bpm)")
add_events(ax2)
ax2.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
plt.xticks(rotation=45)
save(fig, "5A_dual_panel.png")

# Option B: Connected scatterplot
fig, ax = plt.subplots(figsize=(10, 10))
# Merge on date
merged = nightly[["night_date", "sleep_hours"]].copy()
merged["sleep_30d"] = merged["sleep_hours"].rolling(30, min_periods=10).mean()
rhr_daily = rhr[["date", "bpm_30d"]].rename(columns={"date": "night_date"})
merged = merged.merge(rhr_daily, on="night_date", how="inner").dropna()
# Color by time
colors_time = np.linspace(0, 1, len(merged))
points = np.column_stack([merged["sleep_30d"].values, merged["bpm_30d"].values])
segments = np.column_stack([points[:-1], points[1:]]).reshape(-1, 2, 2)
lc = LineCollection(segments, cmap="viridis", linewidths=1.5, alpha=0.7)
lc.set_array(colors_time[:-1])
ax.add_collection(lc)
ax.autoscale()
ax.set_xlabel("Sleep (hours, 30d avg)")
ax.set_ylabel("Resting HR (bpm, 30d avg)")
plt.colorbar(lc, ax=ax, label="Time progression")
ax.set_title("B: Connected Scatterplot (path over time)", fontweight="bold")
save(fig, "5B_connected_scatter.png")

# Option C: Overlaid area with dual Y
fig, ax1 = plt.subplots(figsize=(18, 6))
ax1.fill_between(nightly["night_date"], 0, sleep_30d, alpha=0.3, color=CALM)
ax1.plot(nightly["night_date"], sleep_30d, color=CALM, linewidth=1.5, label="Sleep")
ax1.set_ylabel("Sleep (hours)", color=CALM)
ax1.set_ylim(3, 9)
ax2 = ax1.twinx()
ax2.plot(rhr["date"], rhr["bpm_30d"], color=ACCENT, linewidth=1.5, label="RHR")
ax2.set_ylabel("Resting HR (bpm)", color=ACCENT)
add_events(ax1)
ax1.set_title("C: Overlaid Area with Dual Y-Axes", fontweight="bold")
fig.legend(loc="lower left", bbox_to_anchor=(0.05, 0.05))
save(fig, "5C_overlaid_dual_y.png")

# =========================================================================
# C-explore-6: Sleep Stages
# =========================================================================
print("\n=== C-explore-6: Sleep Stages ===")

stage_monthly = stages.set_index("night_date")[["Core", "Deep", "REM"]].resample("M").mean().dropna()

# Option A: Stacked bar monthly
fig, ax = plt.subplots(figsize=(18, 6))
stage_monthly.plot.bar(stacked=True, ax=ax, color=["#264653", "#2A9D8F", "#E9C46A"], width=0.8)
xlabels = [d.strftime("%b %Y") for d in stage_monthly.index]
ax.set_xticklabels(xlabels, rotation=45, fontsize=7)
ax.set_ylabel("Hours")
ax.set_title("A: Stacked Bar (monthly avg)", fontweight="bold")
ax.legend(title="Stage")
save(fig, "6A_stacked_bar.png")

# Option B: Stacked area
fig, ax = plt.subplots(figsize=(18, 6))
ax.stackplot(stage_monthly.index, stage_monthly["Core"], stage_monthly["Deep"], stage_monthly["REM"],
             labels=["Core", "Deep", "REM"], colors=["#264653", "#2A9D8F", "#E9C46A"], alpha=0.7)
add_events(ax)
ax.set_ylabel("Hours")
ax.legend(loc="upper right")
ax.set_title("B: Stacked Area (smooth flow)", fontweight="bold")
save(fig, "6B_stacked_area.png")

# Option C: Marimekko / proportional
fig, ax = plt.subplots(figsize=(18, 6))
total = stage_monthly.sum(axis=1)
props = stage_monthly.div(total, axis=0)
ax.stackplot(stage_monthly.index, props["Core"], props["Deep"], props["REM"],
             labels=["Core", "Deep", "REM"], colors=["#264653", "#2A9D8F", "#E9C46A"], alpha=0.7)
add_events(ax)
ax.set_ylabel("Proportion")
ax.set_ylim(0, 1)
ax.legend(loc="upper right")
ax.set_title("C: Proportional Area (stage share over time)", fontweight="bold")
save(fig, "6C_proportional.png")

# Option D: Small multiples
fig, axes = plt.subplots(3, 1, figsize=(18, 8), sharex=True)
for ax, stage, color in zip(axes, ["Core", "Deep", "REM"], ["#264653", "#2A9D8F", "#E9C46A"]):
    nightly_stage = stages.set_index("night_date")[stage].resample("W").mean()
    ax.fill_between(nightly_stage.index, 0, nightly_stage, alpha=0.5, color=color)
    ax.plot(nightly_stage.index, nightly_stage, color=color, linewidth=1)
    add_events(ax)
    ax.set_ylabel(f"{stage} (hrs)")
    ax.set_ylim(0, max(nightly_stage.max() * 1.2, 1))
axes[0].set_title("D: Small Multiples (one per stage)", fontweight="bold")
axes[-1].xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
plt.xticks(rotation=45)
save(fig, "6D_small_multiples.png")

print("\n=== All exploration charts generated ===")
print(f"Output directory: {OUT}")
