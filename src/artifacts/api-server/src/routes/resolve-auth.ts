import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, tenantsTable, usersTable } from "@workspace/db";
import type { Store } from "../lib/resolve-cases";
import { bearerToken, signSession, verifyPassword, verifySession } from "../lib/resolve-auth";

const profileFields = {
  id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role,
  outletId: usersTable.outletId, tenantId: usersTable.tenantId, tenantName: tenantsTable.name,
  passwordHash: usersTable.passwordHash,
};
type ProfileRow = { [K in keyof typeof profileFields]: unknown };

const toProfile = (row: ProfileRow) => ({
  id: row.id, name: row.name ?? row.id, email: row.email, role: row.role,
  outletId: row.outletId, tenantId: row.tenantId, tenantName: row.tenantName ?? row.tenantId,
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
    res.json({ token: signSession(row.id), user: toProfile(row) });
  });

  router.get("/auth/me", async (req, res): Promise<void> => {
    const userId = verifySession(bearerToken(req.get("authorization")));
    const [row] = userId ? await select().where(eq(usersTable.id, userId)) : [];
    if (!row) { res.status(401).json({ error: "Please log in." }); return; }
    res.json({ user: toProfile(row) });
  });

  return router;
}

export default createAuthRouter();
