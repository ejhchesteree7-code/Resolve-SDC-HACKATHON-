/**
 * Duplicate and spam check for reviews arriving from the public review page.
 * A flagged review is never hidden or deleted (that would be review gating):
 * it is kept, shown publicly as usual, and sent to a person with a clear reason.
 */
export const DUPLICATE_RULES = {
  sameTextHours: 24,        // identical wording at the same outlet within a day
  sameReviewerMinutes: 30,  // same display name at the same outlet within half an hour
  burstMinutes: 5,          // many reviews at one outlet in a few minutes
  burstCount: 5,
};

export type RecentReview = { reviewer: string; text: string; createdAt: Date };
export type DuplicateFlag = { kind: "same_text" | "same_reviewer" | "burst"; reason: string };

/** Lowercase, drop punctuation and repeated spaces, so trivial edits still match. */
export function normaliseText(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function ago(from: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((now.getTime() - from.getTime()) / 60_000));
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

/**
 * Checks a new public review against recent public reviews at the same outlet.
 * The first rule that matches wins; returns null when nothing looks repeated.
 */
export function checkDuplicate(
  incoming: { reviewer: string; text: string },
  recent: RecentReview[],
  now = new Date(),
): DuplicateFlag | null {
  const within = (row: RecentReview, minutes: number) => now.getTime() - row.createdAt.getTime() <= minutes * 60_000;
  const text = normaliseText(incoming.text);
  const sameText = recent
    .filter(row => within(row, DUPLICATE_RULES.sameTextHours * 60) && text.length > 0 && normaliseText(row.text) === text)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (sameText) {
    return { kind: "same_text", reason: `Possible duplicate: same wording as a review posted ${ago(sameText.createdAt, now)}.` };
  }
  const name = incoming.reviewer.trim().toLowerCase();
  const sameReviewer = recent
    .filter(row => within(row, DUPLICATE_RULES.sameReviewerMinutes) && row.reviewer.trim().toLowerCase() === name)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (sameReviewer) {
    return { kind: "same_reviewer", reason: `Possible duplicate: ${incoming.reviewer.trim()} already posted a review ${ago(sameReviewer.createdAt, now)}.` };
  }
  const burst = recent.filter(row => within(row, DUPLICATE_RULES.burstMinutes)).length;
  if (burst + 1 >= DUPLICATE_RULES.burstCount) {
    return { kind: "burst", reason: `Possible spam: ${burst + 1} reviews at this outlet in ${DUPLICATE_RULES.burstMinutes} minutes.` };
  }
  return null;
}
