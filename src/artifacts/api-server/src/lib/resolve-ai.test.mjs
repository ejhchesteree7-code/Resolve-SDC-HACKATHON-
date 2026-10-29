import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyNewReview, getCategoryLabel, routeNewReview } from "./resolve-ai.ts";

const testReview = {
  text: "Tunggu 40 minit, staff rude gila.",
  outlet: "Brew & Kin — Bangsar",
  rating: 2,
};

test("the Manglish wait-and-rude review gets a medium service case and Manager routing", async () => {
  const result = await classifyNewReview(testReview, { aiDisabled: true });
  const routing = routeNewReview(result);

  assert.equal(result.category, "service_speed");
  assert.equal(result.severity, "medium");
  assert.equal(result.language, "Manglish");
  assert.match(result.draftReply, /Brew & Kin — Bangsar/);
  assert.equal(result.usedFallback, true);
  assert.equal(routing.assignedRole, "Manager");
  assert.match(routing.ruleFired, /R1.*needs_human/);
});

test("AI_DISABLED completes classification without making an AI request and marks Basic mode", async () => {
  const previousValue = process.env.AI_DISABLED;
  process.env.AI_DISABLED = "true";
  let calls = 0;
  try {
    const result = await classifyNewReview(testReview, {
      requestAi: async () => {
        calls += 1;
        return "{}";
      },
    });
    const routing = routeNewReview(result);

    assert.equal(calls, 0);
    assert.equal(result.usedFallback, true);
    assert.equal(result.confidence, 0.5);
    assert.equal(routing.status, "Needs approval");
  } finally {
    if (previousValue === undefined) delete process.env.AI_DISABLED;
    else process.env.AI_DISABLED = previousValue;
  }
});

test("malformed AI JSON uses the keyword fallback", async () => {
  const result = await classifyNewReview(testReview, {
    requestAi: async () => "```json\n{not valid json}\n```",
  });

  assert.equal(result.category, "service_speed");
  assert.equal(result.usedFallback, true);
  assert.equal(result.confidence, 0.5);
});

