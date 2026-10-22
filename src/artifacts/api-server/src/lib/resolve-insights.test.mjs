import assert from "node:assert/strict";
import { test } from "node:test";
import { computeInsight } from "./resolve-insights.ts";

const bangsar = "Brew & Kin — Bangsar";
const friday = (day) => new Date(Date.UTC(2026, 9, day, 20, 0)); // 2, 9, 16, 23, 30 Oct 2026 are Fridays
const row = (category, createdAt, sentiment = "negative") => ({ category, sentiment, outlet: bangsar, createdAt });

test("repeated Friday slow-service complaints are flagged with a next step", () => {
  const insight = computeInsight([
    row("Slow service", friday(2)), row("Slow service", friday(2)), row("Slow service", friday(9)),
    row("Slow service", friday(16)), row("Slow service", new Date(Date.UTC(2026, 9, 14, 6))),
    row("Food quality", friday(9)), row("Praise", friday(9), "positive"),
  ], bangsar);
  assert.match(insight.title, /Slow service keeps coming up, mostly on Fridays/);
  assert.equal(insight.count, 5);
  assert.equal(insight.flagged, true);
  assert.match(insight.period, /4 on Fridays/);
  assert.match(insight.action, /staffing/i);
  assert.equal(insight.outlet, bangsar);
});

test("positive reviews and unclear feedback never create a pattern", () => {
  const insight = computeInsight([
    row("Praise", friday(2), "positive"), row("Praise", friday(9), "positive"),
    row("Unclear", friday(2)), row("Unclear", friday(9)), row("Unclear", friday(16)),
  ], bangsar);
  assert.equal(insight.count, 0);
  assert.equal(insight.flagged, false);
  assert.equal(insight.outlet, bangsar);
});

test("a spread-out category is reported without a weekday and not flagged below three", () => {
  const insight = computeInsight([
    row("Order accuracy", new Date(Date.UTC(2026, 9, 5, 6))), row("Order accuracy", new Date(Date.UTC(2026, 9, 8, 6))),
  ], bangsar);
  assert.equal(insight.title, "Order accuracy keeps coming up");
  assert.equal(insight.flagged, false);
});
