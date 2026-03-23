import { timeWeek, timeParse } from 'd3';

const parseDate = timeParse('%Y-%m-%d');

export const PHASE_COLORS = {
  'Pre-pregnancy': '#2A9D8F',
  'Pregnancy 1': '#FF9F1C',
  'Postpartum 1': '#E63946',
  'Pregnancy 2': '#FF9F1C',
  'Postpartum 2': '#E63946',
};

/** Parse date strings into Date objects and add derived fields */
export function enrichNights(nights) {
  return nights.map((d) => ({
    ...d,
    date: parseDate(d.night_date),
    color: PHASE_COLORS[d.phase] || '#999',
  }));
}

/** Group nights by ISO week for weekly aggregation */
export function groupByWeek(nights) {
  const weeks = new Map();
  for (const night of nights) {
    const weekStart = timeWeek.floor(night.date);
    const key = weekStart.toISOString();
    if (!weeks.has(key)) weeks.set(key, { weekStart, nights: [] });
    weeks.get(key).nights.push(night);
  }
  return Array.from(weeks.values()).sort(
    (a, b) => a.weekStart - b.weekStart
  );
}
