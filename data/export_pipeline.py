"""
Data Pipeline for Motherhood & Sleep project.
Processes raw Apple Health JSON exports into clean, React-ready JSON files.

Outputs:
  - nightly_sleep_processed.json  (A1)
  - resting_hr_processed.json     (A2)
  - sleep_stages_processed.json   (A3)
  - story_metrics.json            (A4)
"""

import pandas as pd
import numpy as np
import json
from datetime import timedelta
from pathlib import Path

# Paths
ROOT = Path(__file__).resolve().parent.parent
DATA_OUT = ROOT / "data"
DATA_OUT.mkdir(exist_ok=True)

# Key dates
PREG1_START = pd.Timestamp("2021-10-03")
CHILD1_BORN = pd.Timestamp("2022-05-07")
PREG2_START = pd.Timestamp("2025-02-17")
CHILD2_BORN = pd.Timestamp("2025-11-10")

PHASE_ORDER = ["Pre-pregnancy", "Pregnancy 1", "Postpartum 1", "Pregnancy 2", "Postpartum 2"]


def get_phase(date):
    if date < PREG1_START:
        return "Pre-pregnancy"
    elif date < CHILD1_BORN:
        return "Pregnancy 1"
    elif date < PREG2_START:
        return "Postpartum 1"
    elif date < CHILD2_BORN:
        return "Pregnancy 2"
    else:
        return "Postpartum 2"


def load_sleep_data():
    with open(ROOT / "sleep_data.json") as f:
        raw = json.load(f)

    df = pd.DataFrame(raw)
    df["startDate"] = pd.to_datetime(df["startDate"].str[:-6])
    df["endDate"] = pd.to_datetime(df["endDate"].str[:-6])
    df["duration_min"] = (df["endDate"] - df["startDate"]).dt.total_seconds() / 60

    stage_map = {
        "HKCategoryValueSleepAnalysisAsleepCore": "Core",
        "HKCategoryValueSleepAnalysisAsleepDeep": "Deep",
        "HKCategoryValueSleepAnalysisAsleepREM": "REM",
        "HKCategoryValueSleepAnalysisAsleepUnspecified": "Asleep",
        "HKCategoryValueSleepAnalysisAwake": "Awake",
        "HKCategoryValueSleepAnalysisInBed": "InBed",
    }
    df["stage"] = df["value"].map(stage_map)

    # Filter to Apple Watch data only (more accurate than iPhone InBed records)
    # Keep all records — iPhone InBed helps with time-in-bed calculation
    # but actual sleep stages come from Watch

    return df


def assign_night(start_dt):
    """Assign a sleep record to a calendar night.
    Records starting before 6 PM belong to the previous night.
    Records starting between 6 PM and 6 AM belong to that night's date.
    """
    if start_dt.hour >= 18:
        return start_dt.date()
    else:
        return (start_dt - timedelta(days=1)).date()


