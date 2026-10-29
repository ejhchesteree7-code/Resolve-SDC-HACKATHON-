import type { Review } from '@workspace/api-client-react';

/**
 * Response targets. Keep in step with the server's resolve-overdue.ts (used by Impact).
 * Urgent = high severity or waiting for the Owner (safety, money, harassment).
 */
export const TARGET_HOURS = { urgent: 2, normal: 24 };

const CLOSED = new Set(['Resolved', 'Rejected']);

export type OverdueInfo = { overdue: boolean; urgent: boolean; targetHours: number; openHours: number; label: string };

function duration(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

export function overdueInfo(review: Pick<Review, 'status' | 'severity' | 'assignedRole' | 'createdAt'>, now = Date.now()): OverdueInfo {
  const urgent = review.severity === 'high' || review.assignedRole === 'Owner';
  const targetHours = urgent ? TARGET_HOURS.urgent : TARGET_HOURS.normal;
  const openHours = (now - new Date(review.createdAt).getTime()) / 3_600_000;
  const overdue = !CLOSED.has(review.status) && openHours > targetHours;
  return { overdue, urgent, targetHours, openHours, label: `Overdue · open ${duration(openHours)}` };
}

/** Overdue urgent cases first, then other overdue cases, then everything else (newest first). */
export function sortForAttention<T extends Pick<Review, 'status' | 'severity' | 'assignedRole' | 'createdAt'>>(reviews: T[], now = Date.now()): T[] {
  const rank = (review: T) => {
    const info = overdueInfo(review, now);
    return info.overdue ? (info.urgent ? 0 : 1) : 2;
  };
  return [...reviews].sort((a, b) => rank(a) - rank(b) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
