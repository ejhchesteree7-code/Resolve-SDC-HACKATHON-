import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { asc, eq, sql } from "drizzle-orm";
import { activityTable, db, pool, reviewsTable, tenantsTable, usersTable } from "@workspace/db";
import { createResolveRouter } from "../routes/resolve";
import { createPublicRouter } from "../routes/resolve-public";
import { createAuthRouter } from "../routes/resolve-auth";
import { ensureOutletDemoReviews } from "../routes/resolve-outlet-demo";
import { routeNewReview, type ReviewClassification } from "./resolve-ai";
import { hashPassword, signSession } from "./resolve-auth";

test("T2: all 18 routing combinations have an assigned role", () => {
  let combinations = 0;
  for (const sentiment of ["positive", "neutral", "negative"] as const) {
    for (const severity of ["low", "medium", "high"] as const) {
      for (const confident of [true, false]) {
        const classification: ReviewClassification = {
          sentiment, severity, confidence: confident ? 0.95 : 0.4,
          category: "other", language: "English", draftReply: "Thank you.",
          reason: "Routing fixture", suggestedVoucherRm: 0, usedFallback: false,
        };
        assert.ok(["Staff", "Manager", "Owner"].includes(routeNewReview(classification).assignedRole));
        combinations++;
      }
    }
  }
  assert.equal(combinations, 18);
});