# =============================================================================
# A1: Nightly sleep data
# =============================================================================
def export_nightly_sleep(df):
    print("=== A1: Exporting nightly sleep data ===")

    df["night_date"] = df["startDate"].apply(assign_night)
    df["night_date"] = pd.to_datetime(df["night_date"])

    # Total actual sleep = Core + Deep + REM + Asleep (not InBed, not Awake)
    sleep_stages = ["Core", "Deep", "REM", "Asleep"]
    asleep = df[df["stage"].isin(sleep_stages)]
    awake = df[df["stage"] == "Awake"]

    nightly = (
        asleep.groupby("night_date")
        .agg(
            total_sleep_min=("duration_min", "sum"),
            sleep_segments=("duration_min", "count"),
            first_sleep=("startDate", "min"),
            last_wake=("endDate", "max"),
        )
        .reset_index()
    )

    # Awakenings
    awake_counts = (
        awake.groupby("night_date")
        .agg(awakenings=("duration_min", "count"), awake_min=("duration_min", "sum"))
        .reset_index()
    )
    nightly = nightly.merge(awake_counts, on="night_date", how="left")
    nightly["awakenings"] = nightly["awakenings"].fillna(0).astype(int)
    nightly["awake_min"] = nightly["awake_min"].fillna(0)

    # Derived fields
    nightly["sleep_hours"] = nightly["total_sleep_min"] / 60
    nightly["time_in_bed_min"] = (
        (nightly["last_wake"] - nightly["first_sleep"]).dt.total_seconds() / 60
    )
    nightly["efficiency"] = (
        nightly["total_sleep_min"] / nightly["time_in_bed_min"] * 100
    )

    # Bedtime
    nightly["bedtime_hour"] = (
        nightly["first_sleep"].dt.hour + nightly["first_sleep"].dt.minute / 60
    )

    # Day of week
    nightly["weekday"] = nightly["night_date"].dt.dayofweek  # 0=Mon
    nightly["is_weekend"] = nightly["weekday"].isin([4, 5])  # Fri/Sat nights

    # Season
    month_to_season = {
        12: "Winter", 1: "Winter", 2: "Winter",
        3: "Spring", 4: "Spring", 5: "Spring",
        6: "Summer", 7: "Summer", 8: "Summer",
        9: "Autumn", 10: "Autumn", 11: "Autumn",
    }
    nightly["season"] = nightly["night_date"].dt.month.map(month_to_season)

    # Life phase
    nightly["phase"] = nightly["night_date"].apply(get_phase)

    # Sort
    nightly = nightly.sort_values("night_date").reset_index(drop=True)

    # --- Edge case fixes ---
    # Remove nights with unreasonably low (<10 min) or high (>16h) sleep
    before = len(nightly)
    nightly = nightly[
        (nightly["sleep_hours"] >= 10 / 60) & (nightly["sleep_hours"] <= 16)
    ].reset_index(drop=True)
    removed = before - len(nightly)
    if removed:
        print(f"  Removed {removed} outlier nights (<10min or >16h)")

    # Cap efficiency at 100%
    nightly["efficiency"] = nightly["efficiency"].clip(upper=100)

    # Validate
    gaps = pd.date_range(
        nightly["night_date"].min(), nightly["night_date"].max(), freq="D"
    )
    missing = set(gaps) - set(nightly["night_date"])
    print(f"  Total nights: {len(nightly)}")
    print(f"  Date range: {nightly['night_date'].min().date()} to {nightly['night_date'].max().date()}")
    print(f"  Missing nights (no data): {len(missing)}")
    print(f"  Nights by phase: {dict(nightly['phase'].value_counts())}")

    # Export
    export_cols = [
        "night_date", "sleep_hours", "total_sleep_min", "awakenings", "awake_min",
        "efficiency", "bedtime_hour", "weekday", "is_weekend",
        "season", "phase", "time_in_bed_min", "sleep_segments",
    ]
    out = nightly[export_cols].copy()
    out["night_date"] = out["night_date"].dt.strftime("%Y-%m-%d")
    out["sleep_hours"] = out["sleep_hours"].round(2)
    out["efficiency"] = out["efficiency"].round(1)
    out["bedtime_hour"] = out["bedtime_hour"].round(2)
    out["awake_min"] = out["awake_min"].round(1)
    out["time_in_bed_min"] = out["time_in_bed_min"].round(1)
    out["is_weekend"] = out["is_weekend"].astype(bool)

    path = DATA_OUT / "nightly_sleep_processed.json"
    out.to_json(path, orient="records", indent=2)
    print(f"  -> {path.name} ({len(out)} records)")

    return nightly


# =============================================================================
# A2: Resting heart rate
# =============================================================================
def export_resting_hr(nightly):
    print("\n=== A2: Exporting resting heart rate ===")

    with open(ROOT / "resting_hr_data.json") as f:
        raw = json.load(f)

    rhr = pd.DataFrame(raw)
    rhr["date"] = pd.to_datetime(rhr["startDate"].str[:-6])
    rhr["bpm"] = rhr["value"].astype(float)

    # Aggregate to daily averages (some days have multiple readings)
    rhr["day"] = rhr["date"].dt.date
    daily = rhr.groupby("day").agg(bpm=("bpm", "mean")).reset_index()
    daily["day"] = pd.to_datetime(daily["day"])
    daily = daily.sort_values("day").reset_index(drop=True)

    # Life phase
    daily["phase"] = daily["day"].apply(get_phase)

    # Rolling averages
    daily["bpm_7d"] = daily["bpm"].rolling(7, min_periods=3).mean()
    daily["bpm_30d"] = daily["bpm"].rolling(30, min_periods=10).mean()

    # Round
    daily["bpm"] = daily["bpm"].round(1)
    daily["bpm_7d"] = daily["bpm_7d"].round(1)
    daily["bpm_30d"] = daily["bpm_30d"].round(1)

    print(f"  Total days: {len(daily)}")
    print(f"  Date range: {daily['day'].min().date()} to {daily['day'].max().date()}")
    print(f"  BPM range: {daily['bpm'].min()} - {daily['bpm'].max()}")

    # Align date range with sleep data
    sleep_min = nightly["night_date"].min()
    sleep_max = nightly["night_date"].max()
    daily_aligned = daily[(daily["day"] >= sleep_min) & (daily["day"] <= sleep_max)].copy()
    print(f"  After aligning with sleep date range: {len(daily_aligned)} days")

    out = daily_aligned.copy()
    out["date"] = out["day"].dt.strftime("%Y-%m-%d")
    out = out[["date", "bpm", "bpm_7d", "bpm_30d", "phase"]]

    path = DATA_OUT / "resting_hr_processed.json"
    out.to_json(path, orient="records", indent=2)
    print(f"  -> {path.name} ({len(out)} records)")


