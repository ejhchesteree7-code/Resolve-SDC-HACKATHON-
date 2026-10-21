import { randomUUID } from "node:crypto";
import { reviewsTable } from "@workspace/db";
import { classifyNewReview, getCategoryLabel, routeNewReview, type ReviewInput } from "./resolve-ai";
import { applyVoucherV1 } from "./resolve-permissions";
import { auditWriter, type Store } from "./resolve-cases";

type ReceivedReview = ReviewInput & { reviewer: string; rating: number };
type Context = { tenantId: string; outletId: string; managerVoucherLimitRm: number; source: "simulated" | "public_page" };

/** Shared ingestion for the existing simulator and public review-received events. */
export async function receiveReview(
  store: Store, input: ReceivedReview, context: Context,
  options: Parameters<typeof classifyNewReview>[1] = {},
) {
  const classification = await classifyNewReview(input, options);
  const routing = routeNewReview(classification);
  return store.transaction(async tx => {
    const id = `review-${randomUUID()}`;
    const voucherAmount = classification.suggestedVoucherRm > 0 ? classification.suggestedVoucherRm : null;
    const v1 = applyVoucherV1(voucherAmount, context.managerVoucherLimitRm);
    const [created] = await tx.insert(reviewsTable).values({
      id, ...input, tenantId: context.tenantId, outletId: context.outletId, source: context.source,
      sentiment: classification.sentiment, language: classification.language,
      category: getCategoryLabel(classification.category), severity: classification.severity,
      reason: classification.reason, confidence: classification.confidence, draftReply: classification.draftReply,
      usedFallback: classification.usedFallback, voucherAmount, assignedRole: routing.assignedRole,
      status: routing.status === "Needs owner" ? "pending_owner" : routing.status,
      ruleFired: routing.ruleFired, missingInfo: false, rejectionReason: null, createdAt: new Date(), ...v1,
    }).returning();
    const log = auditWriter(tx, id, "Resolve", "System");
    await log("review_received", `${context.source === "public_page" ? "Public page" : "Simulated"} review received from ${input.reviewer}`);
    await log("ai_classified", `${classification.usedFallback ? "Basic mode · " : ""}${getCategoryLabel(classification.category)}`);
    await log("routed", routing.ruleFired);
    if (voucherAmount !== null) {
      await log("voucher_proposed", `AI suggested RM ${voucherAmount.toFixed(2)} for human approval`);
      if (v1.assignedRole) await log("escalated", v1.ruleFired!);
    }
    return created!;
  });
}
