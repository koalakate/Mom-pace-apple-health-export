"""Process raw sleep data into per-night segment rectangles for the Racetrack viz."""
import json
from datetime import datetime, timedelta
from collections import defaultdict

# Load raw sleep records
with open('sleep_data.json') as f:
    raw = json.load(f)

# Stage mapping — only actual sleep stages (not InBed, not Awake)
SLEEP_STAGES = {
    'HKCategoryValueSleepAnalysisAsleepCore': 'Core',
    'HKCategoryValueSleepAnalysisAsleepDeep': 'Deep',
    'HKCategoryValueSleepAnalysisAsleepREM': 'REM',
    'HKCategoryValueSleepAnalysisAsleepUnspecified': 'Asleep',
}

# Phase boundaries
PREG1_START = datetime(2021, 10, 3)
CHILD1_BORN = datetime(2022, 5, 7)
PREG2_START = datetime(2025, 2, 17)
CHILD2_BORN = datetime(2025, 11, 10)

def get_phase(dt):
    if dt < PREG1_START: return 'Pre-pregnancy'
    elif dt < CHILD1_BORN: return 'Pregnancy 1'
    elif dt < PREG2_START: return 'Postpartum 1'
    elif dt < CHILD2_BORN: return 'Pregnancy 2'
    else: return 'Postpartum 2'

def parse_dt(s):
    return datetime.strptime(s[:-6], '%Y-%m-%d %H:%M:%S')

def night_date(dt):
    """If before 6 PM, belongs to previous night."""
    if dt.hour < 18:
        return (dt - timedelta(days=1)).strftime('%Y-%m-%d')
    return dt.strftime('%Y-%m-%d')

# Group sleep segments by night
nights = defaultdict(list)

for rec in raw:
    stage = SLEEP_STAGES.get(rec['value'])
    if not stage:
        continue
    start = parse_dt(rec['startDate'])
    end = parse_dt(rec['endDate'])
    nd = night_date(start)
    nights[nd].append({
        'start': start,
        'end': end,
        'stage': stage,
    })

# Process each night: sort segments, compute relative positions
# Anchor everything to a "night window" starting at 20:00 (8 PM)
NIGHT_ANCHOR_HOUR = 20  # 8 PM
NIGHT_WINDOW_HOURS = 14  # 8 PM to 10 AM next day

result = []
for nd in sorted(nights.keys()):
    segs = sorted(nights[nd], key=lambda s: s['start'])

    # Night anchor: 8 PM on the night_date
    anchor = datetime.strptime(nd, '%Y-%m-%d').replace(hour=NIGHT_ANCHOR_HOUR)

    phase = get_phase(datetime.strptime(nd, '%Y-%m-%d'))

    # Merge overlapping/adjacent segments (within 2 min)
    merged = []
    for seg in segs:
        # Convert to hours relative to anchor
        start_h = (seg['start'] - anchor).total_seconds() / 3600
        end_h = (seg['end'] - anchor).total_seconds() / 3600

        # Clamp to window
        if end_h < 0 or start_h > NIGHT_WINDOW_HOURS:
            continue
        start_h = max(0, start_h)
        end_h = min(NIGHT_WINDOW_HOURS, end_h)

        dur_min = (end_h - start_h) * 60
        if dur_min < 1:
            continue

        if merged and (start_h - merged[-1]['end_h']) < 0.05:  # < 3 min gap = merge
            merged[-1]['end_h'] = end_h
        else:
            merged.append({'start_h': round(start_h, 3), 'end_h': round(end_h, 3)})

    if not merged:
        continue

    # Total sleep
    total_sleep_h = sum(s['end_h'] - s['start_h'] for s in merged)

    result.append({
        'night_date': nd,
        'phase': phase,
        'sleep_hours': round(total_sleep_h, 2),
        'segments': [{'s': seg['start_h'], 'e': seg['end_h']} for seg in merged],
    })

print(f"Processed {len(result)} nights with segments")
print(f"Sample night: {json.dumps(result[0], indent=2)}")
print(f"Sample late night: {json.dumps(result[-10], indent=2)}")

# Stats
seg_counts = [len(n['segments']) for n in result]
print(f"Segments per night: min={min(seg_counts)}, max={max(seg_counts)}, avg={sum(seg_counts)/len(seg_counts):.1f}")

# Save
with open('web/public/data/sleep_segments_racetrack.json', 'w') as f:
    json.dump(result, f)
print(f"Saved to web/public/data/sleep_segments_racetrack.json ({len(result)} nights)")
