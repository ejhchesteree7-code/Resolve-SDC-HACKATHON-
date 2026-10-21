import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { activityTable, db, reviewsTable } from "@workspace/db";
import { applyVoucherV1, authorize, type User } from "./resolve-permissions";

export type Store = Pick<typeof db, "select" | "transaction">;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class CaseError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
type Changes = { draftReply?: string; voucherAmount?: number | null; reason?: string };

export function auditWriter(tx: Transaction, reviewId: string, actor: string, role: string) {
  return async (action: string, details: string) => {
    await tx.insert(activityTable).values({
      id: randomUUID(), reviewId, actor, role, action, details, createdAt: new Date(),
    });
  };
}

export async function changeCase(
  store: Store, user: User, id: string, action: "edit" | "approve" | "reject", changes: Changes,
) {
  return store.transaction(async (tx) => {
    const [existing] = await tx.select().from(reviewsTable).where(eq(reviewsTable.id, id)).for("update");
    if (!existing) throw new CaseError("Case not found.", 404);
    const voucher = changes.voucherAmount === undefined ? existing.voucherAmount : changes.voucherAmount;
    // Authorization happens before *any* write, including proposal/escalation logs.
    authorize(user, action, action === "approve" ? { ...existing, voucherAmount: voucher } : existing);
    if (changes.voucherAmount !== undefined) authorize(user, "voucher", existing);
    const reply = changes.draftReply ?? existing.draftReply;
    if (action !== "reject" && !reply.trim()) throw new CaseError("A reply is required.", 400);
    const log = auditWriter(tx, existing.id, user.id, user.role);
    if (action === "reject") {
      const [row] = await tx.update(reviewsTable).set({
        status: "Rejected", rejectionReason: changes.reason,
      }).where(eq(reviewsTable.id, id)).returning();
      await log("rejected", changes.reason!);
      return row!;
    }
    const v1 = applyVoucherV1(voucher, user.managerVoucherLimitRm);
    const proposal = changes.voucherAmount !== undefined || (action === "edit" && v1.assignedRole === "Owner");
    if (proposal) {
      await log("voucher_proposed", voucher === null ? "Voucher proposal removed" : `Proposed RM ${voucher.toFixed(2)} voucher`);
      if (v1.assignedRole === "Owner") await log("escalated", v1.ruleFired!);
    }
    if (action === "edit") {
      const [row] = await tx.update(reviewsTable).set({
        draftReply: reply, voucherAmount: voucher, ...v1,
      }).where(eq(reviewsTable.id, id)).returning();
      await log("reply_updated", "Reply draft or voucher proposal updated");
      return row!;
    }
    const [row] = await tx.update(reviewsTable).set({
      draftReply: reply, finalReply: reply, voucherAmount: voucher, status: "Resolved",
    }).where(eq(reviewsTable.id, id)).returning();
    await log("approved", "Reply approved by human reviewer");
    await log("reply_posted", "Reply posted (simulated)");
    if (voucher !== null && voucher > 0) await log("voucher_issued", `Synthetic RM ${voucher.toFixed(2)} voucher issued`);
    await log("resolved", "Case resolved");
    return row!;
  });
}
