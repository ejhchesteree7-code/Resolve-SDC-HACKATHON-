import { randomUUID } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { reviewsTable } from "@workspace/db";
import { checkDuplicate, DUPLICATE_RULES } from "./resolve-duplicates";
import { classifyNewReview, getCategoryLabel, routeNewReview, type ReviewInput } from "./resolve-ai";
import { applyVoucherV1 } from "./resolve-permissions";
import { auditWriter, type Store } from "./resolve-cases";

type ReceivedReview = ReviewInput & { reviewer: string; rating: number };
type Context = {
  tenantId: string; outletId: string; managerVoucherLimitRm: number; source: "simulated" | "public_page";
  businessType?: string | null;
};

/** Shared ingestion for the existing simulator and public review-received events. */
export async function receiveReview(
  store: Store, input: ReceivedReview, context: Context,
  options: Parameters<typeof classifyNewReview>[1] = {},
) {
  const classification = await classifyNewReview({ ...input, businessType: context.businessType }, options);
  // A vague review has no actionable detail, so a human must ask the guest for more.
  const missingInfo = classification.category === "unclear";
  const routing = routeNewReview(classification, missingInfo);
  return store.transaction(async tx => {
    const id = `review-${randomUUID()}`;
    // Duplicate/spam check: only for the public review page (the simulator reuses sample texts on purpose).
    const recent = context.source === "public_page" ? await tx.select({
      reviewer: reviewsTable.reviewer, text: reviewsTable.text, createdAt: reviewsTable.createdAt,
    }).from(reviewsTable).where(and(
      eq(reviewsTable.tenantId, context.tenantId), eq(reviewsTable.outletId, context.outletId),
      eq(reviewsTable.source, "public_page"),
      gte(reviewsTable.createdAt, new Date(Date.now() - DUPLICATE_RULES.sameTextHours * 3600_000)),
    )) : [];
    const duplicate = checkDuplicate(input, recent);
    // A flagged review is kept and shown as usual, but a person checks it first: at least a
    // Manager (an urgent case stays with the Owner) and no automatic voucher suggestion.
    if (duplicate && routing.assignedRole !== "Owner") {
      routing.assignedRole = "Manager";
      routing.status = "Needs approval";
    }
    const originalRule = routing.ruleFired;
    if (duplicate) routing.ruleFired = `R0 · ${duplicate.kind === "burst" ? "Possible spam" : "Possible duplicate"} → ${routing.assignedRole}`;
    const reason = duplicate ? `${duplicate.reason} ${classification.reason}` : classification.reason;
    const suggested = duplicate ? 0 : classification.suggestedVoucherRm;
    const voucherAmount = suggested > 0 ? suggested : null;
    const v1 = applyVoucherV1(voucherAmount, context.managerVoucherLimitRm);
    const [created] = await tx.insert(reviewsTable).values({
      id, ...input, tenantId: context.tenantId, outletId: context.outletId, source: context.source,
      sentiment: classification.sentiment, language: classification.language,
      category: getCategoryLabel(classification.category, context.businessType), severity: classification.severity,
      reason, confidence: classification.confidence, draftReply: classification.draftReply,
      usedFallback: classification.usedFallback, voucherAmount, assignedRole: routing.assignedRole,
      status: routing.status === "Needs owner" ? "pending_owner" : routing.status,
      ruleFired: routing.ruleFired, missingInfo, rejectionReason: null, createdAt: new Date(), ...v1,
    }).returning();
    const log = auditWriter(tx, id, "Resolve", "System");
    await log("review_received", `${context.source === "public_page" ? "Public page" : "Simulated"} review received from ${input.reviewer}`);
    await log("ai_classified", `${classification.usedFallback ? "Basic mode · " : ""}${getCategoryLabel(classification.category, context.businessType)}`);
    if (duplicate) await log("flagged_duplicate", `${duplicate.reason} Usual rule: ${originalRule}. No voucher suggested.`);
    await log("routed", routing.ruleFired);
    if (voucherAmount !== null) {
      await log("voucher_proposed", `AI suggested RM ${voucherAmount.toFixed(2)} for human approval`);
      if (v1.assignedRole) await log("escalated", v1.ruleFired!);
    }
    return created!;
  });
}
