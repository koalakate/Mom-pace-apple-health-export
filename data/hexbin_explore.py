"""Hexbin + KDE density explorations of sleep data."""
import pandas as pd
import numpy as np
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import timedelta

sns.set_theme(style="ticks")

# --- Load & process data (same as notebook) ---
with open('data/nightly_sleep_processed.json') as f:
    nights_raw = json.load(f)

nights = pd.DataFrame(nights_raw)
nights['night_date'] = pd.to_datetime(nights['night_date'])

phase_order = ['Pre-pregnancy', 'Pregnancy 1', 'Postpartum 1', 'Pregnancy 2', 'Postpartum 2']
phase_colors = {
    'Pre-pregnancy': '#2A9D8F',
    'Pregnancy 1': '#FF9F1C',
    'Postpartum 1': '#E63946',
    'Pregnancy 2': '#FF9F1C',
    'Postpartum 2': '#E63946',
}

nights = nights.dropna(subset=['sleep_hours', 'awakenings', 'bedtime_hour', 'efficiency'])
print(f"Loaded {len(nights)} nights")

OUT = 'charts/explore'

# =====================================================================
# 1. Sleep Hours vs Awakenings — hexbin with marginals
# =====================================================================
g = sns.jointplot(
    data=nights, x='sleep_hours', y='awakenings',
    kind='hex', color='#2A9D8F',
    marginal_kws=dict(bins=30),
    joint_kws=dict(gridsize=25, mincnt=1),
    height=8,
)
g.set_axis_labels('Sleep Duration (hours)', 'Awakenings')
g.figure.suptitle('Sleep × Awakenings — All Nights', y=1.02, fontsize=14, fontweight='bold')
g.figure.tight_layout()
g.figure.savefig(f'{OUT}/hex_sleep_awakenings.png', dpi=150, bbox_inches='tight')
plt.close()
print("1/6 hex_sleep_awakenings.png")

# =====================================================================
# 2. Per-phase KDE density clouds — side by side
# =====================================================================
fig, axes = plt.subplots(1, 5, figsize=(24, 5), sharex=True, sharey=True)

for ax, phase in zip(axes, phase_order):
    phase_data = nights[nights['phase'] == phase]
    color = phase_colors[phase]
    cmap = sns.light_palette(color, as_cmap=True)

    if len(phase_data) > 10:
        sns.kdeplot(
            data=phase_data, x='sleep_hours', y='awakenings',
            fill=True, cmap=cmap, levels=8, thresh=0.05, ax=ax,
        )
        ax.scatter(phase_data['sleep_hours'], phase_data['awakenings'],
                   color=color, alpha=0.15, s=8, edgecolors='none')

    ax.set_title(phase, fontsize=11, fontweight='bold', color=color)
    ax.set_xlabel('Sleep (h)')
    ax.set_ylabel('Awakenings' if ax == axes[0] else '')
    ax.set_xlim(0, 11)
    ax.set_ylim(-1, 20)

fig.suptitle('Density Clouds — How Sleep Shifts Across Phases', fontsize=14, fontweight='bold', y=1.02)
fig.tight_layout()
fig.savefig(f'{OUT}/kde_per_phase.png', dpi=150, bbox_inches='tight')
plt.close()
print("2/6 kde_per_phase.png")

# =====================================================================
# 3. Bedtime vs Sleep Duration — hexbin
# =====================================================================
nights_bt = nights.copy()
nights_bt['bedtime_display'] = nights_bt['bedtime_hour'].apply(
    lambda h: h if h >= 18 else h + 24
)

