import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Simulated-but-real login for Resolve.
 * Passwords are stored as salted scrypt hashes; sessions are HMAC-signed tokens,
 * so a browser cannot pick its own role, tenant or outlet.
 */

const SESSION_HOURS = 12;

function sessionKey(): Buffer {
  // SESSION_SECRET is preferred; the database URL is a server-only fallback so the
  // demo works on Vercel without an extra setting. Neither ever reaches the browser.
  const seed = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!seed) throw new Error("SESSION_SECRET or DATABASE_URL must be set to sign sessions.");
  return createHash("sha256").update(`resolve-session|${seed}`).digest();
}

const b64 = (value: Buffer | string) => Buffer.from(value).toString("base64url");

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

// A fixed hash so unknown emails cost the same time as wrong passwords.
const DUMMY_HASH = hashPassword("resolve-no-such-account", Buffer.alloc(16));

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  const [scheme, salt, expected] = (stored || DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), 32);
  const wanted = Buffer.from(expected, "base64url");
  return Boolean(stored) && wanted.length === actual.length && timingSafeEqual(actual, wanted);
}

export function signSession(userId: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ uid: userId, exp: now + SESSION_HOURS * 3600_000 }));
  const signature = b64(createHmac("sha256", sessionKey()).update(payload).digest());
  return `${payload}.${signature}`;
}

/** Returns the user id for a valid, unexpired token, otherwise null. */
export function verifySession(token: string | null | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", sessionKey()).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid?: unknown; exp?: unknown };
    if (typeof data.uid !== "string" || typeof data.exp !== "number" || data.exp <= now) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return match ? match[1]! : null;
}