# =============================================================================
# A3: Sleep stages nightly breakdown
# =============================================================================
def export_sleep_stages(df):
    print("\n=== A3: Exporting sleep stages ===")

    df["night_date"] = df["startDate"].apply(assign_night)
    df["night_date"] = pd.to_datetime(df["night_date"])

    # Only detailed stages (available from late 2022 with watchOS 9)
    detailed = df[df["stage"].isin(["Core", "Deep", "REM"])]
    if len(detailed) == 0:
        print("  No detailed sleep stage data found!")
        return

    print(f"  Stage data available from: {detailed['startDate'].min().date()}")
    print(f"  Stage data available to: {detailed['startDate'].max().date()}")

    # Nightly breakdown
    stage_nightly = (
        detailed.groupby(["night_date", "stage"])["duration_min"]
        .sum()
        .unstack(fill_value=0)
    )
    stage_nightly = stage_nightly / 60  # to hours

    # Ensure all columns exist
    for col in ["Core", "Deep", "REM"]:
        if col not in stage_nightly.columns:
            stage_nightly[col] = 0.0

    stage_nightly["total_staged"] = stage_nightly[["Core", "Deep", "REM"]].sum(axis=1)
    stage_nightly = stage_nightly.reset_index()

    # Life phase
    stage_nightly["phase"] = stage_nightly["night_date"].apply(get_phase)

    # Remove nights with unreasonably low staged sleep (<30 min total)
    before = len(stage_nightly)
    stage_nightly = stage_nightly[stage_nightly["total_staged"] >= 0.5].reset_index(drop=True)
    removed = before - len(stage_nightly)
    if removed:
        print(f"  Removed {removed} nights with <30min staged sleep")

    print(f"  Nights with stage data: {len(stage_nightly)}")

    out = stage_nightly.copy()
    out["night_date"] = out["night_date"].dt.strftime("%Y-%m-%d")
    out["Core"] = out["Core"].round(2)
    out["Deep"] = out["Deep"].round(2)
    out["REM"] = out["REM"].round(2)
    out["total_staged"] = out["total_staged"].round(2)
    out = out[["night_date", "Core", "Deep", "REM", "total_staged", "phase"]]

    path = DATA_OUT / "sleep_stages_processed.json"
    out.to_json(path, orient="records", indent=2)
    print(f"  -> {path.name} ({len(out)} records)")