g = sns.jointplot(
    data=nights_bt, x='bedtime_display', y='sleep_hours',
    kind='hex', color='#264653',
    marginal_kws=dict(bins=30),
    joint_kws=dict(gridsize=20, mincnt=1),
    height=8,
)
g.set_axis_labels('Bedtime (hour)', 'Sleep Duration (hours)')
g.ax_joint.set_xticks([21, 22, 23, 24, 25, 26])
g.ax_joint.set_xticklabels(['9PM', '10PM', '11PM', '12AM', '1AM', '2AM'])
g.figure.suptitle('Bedtime × Sleep Duration', y=1.02, fontsize=14, fontweight='bold')
g.figure.tight_layout()
g.figure.savefig(f'{OUT}/hex_bedtime_sleep.png', dpi=150, bbox_inches='tight')
plt.close()
print("3/6 hex_bedtime_sleep.png")

# =====================================================================
# 4. Overlaid KDE contours — all phases together
# =====================================================================
fig, ax = plt.subplots(figsize=(10, 8))

for phase in phase_order:
    phase_data = nights[nights['phase'] == phase]
    color = phase_colors[phase]

    if len(phase_data) > 10:
        sns.kdeplot(
            data=phase_data, x='sleep_hours', y='awakenings',
            levels=4, color=color, linewidths=1.5, alpha=0.8,
            ax=ax, label=phase,
        )

ax.set_xlabel('Sleep Duration (hours)', fontsize=12)
ax.set_ylabel('Awakenings', fontsize=12)
ax.set_xlim(1, 10)
ax.set_ylim(-1, 18)
ax.legend(title='Life Phase', fontsize=10)
ax.set_title('Shifting Density — Sleep Quality Across Motherhood', fontsize=14, fontweight='bold')
fig.tight_layout()
fig.savefig(f'{OUT}/kde_overlaid_contours.png', dpi=150, bbox_inches='tight')
plt.close()
print("4/6 kde_overlaid_contours.png")

# =====================================================================
# 5. Efficiency vs Awakenings — hexbin
# =====================================================================
g = sns.jointplot(
    data=nights, x='awakenings', y='efficiency',
    kind='hex', color='#E63946',
    marginal_kws=dict(bins=25),
    joint_kws=dict(gridsize=20, mincnt=1),
    height=8,
)
g.set_axis_labels('Awakenings per Night', 'Sleep Efficiency (%)')
g.figure.suptitle('Fragmentation × Efficiency', y=1.02, fontsize=14, fontweight='bold')
g.figure.tight_layout()
g.figure.savefig(f'{OUT}/hex_awakenings_efficiency.png', dpi=150, bbox_inches='tight')
plt.close()
print("5/6 hex_awakenings_efficiency.png")

# =====================================================================
# 6. Migration view — centroids with arrows
# =====================================================================
fig, ax = plt.subplots(figsize=(10, 8))

centroids = []
for phase in phase_order:
    phase_data = nights[nights['phase'] == phase]
    color = phase_colors[phase]

    ax.scatter(phase_data['sleep_hours'], phase_data['awakenings'],
               color=color, alpha=0.12, s=15, edgecolors='none')

    cx = phase_data['sleep_hours'].mean()
    cy = phase_data['awakenings'].mean()
    centroids.append((cx, cy))
    ax.scatter(cx, cy, color=color, s=200, edgecolors='white', linewidths=2, zorder=10)
    ax.annotate(phase, (cx, cy), fontsize=9, fontweight='bold', color=color,
                xytext=(8, 8), textcoords='offset points')

for i in range(len(centroids) - 1):
    ax.annotate('', xy=centroids[i+1], xytext=centroids[i],
                arrowprops=dict(arrowstyle='->', color='#555', lw=1.5,
                                connectionstyle='arc3,rad=0.2'))

ax.set_xlabel('Sleep Duration (hours)', fontsize=12)
ax.set_ylabel('Awakenings', fontsize=12)
ax.set_title('The Migration — Where Your Average Night Lives', fontsize=14, fontweight='bold')
fig.tight_layout()
fig.savefig(f'{OUT}/migration_centroids.png', dpi=150, bbox_inches='tight')
plt.close()
print("6/6 migration_centroids.png")

print("\nDone! All charts saved to charts/explore/")
