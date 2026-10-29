export type Action = "health" | "view" | "create" | "edit" | "approve" | "voucher" | "reject" | "activity" | "insights";
export type User = {
  id: string;
  role: string;
  tenantId: string;
  outletId: string;
  managerVoucherLimitRm: number;
};
export type PermissionCase = {
  tenantId: string;
  outletId: string;
  status: string;
  sentiment: string;
  severity: string;
  assignedRole: string;
  voucherAmount: number | null;
  missingInfo?: boolean;
  usedFallback?: boolean;
  confidence?: number;
};
export class PermissionDenied extends Error {
  status = 403;
}

/** The only role/scope policy used by Resolve API routes. */
export function authorize(user: User | null, action: Action, review: PermissionCase | null): void {
  const deny = (message: string): never => {
    // Deliberate console output for denied actions, as required by the demo audit policy.
    console.log(JSON.stringify({ event: "authorization_denied", userId: user?.id ?? null, action, message }));
    throw new PermissionDenied(message);
  };
  if (action === "health") return;
  if (!user || !["Staff", "Manager", "Owner"].includes(user.role)) deny("Please log in.");
  const actor = user!;
  if (review && (review.tenantId !== actor.tenantId || (actor.role !== "Owner" && review.outletId !== actor.outletId))) {
    deny("This case is outside your tenant or outlet.");
  }
  if (action === "activity" && actor.role === "Staff") deny("Staff cannot view the activity log.");
  if (["view", "create", "activity", "insights"].includes(action)) return;
  if (!review) deny("A case is required for this action.");
  const target = review!;
  if (["Resolved", "Rejected"].includes(target.status)) deny("This case is closed and cannot be changed.");
  if (actor.role === "Owner") return;
  if (target.severity === "high") deny("High-severity cases require Owner approval.");
  if (action === "voucher") {
    if (actor.role === "Staff") deny("Only a Manager or Owner can propose vouchers.");
    return; // Managers may propose above their limit; V1 escalates rather than approves.
  }
  if (actor.role === "Manager") {
    if (target.assignedRole === "Owner" || target.status === "pending_owner" ||
        (target.voucherAmount !== null && target.voucherAmount > actor.managerVoucherLimitRm)) {
      deny("This case requires Owner approval.");
    }
    return;
  }
  const simple = target.assignedRole === "Staff" && target.sentiment !== "negative" &&
    target.severity === "low" && !target.missingInfo && !target.usedFallback &&
    (target.confidence ?? 1) >= 0.6 && target.voucherAmount === null;
  if (!simple) deny("Staff may only edit or approve praise and simple, low-severity reviews without vouchers.");
}

export function applyVoucherV1(valueRm: number | null, limit: number) {
  return valueRm !== null && valueRm > limit
    ? { status: "pending_owner", assignedRole: "Owner", ruleFired: `V1 · Voucher above RM ${limit} → Owner` }
    : {};
}