# =============================================================================
# A4: Story metrics
# =============================================================================
def export_story_metrics(nightly):
    print("\n=== A4: Calculating story metrics ===")

    ns = nightly.sort_values("night_date").copy()

    # Baseline
    baseline = ns[ns["phase"] == "Pre-pregnancy"]["sleep_hours"].mean()
    recommended = 7.0

    # Cumulative sleep debt (vs baseline)
    ns["debt_vs_baseline"] = (baseline - ns["sleep_hours"]).clip(lower=0)
    ns["cumulative_debt_baseline"] = ns["debt_vs_baseline"].cumsum()

    # Cumulative sleep debt (vs 7h recommended)
    ns["debt_vs_7h"] = (recommended - ns["sleep_hours"]).clip(lower=0)
    ns["cumulative_debt_7h"] = ns["debt_vs_7h"].cumsum()

    # Rolling averages
    ns["sleep_7d"] = ns["sleep_hours"].rolling(7, min_periods=3).mean()
    ns["sleep_30d"] = ns["sleep_hours"].rolling(30, min_periods=10).mean()
    ns["awakenings_7d"] = ns["awakenings"].rolling(7, min_periods=3).mean()
    ns["awakenings_30d"] = ns["awakenings"].rolling(30, min_periods=10).mean()

    # Timeline export (per-night with rolling averages + cumulative debt)
    timeline = ns[[
        "night_date", "sleep_hours", "sleep_7d", "sleep_30d",
        "awakenings", "awakenings_7d", "awakenings_30d",
        "cumulative_debt_baseline", "cumulative_debt_7h", "phase",
    ]].copy()
    timeline["night_date"] = timeline["night_date"].dt.strftime("%Y-%m-%d")
    for col in timeline.columns:
        if timeline[col].dtype == "float64":
            timeline[col] = timeline[col].round(2)

    # Phase-level summary statistics
    phase_stats = []
    for phase in PHASE_ORDER:
        pdata = ns[ns["phase"] == phase]
        if len(pdata) == 0:
            continue
        phase_stats.append({
            "phase": phase,
            "nights": int(len(pdata)),
            "avg_sleep": round(pdata["sleep_hours"].mean(), 2),
            "median_sleep": round(pdata["sleep_hours"].median(), 2),
            "std_sleep": round(pdata["sleep_hours"].std(), 2),
            "min_sleep": round(pdata["sleep_hours"].min(), 2),
            "max_sleep": round(pdata["sleep_hours"].max(), 2),
            "avg_awakenings": round(pdata["awakenings"].mean(), 2),
            "avg_efficiency": round(pdata["efficiency"].mean(), 1),
            "avg_bedtime_hour": round(pdata["bedtime_hour"].mean(), 2),
            "avg_time_in_bed_min": round(pdata["time_in_bed_min"].mean(), 1),
        })

    # Story hook numbers
    total_debt_baseline = round(ns["debt_vs_baseline"].sum(), 0)
    total_debt_7h = round(ns["debt_vs_7h"].sum(), 0)
    worst_night_idx = ns["sleep_hours"].idxmin()
    worst_night = ns.loc[worst_night_idx]

    hook = {
        "baseline_avg_hours": round(baseline, 1),
        "total_debt_vs_baseline_hours": int(total_debt_baseline),
        "total_debt_vs_baseline_days": int(total_debt_baseline // 24),
        "total_debt_vs_7h_hours": int(total_debt_7h),
        "total_debt_vs_7h_days": int(total_debt_7h // 24),
        "worst_night_date": worst_night["night_date"].strftime("%Y-%m-%d"),
        "worst_night_hours": round(worst_night["sleep_hours"], 1),
        "data_start": ns["night_date"].min().strftime("%Y-%m-%d"),
        "data_end": ns["night_date"].max().strftime("%Y-%m-%d"),
        "total_nights": int(len(ns)),
    }

    # Print story hook
    print(f"  Baseline (pre-pregnancy): {hook['baseline_avg_hours']}h/night")
    print(f"  Total sleep debt vs baseline: {hook['total_debt_vs_baseline_hours']}h = {hook['total_debt_vs_baseline_days']} days")
    print(f"  Total sleep debt vs 7h: {hook['total_debt_vs_7h_hours']}h = {hook['total_debt_vs_7h_days']} days")
    print(f"  Worst night: {hook['worst_night_date']} ({hook['worst_night_hours']}h)")
    print(f"  Data span: {hook['data_start']} to {hook['data_end']} ({hook['total_nights']} nights)")

    for ps in phase_stats:
        print(f"  {ps['phase']}: {ps['avg_sleep']}h avg, {ps['avg_awakenings']} awakenings ({ps['nights']} nights)")

    # Assemble and export
    metrics = {
        "hook": hook,
        "phase_stats": phase_stats,
        "timeline": json.loads(timeline.to_json(orient="records")),
    }

    path = DATA_OUT / "story_metrics.json"
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  -> {path.name}")


# =============================================================================
# Main
# =============================================================================
if __name__ == "__main__":
    print("Loading raw sleep data...")
    df = load_sleep_data()
    print(f"  {len(df)} records loaded\n")

    nightly = export_nightly_sleep(df)
    export_resting_hr(nightly)
    export_sleep_stages(df)
    export_story_metrics(nightly)

    print("\n=== All exports complete ===")
