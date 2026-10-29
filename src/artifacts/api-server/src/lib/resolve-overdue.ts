/**
 * Response targets for open cases. The inbox shows the same rule (lib/overdue.ts in the web app).
 * Urgent = high severity or waiting for the Owner (safety, money, harassment).
 */
export const TARGET_HOURS = { urgent: 2, normal: 24 };

const CLOSED = new Set(["Resolved", "Rejected"]);

export type AgeCase = { status: string; severity: string; assignedRole: string; createdAt: Date };

export function isOverdue(row: AgeCase, now = Date.now()): boolean {
  if (CLOSED.has(row.status)) return false;
  const urgent = row.severity === "high" || row.assignedRole === "Owner";
  const target = (urgent ? TARGET_HOURS.urgent : TARGET_HOURS.normal) * 3_600_000;
  return now - row.createdAt.getTime() > target;
}

export function isUrgent(row: AgeCase): boolean {
  return row.severity === "high" || row.assignedRole === "Owner";
}
