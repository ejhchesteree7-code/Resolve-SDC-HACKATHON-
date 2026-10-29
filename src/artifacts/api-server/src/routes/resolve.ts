import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  ApproveReviewBody, ApproveReviewResponse, GetInsightsResponse, GetReviewResponse,
  ListActivityResponse, ListReviewsQueryParams, ListReviewsResponse,
  RejectReviewBody, RejectReviewResponse, SimulateReviewResponse, UpdateReviewBody, UpdateReviewResponse,
} from "@workspace/api-zod";
import { activityTable, db, outletsTable, reviewsTable, tenantsTable, usersTable } from "@workspace/db";
import { profileFor } from "../lib/resolve-business-types";
import { MANUAL_STEPS, measureFromLog, measureRouting, PHASE1, RESOLVE_STEPS, RESPONSE_TARGETS, REVIEWS_PER_WEEK } from "../lib/resolve-impact";
import { authorize, PermissionDenied, type User } from "../lib/resolve-permissions";
import { bearerToken, verifySession } from "../lib/resolve-auth";
import { auditWriter, CaseError, changeCase, type Store } from "../lib/resolve-cases";
import { receiveReview } from "../lib/resolve-received";
import { computeInsight } from "../lib/resolve-insights";

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
  // Identity comes only from a server-signed login session; no role, tenant or
  // outlet from the request participates in authorization.
  router.use(async (req, res, next): Promise<void> => {
    const id = verifySession(bearerToken(req.get("authorization")));
    const [user] = id ? await store.select({
      id: usersTable.id, role: usersTable.role, tenantId: usersTable.tenantId,
      outletId: usersTable.outletId, managerVoucherLimitRm: tenantsTable.managerVoucherLimitRm,
      businessType: tenantsTable.businessType,
    }).from(usersTable).innerJoin(tenantsTable, eq(usersTable.tenantId, tenantsTable.id))
      .where(and(eq(usersTable.id, id), eq(usersTable.active, true))) : [];
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
      // Seeded rows store "Needs owner"; rows created by the app store "pending_owner".
      parsed.data.status === "pending_owner" || parsed.data.status === "Needs owner"
        ? inArray(reviewsTable.status, ["pending_owner", "Needs owner"])
        : parsed.data.status ? eq(reviewsTable.status, parsed.data.status) : undefined,
      parsed.data.outlet ? eq(reviewsTable.outlet, parsed.data.outlet) : undefined,
    )).orderBy(desc(reviewsTable.createdAt));
    res.json(ListReviewsResponse.parse(rows.map(toApiReview)));
  });

  router.post("/reviews", async (req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "create", null);
    const businessType = user.businessType;
    // Cafés keep their two-outlet samples; other business types use their own samples at the user's outlet.
    const pool = businessType && businessType !== "cafe"
      ? profileFor(businessType).samples.map(sample => ({ ...sample, outlet: user.outletId }))
      : samples;
    const candidates = user.role === "Owner" ? pool : pool.filter(sample => sample.outlet === user.outletId);
    if (!candidates.length) { res.status(400).json({ error: "No demo samples exist for your outlet." }); return; }
    const sample = candidates[Math.floor(Math.random() * candidates.length)]!;
    const row = await receiveReview(store, sample, {
      tenantId: user.tenantId, outletId: sample.outlet,
      managerVoucherLimitRm: user.managerVoucherLimitRm, source: "simulated", businessType,
    }, {
      onRequestComplete: metrics => req.log.info(metrics, "Review AI classification request"),
    });
    res.status(201).json(SimulateReviewResponse.parse(toApiReview(row)));
  });

  // The business's outlets and their public review slugs (for links and QR codes).
  router.get("/outlets", async (_req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "view", null);
    const rows = await store.select({ slug: outletsTable.slug, name: outletsTable.name })
      .from(outletsTable).where(and(
        eq(outletsTable.tenantId, user.tenantId),
        user.role === "Owner" ? undefined : eq(outletsTable.name, user.outletId),
      )).orderBy(outletsTable.createdAt, outletsTable.slug);
    res.json(rows);
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
    // Optional browser measurement (ms from opening the case to Approve), capped at one hour.
    const measured = Number(req.get("x-handling-ms"));
    const handlingMs = Number.isFinite(measured) && measured > 0 && measured <= 3_600_000 ? Math.round(measured) : null;
    const row = await changeCase(store, res.locals.user, String(req.params.reviewId), "approve", body.data, { handlingMs });
    res.json(ApproveReviewResponse.parse(toApiReview(row)));
  });

  router.post(["/reviews/:reviewId/reject", "/cases/:reviewId/reject"], async (req, res): Promise<void> => {
    const body = RejectReviewBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const row = await changeCase(store, res.locals.user, String(req.params.reviewId), "reject", body.data);
    res.json(RejectReviewResponse.parse(toApiReview(row)));
  });

  // Simulated WhatsApp follow-up: nothing leaves the system; the send is recorded in the audit log.
  router.post("/cases/:reviewId/followup", async (req, res): Promise<void> => {
    const user: User = res.locals.user;
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message || message.length > 600) { res.status(400).json({ error: "Message must be 1-600 characters." }); return; }
    await store.transaction(async (tx) => {
      const [existing] = await tx.select().from(reviewsTable).where(eq(reviewsTable.id, String(req.params.reviewId))).for("update");
      if (!existing) throw new CaseError("Case not found.", 404);
      authorize(user, "view", existing);
      if (user.role === "Staff") throw new PermissionDenied("Only a Manager or Owner can message guests.");
      if (existing.status !== "Resolved") throw new CaseError("Approve and resolve the case before messaging the guest.", 409);
      await auditWriter(tx, existing.id, user.id, user.role)("guest_followup_sent", "Private WhatsApp follow-up sent (simulated)");
    });
    res.json({ ok: true, simulated: true });
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

  // Impact measured from this business's own activity log, against the Phase 1 baseline.
  router.get("/impact", async (_req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "activity", null);
    const cases = await store.select({
      id: reviewsTable.id, missingInfo: reviewsTable.missingInfo, ruleFired: reviewsTable.ruleFired, status: reviewsTable.status,
      severity: reviewsTable.severity, assignedRole: reviewsTable.assignedRole, createdAt: reviewsTable.createdAt,
    }).from(reviewsTable).where(scope(user));
    const activity = await store.select({
      reviewId: activityTable.reviewId, action: activityTable.action, role: activityTable.role, details: activityTable.details,
    }).from(activityTable).innerJoin(reviewsTable, eq(activityTable.reviewId, reviewsTable.id)).where(scope(user));
    res.json({
      phase1: PHASE1,
      assumptions: { reviewsPerWeek: REVIEWS_PER_WEEK, responseTargetHours: RESPONSE_TARGETS },
      steps: { manual: MANUAL_STEPS, resolve: RESOLVE_STEPS },
      measured: measureFromLog(activity, cases),
      routing: await measureRouting(),
    });
  });

  router.get("/insights", async (_req, res): Promise<void> => {
    const user: User = res.locals.user;
    authorize(user, "insights", null);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const rows = await store.select({
      category: reviewsTable.category, sentiment: reviewsTable.sentiment,
      outlet: reviewsTable.outlet, createdAt: reviewsTable.createdAt,
    }).from(reviewsTable).where(and(scope(user), gte(reviewsTable.createdAt, monthStart)));
    const insight = computeInsight(rows, user.role === "Owner" ? "All outlets" : user.outletId);
    // A Manager only ever sees their own outlet, so always report it as that outlet.
    res.json(GetInsightsResponse.parse(user.role === "Owner" ? insight : { ...insight, outlet: user.outletId }));
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