test("permissions and audit integration (real HTTP and PostgreSQL, rolled back)", async t => {
  const rollback = new Error("ROLL_BACK_TEST_FIXTURES");
  try {
    await db.transaction(async tx => {
      const tenantId = `test-${randomUUID()}`;
      const foreignTenant = `${tenantId}-foreign`;
      const outletId = "Test outlet A", otherOutlet = "Test outlet B";
      const staff = `${tenantId}-staff`, manager = `${tenantId}-manager`, owner = `${tenantId}-owner`;
      await tx.insert(tenantsTable).values([
        { id: tenantId, managerVoucherLimitRm: 20 },
        { id: foreignTenant, managerVoucherLimitRm: 20 },
      ]);
      await tx.insert(usersTable).values([
        { id: staff, role: "Staff", tenantId, outletId },
        { id: manager, role: "Manager", tenantId, outletId },
        { id: owner, role: "Owner", tenantId, outletId },
      ]);
      const fixture = async (overrides: Partial<typeof reviewsTable.$inferInsert> = {}) => {
        const [row] = await tx.insert(reviewsTable).values({
          id: randomUUID(), tenantId, outletId, outlet: outletId, reviewer: "Test reviewer",
          rating: 2, language: "Manglish", text: "Tunggu 40 minit, staff rude gila.",
          sentiment: "negative", category: "Slow service", severity: "medium",
          reason: "Test complaint", confidence: 0.95, draftReply: "We are sorry for the wait.",
          assignedRole: "Manager", status: "Needs approval", createdAt: new Date(), ...overrides,
        }).returning();
        return row!;
      };
      const getCase = async (id: string) => (await tx.select().from(reviewsTable).where(eq(reviewsTable.id, id)))[0]!;
      const logs = (id: string) => tx.select().from(activityTable)
        .where(eq(activityTable.reviewId, id)).orderBy(asc(activityTable.sequence));
      const app = express();
      app.use(express.json());
      app.use("/api", createPublicRouter(tx, { aiDisabled: true }));
      app.use("/api", createAuthRouter(tx));
      app.use("/api", createResolveRouter(tx));
      // Keep expected database-failure tests quiet; never log request credentials.
      app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: "Transaction failed" });
      });
      const server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const base = `http://127.0.0.1:${address.port}/api`;
      const request = (path: string, user: string | null, method = "GET", body?: unknown) => fetch(base + path, {
        method, headers: { ...(user ? { authorization: `Bearer ${signSession(user)}` } : {}), "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      try {
        await t.test("T3: RM25 proposal above RM20 escalates atomically", async () => {
          const row = await fixture();
          const response = await request(`/cases/${row.id}`, manager, "PATCH", { voucherAmount: 25 });
          assert.equal(response.status, 200);
          const saved = await getCase(row.id);
          assert.equal(saved.status, "pending_owner");
          assert.equal(saved.assignedRole, "Owner");
          assert.equal(saved.voucherAmount, 25);
          const activity = await logs(row.id);
          assert.deepEqual(activity.map(log => log.action), ["voucher_proposed", "escalated", "reply_updated"]);
          assert.equal(activity[0]!.actor, manager);
          assert.equal(activity[0]!.role, "Manager");
        });
        await t.test("T4: Staff complaint approval is 403 with no case or log writes", async () => {
          const row = await fixture();
          const response = await request(`/cases/${row.id}/approve`, staff, "POST", {
            role: "Owner", draftReply: "Forged owner approval", voucherAmount: 25,
          });
          assert.equal(response.status, 403);
          assert.match((await response.json() as { error: string }).error, /Staff/);
          assert.deepEqual(await getCase(row.id), row);
          assert.deepEqual(await logs(row.id), []);
        });
        await t.test("T5: Manager high-severity approval is 403 with no writes", async () => {
          const row = await fixture({ severity: "high", assignedRole: "Owner", status: "pending_owner" });
          const response = await request(`/cases/${row.id}/approve`, manager, "POST", { role: "Owner" });
          assert.equal(response.status, 403);
          assert.deepEqual(await getCase(row.id), row);
          assert.deepEqual(await logs(row.id), []);
        });
        await t.test("T7: PostgreSQL rejects audit UPDATE and DELETE", async () => {
          const row = await fixture();
          const [entry] = await tx.insert(activityTable).values({
            id: randomUUID(), reviewId: row.id, actor: owner, role: "Owner",
            action: "fixture", details: "Immutable test entry", createdAt: new Date(),
          }).returning();
          const isImmutableError = (error: unknown) =>
            String((error as { cause?: Error }).cause?.message ?? error).includes("append-only");
          await assert.rejects(tx.transaction(inner => inner.update(activityTable)
            .set({ details: "Tampered" }).where(eq(activityTable.id, entry!.id))), isImmutableError);
          await assert.rejects(tx.transaction(inner => inner.delete(activityTable)
            .where(eq(activityTable.id, entry!.id))), isImmutableError);
          assert.deepEqual(await logs(row.id), [entry]);
        });
        await t.test("T9: Owner posts, issues voucher and resolves with ordered audit", async () => {
          const row = await fixture({ severity: "high", assignedRole: "Owner", status: "pending_owner", voucherAmount: 25 });
          const response = await request(`/cases/${row.id}/approve`, owner, "POST", {});
          assert.equal(response.status, 200);
          assert.equal((await getCase(row.id)).status, "Resolved");
          assert.deepEqual((await logs(row.id)).map(log => log.action), [
            "approved", "reply_posted", "voucher_issued", "resolved",
          ]);
          assert.ok((await logs(row.id)).every(log => log.actor === owner && log.role === "Owner"));
        });
        await t.test("WhatsApp follow-up: Staff 403, unresolved 409, resolved case logs once", async () => {
          const open = await fixture({ severity: "low", assignedRole: "Manager" });
          const body = { message: "Hi, sorry about the wait." };
          assert.equal((await request(`/cases/${open.id}/followup`, staff, "POST", body)).status, 403);
          assert.equal((await request(`/cases/${open.id}/followup`, manager, "POST", body)).status, 409);
          assert.equal((await request(`/cases/${open.id}/followup`, manager, "POST", { message: "" })).status, 400);
          const done = await fixture({ status: "Resolved" });
          assert.equal((await request(`/cases/${done.id}/followup`, manager, "POST", body)).status, 200);
          assert.deepEqual((await logs(done.id)).map(log => log.action), ["guest_followup_sent"]);
          assert.deepEqual(await logs(open.id), []);
        });
        await t.test("identity, outlet and tenant scopes apply to reads and writes", async () => {
          const own = await fixture();
          const second = await fixture({ outletId: otherOutlet, outlet: otherOutlet });
          const foreign = await fixture({ tenantId: foreignTenant });
          for (const row of [own, second, foreign]) {
            await tx.insert(activityTable).values({
              id: randomUUID(), reviewId: row.id, actor: "Test", role: "System",
              action: "fixture", details: "Scope fixture", createdAt: new Date(),
            });
          }
          assert.equal((await request("/reviews", null)).status, 403);
          assert.equal((await request("/reviews", "unknown-user")).status, 403);
          assert.equal((await request("/activity", staff)).status, 403);
          const managerRows = await (await request("/reviews", manager)).json() as { id: string; outlet: string }[];
          assert.ok(managerRows.length > 0 && managerRows.every((row: { outlet: string }) => row.outlet === outletId));
          const ownerRows = await (await request("/reviews", owner)).json() as { id: string }[];
          assert.ok(ownerRows.some((row: { id: string }) => row.id === second.id));
          assert.ok(!ownerRows.some((row: { id: string }) => row.id === foreign.id));
          const managerLog = await (await request("/activity", manager)).json() as { reviewId: string }[];
          assert.ok(!managerLog.some((log: { reviewId: string }) => [second.id, foreign.id].includes(log.reviewId)));
          const ownerLog = await (await request("/activity", owner)).json() as { reviewId: string }[];
          assert.ok(ownerLog.some((log: { reviewId: string }) => log.reviewId === second.id));
          assert.ok(!ownerLog.some((log: { reviewId: string }) => log.reviewId === foreign.id));
          assert.equal((await request(`/cases/${second.id}`, manager)).status, 403);
          assert.equal((await request(`/cases/${foreign.id}`, owner)).status, 403);
          assert.equal((await request(`/cases/${second.id}`, manager, "PATCH", { draftReply: "No" })).status, 403);
          assert.deepEqual(await getCase(second.id), second);
        });
        await t.test("Staff can edit/approve simple cases, but cannot propose vouchers or edit complaints", async () => {
          const simple = await fixture({ sentiment: "positive", severity: "low", assignedRole: "Staff", status: "New" });
          assert.equal((await request(`/reviews/${simple.id}`, staff, "PATCH", { draftReply: "Thank you!" })).status, 200);
          const before = await getCase(simple.id), previousLogs = await logs(simple.id);
          assert.equal((await request(`/reviews/${simple.id}`, staff, "PATCH", { voucherAmount: 5 })).status, 403);
          assert.deepEqual(await getCase(simple.id), before);
          assert.deepEqual(await logs(simple.id), previousLogs);
          assert.equal((await request(`/reviews/${simple.id}/approve`, staff, "POST", {})).status, 200);
          const complaint = await fixture();
          assert.equal((await request(`/cases/${complaint.id}`, staff, "PATCH", { draftReply: "No" })).status, 403);
          assert.deepEqual(await getCase(complaint.id), complaint);
        });
        await t.test("Manager voucher limit is inclusive, server-configured, and denied approvals never escalate", async () => {
          const atLimit = await fixture();
          assert.equal((await request(`/cases/${atLimit.id}/approve`, manager, "POST", { voucherAmount: 20 })).status, 200);
          const aboveLimit = await fixture();
          assert.equal((await request(`/cases/${aboveLimit.id}/approve`, manager, "POST", { voucherAmount: 25 })).status, 403);
          assert.deepEqual(await getCase(aboveLimit.id), aboveLimit);
          assert.deepEqual(await logs(aboveLimit.id), []);
          await tx.update(tenantsTable).set({ managerVoucherLimitRm: 30 }).where(eq(tenantsTable.id, tenantId));
          assert.equal((await request(`/cases/${aboveLimit.id}/approve`, manager, "POST", { voucherAmount: 25 })).status, 200);
          await tx.update(tenantsTable).set({ managerVoucherLimitRm: 20 }).where(eq(tenantsTable.id, tenantId));
        });
        await t.test("Every voucher edit reruns V1, including repeated proposals", async () => {
          const row = await fixture();
          assert.equal((await request(`/cases/${row.id}`, manager, "PATCH", { voucherAmount: 25 })).status, 200);
          assert.equal((await request(`/cases/${row.id}`, owner, "PATCH", { voucherAmount: 26 })).status, 200);
          assert.equal((await request(`/cases/${row.id}`, owner, "PATCH", { voucherAmount: 26 })).status, 200);
          assert.equal((await logs(row.id)).filter(log => log.action === "escalated").length, 3);
          assert.equal((await getCase(row.id)).status, "pending_owner");
        });
        await t.test("Outlet demo data preserves reviews, repairs legacy mapping, and matches public/Owner counts without duplicates", async () => {
          const bangsar = "Brew & Kin — Bangsar", montKiara = "Brew & Kin — Mont Kiara";
          await tx.insert(tenantsTable).values({ id: "resolve-demo", managerVoucherLimitRm: 20 }).onConflictDoNothing();
          const demoOwner = `${tenantId}-demo-count-owner`;
          await tx.insert(usersTable).values({ id: demoOwner, role: "Owner", tenantId: "resolve-demo", outletId: bangsar });
          const legacy = await fixture({ tenantId: "resolve-demo", outlet: montKiara, outletId: bangsar });
          const foreign = await fixture({ tenantId: foreignTenant, outlet: montKiara, outletId: bangsar });
          const publicReview = await fixture({ tenantId: "resolve-demo", outlet: montKiara, outletId: montKiara, source: "public_page" });
          const first = await ensureOutletDemoReviews(tx);
          assert.ok(first.corrected >= 1);
          assert.deepEqual(await getCase(legacy.id), { ...legacy, outletId: montKiara });
          assert.deepEqual(await getCase(foreign.id), foreign);
          assert.deepEqual(await getCase(publicReview.id), publicReview);
          assert.deepEqual((await logs(legacy.id)).map(log => log.action), ["outlet_corrected"]);

          const all = await tx.select().from(reviewsTable).where(eq(reviewsTable.tenantId, "resolve-demo"));
          const added = all.filter(row => row.id.startsWith("resolve-demo-mont-kiara-demo-"));
          assert.equal(added.length, 20);
          assert.deepEqual([...new Set(added.map(row => row.rating))].sort(), [1, 2, 3, 4, 5]);
          assert.ok(added.every(row => row.outlet === montKiara && row.outletId === montKiara && row.source === "simulated"));
          assert.ok(added.filter(row => row.severity === "high").every(row => row.assignedRole === "Owner" && row.status === "pending_owner"));
          for (const row of added) {
            assert.deepEqual((await logs(row.id)).map(log => log.action), ["review_received", "demo_classified", "routed"]);
          }
          assert.deepEqual(await ensureOutletDemoReviews(tx), { corrected: 0, inserted: 0 });
          assert.equal((await tx.select().from(reviewsTable).where(eq(reviewsTable.tenantId, "resolve-demo"))).length, all.length);
          assert.equal((await logs(legacy.id)).length, 1);

          for (const [slug, outlet] of [["bangsar", bangsar], ["mont-kiara", montKiara]]) {
            const internalResponse = await request(`/reviews?outlet=${encodeURIComponent(outlet!)}`, demoOwner);
            const publicResponse = await request(`/public/outlets/${slug}/reviews`, null);
            assert.equal(internalResponse.status, 200);
            assert.equal(publicResponse.status, 200);
            const internal = await internalResponse.json() as Array<{ reviewer: string; rating: number; text: string; createdAt: string }>;
            const visible = await publicResponse.json() as Array<{ alias: string; rating: number; text: string; date: string }>;
            assert.equal(visible.length, internal.length);
            assert.deepEqual(
              visible.map(row => JSON.stringify([row.alias, row.rating, row.text, row.date])).sort(),
              internal.map(row => JSON.stringify([row.reviewer, row.rating, row.text, row.createdAt])).sort(),
            );
          }
        });
        await t.test("T6: public submissions run through ingestion; all ratings and seeded reviews stay visible", async () => {
          await tx.insert(tenantsTable).values({ id: "resolve-demo", managerVoucherLimitRm: 20 }).onConflictDoNothing();
          const alias = `Public test ${randomUUID()}`;
          const payload = { outletId: "bangsar", alias, rating: 1, text: "Long wait and rude staff.", source: "public_page" };
          const response = await request("/events/review-received", null, "POST", payload);
          assert.equal(response.status, 201);
          const received = await response.json() as Record<string, unknown>;
          assert.deepEqual(Object.keys(received).sort(), ["alias", "date", "posted_reply", "rating", "text"]);
          const [created] = await tx.select().from(reviewsTable).where(eq(reviewsTable.reviewer, alias));
          assert.ok(created);
          assert.equal(created.source, "public_page");
          assert.equal(created.assignedRole, "Manager");
          assert.deepEqual((await logs(created.id)).map(log => log.action), ["review_received", "ai_classified", "routed"]);
          const praise = await fixture({
            tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar", rating: 5,
            reviewer: `${alias}-seeded`, source: "simulated", status: "New",
          });
          const list = await request("/public/outlets/bangsar/reviews", null);
          assert.equal(list.status, 200);
          const publicRows = await list.json() as { alias: string; rating: number }[];
          assert.ok(publicRows.some(row => row.alias === alias && row.rating === 1));
          assert.ok(publicRows.some(row => row.alias === praise.reviewer && row.rating === 5));
          for (const changes of [{ rating: 0 }, { rating: 6 }, { text: "a".repeat(501) }, { text: " " }, { alias: " " }, { source: "internal" }]) {
            assert.equal((await request("/events/review-received", null, "POST", { ...payload, ...changes })).status, 400);
          }
          assert.equal((await request("/public/outlets/unknown/reviews", null)).status, 404);
        });
        await t.test("T8: public reads are read-only, whitelist fields, and reveal only final posted replies", async () => {
          const publicManager = `public-manager-${randomUUID()}`;
          await tx.insert(usersTable).values({
            id: publicManager, tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar", role: "Manager",
          });
          const pending = await fixture({
            tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar",
            reviewer: `Visible ${randomUUID()}`, draftReply: "PRIVATE DRAFT",
          });
          const noLog = await fixture({
            tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar",
            reviewer: `No log ${randomUUID()}`, status: "Resolved", finalReply: "NO POST LOG",
          });
          const notResolved = await fixture({
            tenantId: "resolve-demo", outletId: "Brew & Kin — Bangsar",
            reviewer: `Not resolved ${randomUUID()}`, finalReply: "NOT RESOLVED",
          });
          await tx.insert(activityTable).values({
            id: randomUUID(), reviewId: notResolved.id, actor: "System", role: "System",
            action: "reply_posted", details: "Fixture for status gate", createdAt: new Date(),
          });
          const before = await tx.select().from(reviewsTable);
          const beforeLogs = await tx.select().from(activityTable);
          const read = async () => {
            const response = await request("/public/outlets/bangsar/reviews", null);
            assert.equal(response.status, 200);
            return await response.json() as { alias: string; posted_reply: string | null }[];
          };
          const visible = await read();
          for (const row of visible) {
            assert.deepEqual(Object.keys(row).sort(), ["alias", "date", "posted_reply", "rating", "text"]);
          }
          for (const row of [pending, noLog, notResolved]) assert.equal(visible.find(item => item.alias === row.reviewer)?.posted_reply, null);
          assert.ok(!JSON.stringify(visible).includes("PRIVATE DRAFT"));
          assert.deepEqual(await tx.select().from(reviewsTable), before);
          assert.deepEqual(await tx.select().from(activityTable), beforeLogs);
          const approved = await request(`/cases/${pending.id}/approve`, publicManager, "POST", { draftReply: "Approved public response." });
          assert.equal(approved.status, 200);
          assert.equal((await getCase(pending.id)).finalReply, "Approved public response.");
          assert.equal((await read()).find(item => item.alias === pending.reviewer)?.posted_reply, "Approved public response.");
        });
        await t.test("Audit insert failure rolls back the API's case update and preceding logs", async () => {
          const row = await fixture();
          await tx.execute(sql`
            CREATE FUNCTION reject_test_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW.action = 'reply_updated' AND NEW.details = 'Reply draft or voucher proposal updated' THEN
                RAISE EXCEPTION 'Intentional audit insert failure';
              END IF;
              RETURN NEW;
            END; $$;
            CREATE TRIGGER reject_test_audit_insert BEFORE INSERT ON ${activityTable}
            FOR EACH ROW EXECUTE FUNCTION reject_test_audit_insert();
          `);
          assert.equal((await request(`/cases/${row.id}`, manager, "PATCH", { voucherAmount: 25 })).status, 500);
          assert.deepEqual(await getCase(row.id), row);
          assert.deepEqual(await logs(row.id), []);
        });
        await t.test("login: only a server-signed session identifies the user", async () => {
          // The old demo header and forged or expired tokens are all refused.
          const bare = await fetch(base + "/reviews", { headers: { "x-demo-user-id": owner } });
          assert.equal(bare.status, 403);
          const [payload, signature] = signSession(staff).split(".");
          const forgedPayload = Buffer.from(JSON.stringify({ uid: owner, exp: Date.now() + 60_000 })).toString("base64url");
          for (const token of [`${forgedPayload}.${signature}`, `${payload}.AAAA`, signSession(owner, Date.now() - 13 * 3600_000), "nonsense"]) {
            const response = await fetch(base + "/reviews", { headers: { authorization: `Bearer ${token}` } });
            assert.equal(response.status, 403);
          }
          await tx.update(usersTable).set({
            name: "Test Owner", email: `${owner}@test.demo`, passwordHash: hashPassword("correct-horse"),
          }).where(eq(usersTable.id, owner));
          const login = (email: string, password: string) => fetch(base + "/auth/login", {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
          });
          assert.equal((await login(`${owner}@test.demo`, "wrong-password")).status, 401);
          assert.equal((await login("nobody@test.demo", "correct-horse")).status, 401);
          assert.equal((await login("", "")).status, 400);
          const ok = await login(`  ${owner.toUpperCase()}@TEST.DEMO `, "correct-horse");
          assert.equal(ok.status, 200);
          const body = await ok.json() as { token: string; user: { id: string; role: string; name: string } };
          assert.equal(body.user.id, owner);
          assert.equal(body.user.role, "Owner");
          assert.equal(body.user.name, "Test Owner");
          assert.ok(!("passwordHash" in body.user));
          const me = await fetch(base + "/auth/me", { headers: { authorization: `Bearer ${body.token}` } });
          assert.equal(me.status, 200);
          assert.equal(((await me.json()) as { user: { role: string } }).user.role, "Owner");
          assert.equal((await fetch(base + "/auth/me")).status, 401);
          const reviews = await fetch(base + "/reviews", { headers: { authorization: `Bearer ${body.token}` } });
          assert.equal(reviews.status, 200);
        });
      } finally {
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await pool.end();
  }
});
