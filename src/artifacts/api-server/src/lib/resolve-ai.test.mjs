import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyNewReview, routeNewReview } from "./resolve-ai.ts";

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
