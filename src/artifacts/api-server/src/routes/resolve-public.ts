import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { activityTable, db, reviewsTable, tenantsTable } from "@workspace/db";
import { ListPublicReviewsResponse, ReceivePublicReviewBody, ReceivePublicReviewResponse } from "@workspace/api-zod";
import { receiveReview } from "../lib/resolve-received";
import type { Store } from "../lib/resolve-cases";
import type { classifyNewReview } from "../lib/resolve-ai";

// Public ids bind to server-controlled demo tenant/outlet identities.
const outlets = [
  { id: "bangsar", outletId: "Brew & Kin — Bangsar", tenantId: "resolve-demo" },
  { id: "mont-kiara", outletId: "Brew & Kin — Mont Kiara", tenantId: "resolve-demo" },
];

export function createPublicRouter(
  store: Store = db, classificationOptions: Parameters<typeof classifyNewReview>[1] = {},
): IRouter {
  const router: IRouter = Router();
  router.get("/public/outlets/:outletId/reviews", async (req, res): Promise<void> => {
    const outlet = outlets.find(item => item.id === req.params.outletId);
    if (!outlet) { res.status(404).json({ error: "Demo outlet not found." }); return; }
    // Projection is deliberately explicit: no drafts, IDs, staff, routing or voucher fields.
    // This endpoint performs SELECTs only; it never seeds or changes data.
    const rows = await store.select({
      alias: reviewsTable.reviewer, rating: reviewsTable.rating, text: reviewsTable.text,
      date: reviewsTable.createdAt,
      posted_reply: sql<string | null>`CASE WHEN ${reviewsTable.status} = 'Resolved'
        AND EXISTS (SELECT 1 FROM ${activityTable} AS posted
          WHERE posted.review_id = "resolve_reviews"."id" AND posted.action = 'reply_posted')
        THEN ${reviewsTable.finalReply} ELSE NULL END`,
    }).from(reviewsTable).where(and(
      eq(reviewsTable.tenantId, outlet.tenantId), eq(reviewsTable.outletId, outlet.outletId),
    )).orderBy(desc(reviewsTable.createdAt));
    res.json(ListPublicReviewsResponse.parse(rows.map(row => ({ ...row, date: row.date.toISOString() }))));
  });

  router.post("/events/review-received", async (req, res): Promise<void> => {
    const parsed = ReceivePublicReviewBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide an alias, a rating from 1 to 5, and review text of 1–500 characters." }); return; }
    const input = parsed.data;
    if (!input.alias.trim() || !input.text.trim()) {
      res.status(400).json({ error: "Alias and review text cannot be blank." }); return;
    }
    const outlet = outlets.find(item => item.id === input.outletId);
    if (!outlet) { res.status(404).json({ error: "Demo outlet not found." }); return; }
    const [tenant] = await store.select().from(tenantsTable).where(eq(tenantsTable.id, outlet.tenantId));
    if (!tenant) { res.status(404).json({ error: "Demo listing is not available." }); return; }
    const row = await receiveReview(store, {
      reviewer: input.alias.trim(), text: input.text.trim(), rating: input.rating, outlet: outlet.outletId,
    }, {
      tenantId: outlet.tenantId, outletId: outlet.outletId, managerVoucherLimitRm: tenant.managerVoucherLimitRm,
      source: "public_page",
    }, {
      ...classificationOptions,
      onRequestComplete: metrics => req.log?.info(metrics, "Review AI classification request"),
    });
    // Submission returns the same safe fields as the read endpoint.
    res.status(201).json(ReceivePublicReviewResponse.parse({
      alias: row.reviewer, rating: row.rating, text: row.text, date: row.createdAt.toISOString(), posted_reply: null,
    }));
  });
  return router;
}

export default createPublicRouter();
