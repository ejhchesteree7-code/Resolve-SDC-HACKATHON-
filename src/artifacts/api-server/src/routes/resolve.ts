import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import {
  ApproveReviewBody, ApproveReviewResponse, GetInsightsResponse, GetReviewResponse,
  ListActivityResponse, ListReviewsQueryParams, ListReviewsResponse,
  RejectReviewBody, RejectReviewResponse, SimulateReviewResponse, UpdateReviewBody, UpdateReviewResponse,
} from "@workspace/api-zod";
import { activityTable, db, reviewsTable, tenantsTable, usersTable } from "@workspace/db";
import { authorize, PermissionDenied, type User } from "../lib/resolve-permissions";
import { CaseError, changeCase, type Store } from "../lib/resolve-cases";
import { receiveReview } from "../lib/resolve-received";

const toApiReview = (row: typeof reviewsTable.$inferSelect) => ({ ...row, createdAt: row.createdAt.toISOString() });
const scope = (user: User) => and(
  eq(reviewsTable.tenantId, user.tenantId),
  user.role === "Owner" ? undefined : eq(reviewsTable.outletId, user.outletId),
);
const samples = [
  { reviewer: "Sofia Tan", outlet: "Brew & Kin — Bangsar", rating: 5, text: "A lovely little café. The team made my morning." },
  { reviewer: "Rizal Ahmad", outlet: "Brew & Kin — Mont Kiara", rating: 2, text: "Waited quite long for my order, can improve the service." },
  { reviewer: "Emma Lim", outlet: "Brew & Kin — Bangsar", rating: 4, text: "Kopi sedap, suasana pun selesa." },
  { reviewer: "Nurin Ahmad", outlet: "Brew & Kin — Mont Kiara", rating: 1, text: "Ada benda asing dalam makanan saya. Tolong periksa segera." },
  { reviewer: "Aina Rahman", outlet: "Brew & Kin — Bangsar", rating: 2, text: "Tunggu 40 minit, staff rude gila." },
];

export function createResolveRouter(store: Store = db): IRouter {
  const router: IRouter = Router();
  // No role, tenant or outlet from the request body participates in authorization.
  router.use(async (req, res, next): Promise<void> => {
    const id = req.get("x-demo-user-id");
    const [user] = id ? await store.select({
      id: usersTable.id, role: usersTable.role, tenantId: usersTable.tenantId,
      outletId: usersTable.outletId, managerVoucherLimitRm: tenantsTable.managerVoucherLimitRm,
    }).from(usersTable).innerJoin(tenantsTable, eq(usersTable.tenantId, tenantsTable.id))
      .where(eq(usersTable.id, id)) : [];
    authorize(user ?? null, "view", null);
    res.locals.user = user;
    next();
  });

  router.get("/reviews", async (req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "view", null);
    const parsed = ListReviewsQueryParams.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const rows = await store.select().from(reviewsTable).where(and(
      scope(user),
      parsed.data.status ? eq(reviewsTable.status, parsed.data.status) : undefined,
      parsed.data.outlet ? eq(reviewsTable.outlet, parsed.data.outlet) : undefined,
    )).orderBy(desc(reviewsTable.createdAt));
    res.json(ListReviewsResponse.parse(rows.map(toApiReview)));
  });

  router.post("/reviews", async (req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "create", null);
    const candidates = user.role === "Owner" ? samples : samples.filter(sample => sample.outlet === user.outletId);
    if (!candidates.length) { res.status(400).json({ error: "No demo samples exist for your outlet." }); return; }
    const sample = candidates[Math.floor(Math.random() * candidates.length)]!;
    const row = await receiveReview(store, sample, {
      tenantId: user.tenantId, outletId: sample.outlet,
      managerVoucherLimitRm: user.managerVoucherLimitRm, source: "simulated",
    }, {
      onRequestComplete: metrics => req.log.info(metrics, "Review AI classification request"),
    });
    res.status(201).json(SimulateReviewResponse.parse(toApiReview(row)));
  });

  router.get(["/reviews/:reviewId", "/cases/:reviewId"], async (req, res): Promise<void> => {
    const [row] = await store.select().from(reviewsTable).where(eq(reviewsTable.id, String(req.params.reviewId)));
    if (!row) { res.status(404).json({ error: "Case not found." }); return; }
    authorize(res.locals.user, "view", row);
    res.json(GetReviewResponse.parse(toApiReview(row)));
  });

  router.patch(["/reviews/:reviewId", "/cases/:reviewId"], async (req, res): Promise<void> => {
    const body = UpdateReviewBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const row = await changeCase(store, res.locals.user, String(req.params.reviewId), "edit", body.data);
    res.json(UpdateReviewResponse.parse(toApiReview(row)));
  });

  router.post(["/reviews/:reviewId/approve", "/cases/:reviewId/approve"], async (req, res): Promise<void> => {
    const body = ApproveReviewBody.safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const row = await changeCase(store, res.locals.user, String(req.params.reviewId), "approve", body.data);
    res.json(ApproveReviewResponse.parse(toApiReview(row)));
  });

  router.post(["/reviews/:reviewId/reject", "/cases/:reviewId/reject"], async (req, res): Promise<void> => {
    const body = RejectReviewBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const row = await changeCase(store, res.locals.user, String(req.params.reviewId), "reject", body.data);
    res.json(RejectReviewResponse.parse(toApiReview(row)));
  });

  router.get("/activity", async (_req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "activity", null);
    const rows = await store.select({ activity: activityTable }).from(activityTable)
      .innerJoin(reviewsTable, eq(activityTable.reviewId, reviewsTable.id)).where(scope(user))
      .orderBy(desc(activityTable.sequence)).limit(150);
    res.json(ListActivityResponse.parse(rows.map(({ activity }) => ({
      ...activity, createdAt: activity.createdAt.toISOString(),
    }))));
  });

  router.get("/insights", async (_req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "insights", null);
    const outlet = user.role === "Owner" ? "Brew & Kin — Bangsar" : user.outletId;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [result] = await store.select({ count: count() }).from(reviewsTable).where(and(
      scope(user), eq(reviewsTable.category, "Slow service"), eq(reviewsTable.outletId, outlet),
      gte(reviewsTable.createdAt, monthStart), sql`EXTRACT(DOW FROM ${reviewsTable.createdAt}) = 5`,
    ));
    const total = Number(result?.count ?? 0);
    res.json(GetInsightsResponse.parse({
      title: "Slow service on Friday nights", count: total, period: "this month", flagged: total >= 4, outlet,
    }));
  });

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof PermissionDenied || error instanceof CaseError) {
      res.status(error.status).json({ error: error.message }); return;
    }
    next(error);
  });
  return router;
}

export default createResolveRouter();
