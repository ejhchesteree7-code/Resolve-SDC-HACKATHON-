export type InsightRow = {
  category: string;
  sentiment: string;
  outlet: string;
  createdAt: Date;
};

export type Insight = {
  title: string;
  count: number;
  period: string;
  flagged: boolean;
  outlet: string;
  action: string;
};

const weekdays = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

// Plain-language next steps for a café team. Keyed by the case category label.
const actions: Record<string, string> = {
  "Slow service": "Check staffing and kitchen prep for the busiest shifts, and tell waiting guests how long it will take.",
  "Order accuracy": "Read each order back to the guest and add a quick check at the pass before food or drinks go out.",
  "Food quality": "Share these cases with the kitchen and check temperature and freshness at the pass.",
  "Food safety": "Owner to review the kitchen process today and contact the guests directly.",
  "Staff attitude": "Manager to talk through these cases with the team and agree how to handle busy moments.",
  "Harassment": "Owner to review these cases today and speak with the team and the guests.",
  "Billing": "Owner to check the payment records and contact the guests directly.",
  "Atmosphere": "Review noise, temperature and seating at the times guests mention.",
  "Value": "Check that menu prices match the bill and that portions feel fair.",
};
const fallbackAction = "Review these cases together and agree one fix with the team.";

// Categories that do not describe a repeatable operational problem.
const ignored = new Set(["Praise", "Unclear", "Other"]);

/**
 * Finds the complaint that keeps coming up this month: the most common negative
 * category for one outlet, and the weekday it clusters on when there is a clear one.
 */
export function computeInsight(rows: InsightRow[], fallbackOutlet: string): Insight {
  const groups = new Map<string, InsightRow[]>();
  for (const row of rows) {
    if (row.sentiment !== "negative" || ignored.has(row.category)) continue;
    const key = `${row.outlet}|${row.category}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let best: InsightRow[] = [];
  for (const group of groups.values()) {
    if (group.length > best.length) best = group;
  }
  if (!best.length) {
    return {
      title: "No repeating complaints this month",
      count: 0,
      period: "this month",
      flagged: false,
      outlet: fallbackOutlet,
      action: "Keep replying quickly. We will flag a pattern as soon as one appears.",
    };
  }

  const category = best[0]!.category;
  const perDay = new Array<number>(7).fill(0);
  for (const row of best) perDay[row.createdAt.getUTCDay()] += 1;
  const peakCount = Math.max(...perDay);
  const peakDay = perDay.indexOf(peakCount);
  const clustered = best.length >= 3 && peakCount >= 2 && peakCount / best.length >= 0.6;

  return {
    title: clustered ? `${category} keeps coming up, mostly on ${weekdays[peakDay]}` : `${category} keeps coming up`,
    count: best.length,
    period: clustered
      ? `${best.length} complaints this month, ${peakCount} on ${weekdays[peakDay]}`
      : `${best.length} complaints this month`,
    flagged: best.length >= 3,
    outlet: best[0]!.outlet,
    action: actions[category] ?? fallbackAction,
  };
}
