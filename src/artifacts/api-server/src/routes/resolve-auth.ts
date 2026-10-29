import { Router, type IRouter } from "express";
import { randomBytes, randomInt } from "node:crypto";
import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import { db, outletsTable, tenantsTable, usersTable } from "@workspace/db";
import type { Store } from "../lib/resolve-cases";
import { bearerToken, hashPassword, signSession, verifyPassword, verifySession } from "../lib/resolve-auth";
import { businessProfiles, isBusinessType } from "../lib/resolve-business-types";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,30}$/;
const MAX_TEAM = 6;
const words = ["teal", "maple", "coral", "olive", "amber", "cedar", "pearl", "sage"];

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max + 1) : "";
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 40) || "outlet";
// A readable one-time password for team members; they can be given it in person.
const temporaryPassword = () => `${words[randomInt(words.length)]}-${randomInt(1000, 10000)}`;

class RegisterError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type TeamInput = { name: string; email: string; role: "Manager" | "Staff" };
type RegisterInput = {
  businessName: string; businessType: keyof typeof businessProfiles; outletName: string;
  voucherLimitRm: number; googlePlaceId: string | null;
  owner: { name: string; email: string; password: string }; team: TeamInput[];
};

function parseRegister(body: unknown): RegisterInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const owner = (b.owner ?? {}) as Record<string, unknown>;
  const businessName = text(b.businessName, 80);
  const outletName = text(b.outletName, 80);
  if (businessName.length < 2 || businessName.length > 80) throw new RegisterError("Enter a business name (2–80 characters).");
  if (!isBusinessType(b.businessType)) throw new RegisterError("Choose a business type.");
  if (outletName.length < 2 || outletName.length > 80) throw new RegisterError("Enter your first outlet's name (2–80 characters).");
  const voucherLimitRm = Number(b.voucherLimitRm);
  if (!Number.isFinite(voucherLimitRm) || voucherLimitRm < 0 || voucherLimitRm > 500) {
    throw new RegisterError("Set a manager voucher limit between RM 0 and RM 500.");
  }
  const googlePlaceId = text(b.googlePlaceId, 200) || null;
  if (googlePlaceId && !/^[A-Za-z0-9_-]{4,200}$/.test(googlePlaceId)) throw new RegisterError("That Google Place ID doesn't look right.");
  const ownerName = text(owner.name, 80);
  const ownerEmail = text(owner.email, 200).toLowerCase();
  const password = typeof owner.password === "string" ? owner.password : "";
  if (ownerName.length < 2 || ownerName.length > 80) throw new RegisterError("Enter the owner's name.");
  if (!EMAIL.test(ownerEmail)) throw new RegisterError("Enter a valid owner email.");
  if (password.length < 8 || password.length > 200) throw new RegisterError("Choose a password of at least 8 characters.");
  const rawTeam = Array.isArray(b.team) ? b.team : [];
  if (rawTeam.length > MAX_TEAM) throw new RegisterError(`Add up to ${MAX_TEAM} team members for now.`);
  const team = rawTeam.map((raw, index): TeamInput => {
    const m = (raw ?? {}) as Record<string, unknown>;
    const name = text(m.name, 80);
    const email = text(m.email, 200).toLowerCase();
    if (name.length < 2 || name.length > 80) throw new RegisterError(`Team member ${index + 1}: enter a name.`);
    if (!EMAIL.test(email)) throw new RegisterError(`Team member ${index + 1}: enter a valid email.`);
    if (m.role !== "Manager" && m.role !== "Staff") throw new RegisterError(`Team member ${index + 1}: choose Manager or Staff.`);
    return { name, email, role: m.role };
  });
  const emails = [ownerEmail, ...team.map(member => member.email)];
  if (new Set(emails).size !== emails.length) throw new RegisterError("Each person needs a different email.");
  return {
    businessName, businessType: b.businessType, outletName, voucherLimitRm: Math.round(voucherLimitRm * 100) / 100,
    googlePlaceId, owner: { name: ownerName, email: ownerEmail, password }, team,
  };
}

const profileFields = {
  id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role,
  outletId: usersTable.outletId, tenantId: usersTable.tenantId, tenantName: tenantsTable.name,
  passwordHash: usersTable.passwordHash, managerVoucherLimitRm: tenantsTable.managerVoucherLimitRm,
  active: usersTable.active,
};
type ProfileRow = { [K in keyof typeof profileFields]: unknown };

const toProfile = (row: ProfileRow) => ({
  id: row.id, name: row.name ?? row.id, email: row.email, role: row.role,
  outletId: row.outletId, tenantId: row.tenantId, tenantName: row.tenantName ?? row.tenantId,
  managerVoucherLimitRm: row.managerVoucherLimitRm,
});