test("valid AI JSON is used once and numeric suggestions are clamped", async () => {
  let calls = 0;
  const result = await classifyNewReview(testReview, {
    requestAi: async () => {
      calls += 1;
      return JSON.stringify({
        sentiment: "neg",
        category: "service_speed",
        severity: "med",
        language: "mixed",
        draft_reply: "Hi, sorry you had to wait at Brew & Kin.",
        reason: "The review reports a long wait.",
        confidence: 1.2,
        suggested_voucher_rm: 45,
      });
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.usedFallback, false);
  assert.equal(result.confidence, 1);
  assert.equal(result.suggestedVoucherRm, 30);
  assert.equal(result.language, "Manglish");
});

const outlet = "Brew & Kin — Bangsar";

test("Basic mode sends a food-safety review to the Owner, not the Manager", async () => {
  const result = await classifyNewReview(
    { text: "I got sick after eating the chicken rice. Stomach pain the whole night.", outlet, rating: 1 },
    { aiDisabled: true },
  );
  const routing = routeNewReview(result);
  assert.equal(result.usedFallback, true);
  assert.equal(result.category, "food_safety");
  assert.equal(result.severity, "high");
  assert.equal(routing.assignedRole, "Owner");
  assert.match(routing.ruleFired, /R2/);
});

test("a billing or refund dispute is high severity and goes to the Owner", async () => {
  const result = await classifyNewReview(
    { text: "Charged me twice on my card and the cashier was rude. I want a full refund, RM68.", outlet, rating: 1 },
    { aiDisabled: true },
  );
  const routing = routeNewReview(result);
  assert.equal(result.category, "billing");
  assert.equal(result.severity, "high");
  assert.equal(routing.assignedRole, "Owner");
  assert.doesNotMatch(result.draftReply, /refund(ed)? (you|in full)|we will refund/i);
});

test("slow Friday service and a wrong oat-milk order are classified for the Manager", async () => {
  const slow = await classifyNewReview(
    { text: "Waited 40 minutes for my food on Friday night.", outlet, rating: 2 },
    { aiDisabled: true },
  );
  const wrong = await classifyNewReview(
    { text: "Order salah lagi. I asked for oat milk, you gave me normal milk.", outlet, rating: 2 },
    { aiDisabled: true },
  );
  assert.equal(slow.category, "service_speed");
  assert.equal(wrong.category, "order_accuracy");
  assert.equal(routeNewReview(slow).assignedRole, "Manager");
  assert.equal(routeNewReview(wrong).assignedRole, "Manager");
});

test("a vague review is flagged as missing information and handed to a human", async () => {
  const result = await classifyNewReview({ text: "It was okay, I guess.", outlet, rating: 3 }, { aiDisabled: true });
  const routing = routeNewReview(result, result.category === "unclear");
  assert.equal(result.category, "unclear");
  assert.equal(routing.assignedRole, "Manager");
  assert.match(routing.ruleFired, /R1/);
});

test("a hair salon uses its own words: hygiene complaints go to the Owner", async () => {
  const salon = (text, rating) => classifyNewReview({ text, outlet: "Glow & Co — SS15", rating, businessType: "salon" }, { aiDisabled: true });
  const hygiene = await salon("Scissors were not cleaned between customers. Very worrying.", 1);
  assert.equal(hygiene.category, "food_safety");
  assert.equal(hygiene.severity, "high");
  assert.match(hygiene.reason, /hygiene & safety/);
  assert.match(hygiene.draftReply, /Hygiene and your safety come first/);
  assert.equal(routeNewReview(hygiene).assignedRole, "Owner");
  const wait = await salon("Waited 45 minutes past my booking time.", 2);
  assert.equal(wait.category, "service_speed");
  assert.match(wait.draftReply, /appointments/);
  const wrong = await salon("Asked for a light trim but it's too short now.", 2);
  assert.equal(wrong.category, "order_accuracy");
  // Café-only food words do not misfire for a salon ("hair in" is not a food safety issue here).
  const praise = await salon("Love the new colour, the hair in the photos looks exactly like mine!", 5);
  assert.equal(praise.category, "praise");
  assert.equal(getCategoryLabel("food_safety", "salon"), "Hygiene & safety");
  assert.equal(getCategoryLabel("food_safety"), "Food safety");
});

test("impact: routing on the labelled test set meets the Phase 1 target, every urgent case reaches the Owner", async () => {
  const { measureRouting } = await import("./resolve-impact.ts");
  const result = await measureRouting();
  assert.ok(result.testCases >= 40);
  assert.ok(result.routingPct >= 90, `routing ${result.routingPct}%`);
  assert.equal(result.urgentCaught, result.urgentTotal);
});

test("impact: figures are derived from the activity log", async () => {
  const { measureFromLog } = await import("./resolve-impact.ts");
  const log = [
    { reviewId: "a", action: "approved", role: "Manager", details: "Reply approved by human reviewer · handled in 20.0 s" },
    { reviewId: "a", action: "reply_posted", role: "Manager", details: "Reply posted (simulated)" },
    { reviewId: "b", action: "approved", role: "Owner", details: "Reply approved by human reviewer · handled in 30.0 s" },
    { reviewId: "b", action: "reply_posted", role: "Owner", details: "Reply posted (simulated)" },
    { reviewId: "b", action: "voucher_issued", role: "Owner", details: "Synthetic RM 10.00 voucher issued" },
    { reviewId: "c", action: "approved", role: "Manager", details: "Reply approved by human reviewer" },
    { reviewId: "c", action: "reply_posted", role: "Manager", details: "Reply posted (simulated)" },
    { reviewId: "d", action: "reply_posted", role: "System", details: "Not approved by a person" },
  ];
  const cases = [
    { id: "a", missingInfo: false, ruleFired: "R4 · Negative sentiment → Manager", status: "Resolved" },
    { id: "b", missingInfo: false, ruleFired: "R2 · High severity → Owner", status: "Resolved" },
    { id: "e", missingInfo: true, ruleFired: "R1 · Low confidence / needs_human → Manager", status: "Rejected" },
  ];
  const result = measureFromLog(log, cases);
  assert.equal(result.handling.measuredApprovals, 2);
  assert.equal(result.handling.medianSeconds, 25);
  assert.equal(result.handling.reductionPct, 65.5);
  assert.deepEqual(result.approvals, { actionsTaken: 5, withLoggedHumanApproval: 4, pct: 80 });
  assert.deepEqual(result.exceptions, { urgentToOwner: 1, needsMoreDetail: 1, rejectedByHuman: 1 });
});
