import { classifyNewReview, routeNewReview } from "./resolve-ai";
import { evalSet } from "./resolve-eval-set";
import { isOverdue, isUrgent, TARGET_HOURS } from "./resolve-overdue";

/**
 * Impact measured from Resolve's own records, compared with the Phase 1 proposal.
 * Every number here can be re-derived from the activity log or the labelled test set.
 */
export const PHASE1 = {
  baselineSeconds: 72.5, // 10 synthetic reviews handled by hand took 12.08 minutes in total
  targetReductionPct: 60,
  targetRoutingPct: 90,
  targetApprovalPct: 100,
  targetFirstTimeUsersPct: 80,
};
/** Assumption for the weekly estimate, stated on the page. */
export const REVIEWS_PER_WEEK = 30;
export const RESPONSE_TARGETS = TARGET_HOURS;

export const MANUAL_STEPS = [
  "Check each review site for new reviews",
  "Read the review and decide what it is about",
  "Decide who should handle it",
  "Write a reply from scratch",
  "Get the owner's OK for anything involving money",
  "Post the reply",
  "Keep a note of what was done",
];
export const RESOLVE_STEPS = ["Read the drafted reply", "Approve, edit or reject it"];

type ActivityRow = { reviewId: string; action: string; role: string; details: string };
type CaseRow = {
  id: string; missingInfo: boolean; ruleFired: string | null; status: string;
  severity?: string; assignedRole?: string; createdAt?: Date;
};

const HUMAN_ROLES = new Set(["Staff", "Manager", "Owner"]);
const handledPattern = /handled in (\d+(?:\.\d+)?) s/;

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
const round1 = (value: number) => Math.round(value * 10) / 10;

export function measureFromLog(activity: ActivityRow[], cases: CaseRow[]) {
  const timings = activity
    .filter(row => row.action === "approved" && HUMAN_ROLES.has(row.role))
    .map(row => handledPattern.exec(row.details)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  const mid = median(timings);
  const approvedCases = new Set(activity.filter(row => row.action === "approved" && HUMAN_ROLES.has(row.role)).map(row => row.reviewId));
  const posted = activity.filter(row => row.action === "reply_posted" || row.action === "voucher_issued");
  const postedWithApproval = posted.filter(row => approvedCases.has(row.reviewId)).length;
  return {
    handling: {
      measuredApprovals: timings.length,
      medianSeconds: mid === null ? null : round1(mid),
      reductionPct: mid === null ? null : round1((1 - mid / PHASE1.baselineSeconds) * 100),
      weeklyMinutesSaved: mid === null ? null : round1(((PHASE1.baselineSeconds - mid) * REVIEWS_PER_WEEK) / 60),
    },
    approvals: {
      actionsTaken: posted.length,
      withLoggedHumanApproval: postedWithApproval,
      pct: posted.length ? round1((postedWithApproval / posted.length) * 100) : null,
    },
    exceptions: {
      urgentToOwner: cases.filter(row => row.ruleFired?.startsWith("R2")).length,
      needsMoreDetail: cases.filter(row => row.missingInfo).length,
      rejectedByHuman: cases.filter(row => row.status === "Rejected").length,
      possibleDuplicates: cases.filter(row => row.ruleFired?.startsWith("R0")).length,
      overdueUrgent: cases.filter(row => row.createdAt && isUrgent(row as Required<CaseRow>) && isOverdue(row as Required<CaseRow>)).length,
      overdueOther: cases.filter(row => row.createdAt && !isUrgent(row as Required<CaseRow>) && isOverdue(row as Required<CaseRow>)).length,
    },
    totalCases: cases.length,
  };
}

/** Runs the labelled test set through the same classifier and routing rules (Basic mode). */
export async function measureRouting() {
  let category = 0, routing = 0, urgentCaught = 0;
  const urgentTotal = evalSet.filter(item => item.urgent).length;
  for (const item of evalSet) {
    const result = await classifyNewReview(
      { text: item.text, outlet: "Test outlet", rating: item.rating, businessType: item.businessType },
      { aiDisabled: true },
    );
    const routed = routeNewReview(result, result.category === "unclear");
    // Basic mode policy: urgent cases go to the Owner; every other case gets a manager check.
    const expected = item.urgent ? "Owner" : "Manager";
    if (result.category === item.category) category++;
    if (routed.assignedRole === expected) routing++;
    if (item.urgent && routed.assignedRole === "Owner") urgentCaught++;
  }
  return {
    testCases: evalSet.length,
    routingPct: round1((routing / evalSet.length) * 100),
    categoryPct: round1((category / evalSet.length) * 100),
    urgentCaught, urgentTotal,
  };
}