export function createAuthRouter(store: Store = db): IRouter {
  const router: IRouter = Router();
  const select = () => store.select(profileFields).from(usersTable)
    .innerJoin(tenantsTable, eq(usersTable.tenantId, tenantsTable.id));

  router.post("/auth/login", async (req, res): Promise<void> => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password || email.length > 200 || password.length > 200) {
      res.status(400).json({ error: "Enter your email and password." }); return;
    }
    const [row] = await select().where(eq(sql`lower(${usersTable.email})`, email));
    // verifyPassword runs even for unknown emails so both failures take the same time.
    if (!verifyPassword(password, row?.passwordHash) || !row) {
      res.status(401).json({ error: "That email and password don't match an account." }); return;
    }
    if (!row.active) {
      res.status(401).json({ error: "This account's access was removed. Ask the business owner if this is a mistake." }); return;
    }
    res.json({ token: signSession(row.id), user: toProfile(row) });
  });

  // Simulated self sign-up: creates the business, its first outlet (with its own
  // review link), the owner login and team logins in one transaction.
  router.post("/auth/register", async (req, res): Promise<void> => {
    let input: RegisterInput;
    try { input = parseRegister(req.body); } catch (error) {
      if (error instanceof RegisterError) { res.status(error.status).json({ error: error.message }); return; }
      throw error;
    }
    const emails = [input.owner.email, ...input.team.map(member => member.email)];
    try {
      const result = await store.transaction(async tx => {
        const taken = await tx.select({ email: usersTable.email }).from(usersTable)
          .where(inArray(sql`lower(${usersTable.email})`, emails));
        if (taken.length) throw new RegisterError(`${taken[0]!.email} already has an account. Log in instead.`, 409);
        const base = slugify(input.outletName);
        const existing = await tx.select({ slug: outletsTable.slug }).from(outletsTable).where(like(outletsTable.slug, `${base}%`));
        const used = new Set(existing.map(row => row.slug));
        let slug = base;
        for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
        const tenantId = `biz-${slugify(input.businessName).slice(0, 24)}-${randomBytes(3).toString("hex")}`;
        await tx.insert(tenantsTable).values({
          id: tenantId, name: input.businessName, businessType: input.businessType,
          managerVoucherLimitRm: input.voucherLimitRm, googlePlaceId: input.googlePlaceId,
        });
        await tx.insert(outletsTable).values({ slug, tenantId, name: input.outletName });
        const ownerId = `${tenantId}-owner`;
        type Account = { id: string; name: string; email: string; role: "Owner" | "Manager" | "Staff"; temporaryPassword: string | null };
        const accounts: Account[] = [{ id: ownerId, name: input.owner.name, email: input.owner.email, role: "Owner", temporaryPassword: null }];
        for (const [index, member] of input.team.entries()) {
          accounts.push({ id: `${tenantId}-u${index + 1}`, ...member, temporaryPassword: temporaryPassword() });
        }
        await tx.insert(usersTable).values(accounts.map(account => ({
          id: account.id, role: account.role, tenantId, outletId: input.outletName, name: account.name, email: account.email,
          passwordHash: hashPassword(account.temporaryPassword ?? input.owner.password),
        })));
        return { tenantId, ownerId, slug, accounts };
      });
      res.status(201).json({
        token: signSession(result.ownerId),
        user: {
          id: result.ownerId, name: input.owner.name, email: input.owner.email, role: "Owner",
          outletId: input.outletName, tenantId: result.tenantId, tenantName: input.businessName,
          managerVoucherLimitRm: input.voucherLimitRm,
        },
        business: { name: input.businessName, type: input.businessType, typeLabel: businessProfiles[input.businessType].label },
        outlet: { slug: result.slug, name: input.outletName },
        accounts: result.accounts.map(({ id: _id, ...account }) => account),
      });
    } catch (error) {
      if (error instanceof RegisterError) { res.status(error.status).json({ error: error.message }); return; }
      // A simultaneous sign-up with the same email hits the unique index.
      if ((error as { code?: string }).code === "23505") { res.status(409).json({ error: "One of those emails already has an account." }); return; }
      throw error;
    }
  });

  /** The logged-in, still-active account, or null. */
  const currentUser = async (authorization: string | undefined) => {
    const userId = verifySession(bearerToken(authorization));
    const [row] = userId ? await select().where(and(eq(usersTable.id, userId), eq(usersTable.active, true))) : [];
    return row ?? null;
  };

  router.get("/auth/me", async (req, res): Promise<void> => {
    const row = await currentUser(req.get("authorization"));
    if (!row) { res.status(401).json({ error: "Please log in." }); return; }
    res.json({ user: toProfile(row) });
  });

  // Anyone can change their own password, after confirming the current one.
  router.post("/auth/change-password", async (req, res): Promise<void> => {
    const row = await currentUser(req.get("authorization"));
    if (!row) { res.status(401).json({ error: "Please log in." }); return; }
    const current = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const next = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (!verifyPassword(current, row.passwordHash)) { res.status(400).json({ error: "Your current password is not right." }); return; }
    if (next.length < 8 || next.length > 200) { res.status(400).json({ error: "Choose a new password of at least 8 characters." }); return; }
    if (next === current) { res.status(400).json({ error: "Choose a password different from the current one." }); return; }
    await store.transaction(tx => tx.update(usersTable).set({ passwordHash: hashPassword(next) }).where(eq(usersTable.id, row.id)));
    res.json({ ok: true });
  });

  // ---- Team management: Owner only, inside their own business ----
  const owner = async (req: Parameters<Parameters<IRouter["get"]>[1]>[0], res: Parameters<Parameters<IRouter["get"]>[1]>[1]) => {
    const row = await currentUser(req.get("authorization"));
    if (!row) { res.status(401).json({ error: "Please log in." }); return null; }
    if (row.role !== "Owner") { res.status(403).json({ error: "Only the Owner can manage the team." }); return null; }
    return row;
  };
  const member = async (tenantId: string, id: string) => {
    const [row] = await store.select({ id: usersTable.id, role: usersTable.role, name: usersTable.name, active: usersTable.active })
      .from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId)));
    return row ?? null;
  };

  router.get("/team", async (req, res): Promise<void> => {
    const me = await owner(req, res); if (!me) return;
    const rows = await store.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role,
      outletId: usersTable.outletId, active: usersTable.active,
    }).from(usersTable).where(eq(usersTable.tenantId, String(me.tenantId))).orderBy(asc(usersTable.id));
    res.json(rows.map(row => ({ ...row, name: row.name ?? row.id, isYou: row.id === me.id })));
  });

  router.post("/team", async (req, res): Promise<void> => {
    const me = await owner(req, res); if (!me) return;
    const name = text(req.body?.name, 80);
    const email = text(req.body?.email, 200).toLowerCase();
    const role = req.body?.role;
    if (name.length < 2 || name.length > 80) { res.status(400).json({ error: "Enter the person's name." }); return; }
    if (!EMAIL.test(email)) { res.status(400).json({ error: "Enter a valid email." }); return; }
    if (role !== "Manager" && role !== "Staff") { res.status(400).json({ error: "Choose Manager or Staff." }); return; }
    const [taken] = await store.select({ id: usersTable.id }).from(usersTable).where(eq(sql`lower(${usersTable.email})`, email));
    if (taken) { res.status(409).json({ error: "That email already has an account." }); return; }
    const password = temporaryPassword();
    const id = `${String(me.tenantId)}-${randomBytes(3).toString("hex")}`;
    try {
      await store.transaction(tx => tx.insert(usersTable).values({
        id, role, tenantId: String(me.tenantId), outletId: String(me.outletId), name, email, passwordHash: hashPassword(password),
      }));
    } catch (error) {
      if ((error as { code?: string }).code === "23505") { res.status(409).json({ error: "That email already has an account." }); return; }
      throw error;
    }
    res.status(201).json({ id, name, email, role, temporaryPassword: password });
  });

  router.post("/team/:id/reset-password", async (req, res): Promise<void> => {
    const me = await owner(req, res); if (!me) return;
    const target = await member(String(me.tenantId), String(req.params.id));
    if (!target) { res.status(404).json({ error: "That person is not in your team." }); return; }
    if (target.id === me.id) { res.status(400).json({ error: "Use Change password for your own account." }); return; }
    const password = temporaryPassword();
    await store.transaction(tx => tx.update(usersTable).set({ passwordHash: hashPassword(password) }).where(eq(usersTable.id, target.id)));
    res.json({ id: target.id, name: target.name, temporaryPassword: password });
  });

  // Removing access keeps the person's name on past log entries but blocks every request at once.
  router.post("/team/:id/access", async (req, res): Promise<void> => {
    const me = await owner(req, res); if (!me) return;
    const active = req.body?.active;
    if (typeof active !== "boolean") { res.status(400).json({ error: "Say whether access is on or off." }); return; }
    const target = await member(String(me.tenantId), String(req.params.id));
    if (!target) { res.status(404).json({ error: "That person is not in your team." }); return; }
    if (target.id === me.id) { res.status(400).json({ error: "You can't remove your own access." }); return; }
    await store.transaction(tx => tx.update(usersTable).set({ active }).where(eq(usersTable.id, target.id)));
    res.json({ id: target.id, active });
  });

  return router;
}

export default createAuthRouter();
