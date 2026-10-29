import { setAuthTokenGetter } from '@workspace/api-client-react';

export type Role = 'Staff' | 'Manager' | 'Owner';
export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  outletId: string;
  tenantId: string;
  tenantName: string;
  /** The business's manager voucher limit; older saved sessions may not have it. */
  managerVoucherLimitRm?: number;
};
export type Session = { token: string; user: SessionUser };

const STORAGE_KEY = 'resolve.session';
let token: string | null = null;
let currentUser: SessionUser | null = null;
setAuthTokenGetter(() => token);

// Browser storage is a convenience only: it can be missing or throw (private mode).
export function loadSavedSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Session;
    if (!saved?.token || !saved.user) return null;
    token = saved.token;
    currentUser = saved.user;
    return saved;
  } catch {
    return null;
  }
}

function save(session: Session | null) {
  token = session?.token ?? null;
  currentUser = session?.user ?? null;
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the session still works until the tab closes.
  }
}

export function authHeader(): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function logIn(email: string, password: string): Promise<Session> {
  const response = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({})) as Partial<Session> & { error?: string };
  if (!response.ok || !body.token || !body.user) throw new Error(body.error ?? 'Could not log in. Please try again.');
  const session = { token: body.token, user: body.user };
  save(session);
  return session;
}

/** Confirms a saved session is still valid; returns the fresh profile or null. */
export async function checkSession(): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const response = await fetch('/api/auth/me', { headers: authHeader() });
    if (response.status === 401) { save(null); return null; }
    if (!response.ok) return null;
    return ((await response.json()) as { user: SessionUser }).user;
  } catch {
    return null;
  }
}

/** Manager voucher limit for the logged-in business (RM 20 for older sessions). */
export function voucherLimit(): number {
  return currentUser?.managerVoucherLimitRm ?? 20;
}

export function logOut() {
  save(null);
}

export type RegisterPayload = {
  businessName: string;
  businessType: 'cafe' | 'salon';
  outletName: string;
  voucherLimitRm: number;
  googlePlaceId: string;
  owner: { name: string; email: string; password: string };
  team: { name: string; email: string; role: 'Manager' | 'Staff' }[];
};
export type Registration = Session & {
  business: { name: string; type: string; typeLabel: string };
  outlet: { slug: string; name: string };
  accounts: { name: string; email: string; role: Role; temporaryPassword: string | null }[];
};

/** Simulated sign-up. The session is returned but only saved when the owner continues. */
export async function registerBusiness(payload: RegisterPayload): Promise<Registration> {
  const response = await fetch('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({})) as Partial<Registration> & { error?: string };
  if (!response.ok || !body.token || !body.user) throw new Error(body.error ?? 'Could not register. Please try again.');
  return body as Registration;
}

export function startSession(session: Session) {
  save(session);
}
